# Fix: `LiveblocksError` Swallowed in `liveblocks-auth` Route

## Summary

The `try/catch` around `lb.getOrCreateRoom` in the Liveblocks auth route caught
`LiveblocksError` and silently did nothing. Every Liveblocks API error — rate limits,
invalid room IDs, permission failures — was swallowed and the handler continued as if
the call had succeeded. The fix surfaces `LiveblocksError` as an explicit HTTP response
using the error's own status code, and keeps the existing behaviour for all other error
types (rethrow → caught by outer handler → 500).

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `app/api/liveblocks-auth/route.ts` | 33–37 | `LiveblocksError` from `lb.getOrCreateRoom` silently swallowed | Fixed |

---

## Step 1 — Verification

```ts
// Before — the inner catch block
try {
  await lb.getOrCreateRoom(room, { defaultAccesses: [] })
} catch (error) {
  if (!(error instanceof LiveblocksError)) throw error
  // ← if it IS a LiveblocksError: nothing. Falls through silently.
}
```

The condition `!(error instanceof LiveblocksError)` means:
- **Not a `LiveblocksError`** → rethrow (caught by outer try/catch → 500 response). ✓
- **Is a `LiveblocksError`** → condition is `false`, `throw` is skipped → error is
  discarded, execution continues to `lb.prepareSession`. ✗

`LiveblocksError` is confirmed importable and in active use on line 3. The class has
`readonly status: number` and `message: string` fields (verified in
`node_modules/@liveblocks/node/dist/index.d.ts`).

Finding confirmed valid.

---

## The Bug Explained

### What `getOrCreateRoom` can throw

`lb.getOrCreateRoom` is a Liveblocks REST API call. Like any HTTP call, it can fail:

| Scenario | Thrown as |
|----------|-----------|
| Network failure, DNS, timeout | generic `Error` or `TypeError` |
| Liveblocks API error (rate limit, bad room ID, auth, quota) | `LiveblocksError` |

The intent of the original code was probably: "if the room already exists, that's fine —
just ignore the error and proceed." But `getOrCreateRoom` is specifically designed to
handle the "room already exists" case without throwing — it returns the existing room.
So a `LiveblocksError` here is a real error, not an expected "already exists" signal.

### What happens when the error is swallowed

After swallowing the error, the handler continues to:

```ts
const session = lb.prepareSession(user.id, { ... })
session.allow(room, session.FULL_ACCESS)
const { body, status } = await session.authorize()
return new Response(body, { status })
```

`session.authorize()` is another Liveblocks API call. If `getOrCreateRoom` failed because
the room does not exist and could not be created, `authorize()` may fail too — but now
with a *different* error whose message doesn't describe the original problem. Or it may
succeed and issue a session token for a room that doesn't actually exist, causing silent
failures later in the canvas.

Swallowing the error does not make the problem go away — it defers and obscures it.

### Why the inverted condition is easy to misread

```ts
if (!(error instanceof LiveblocksError)) throw error
```

This reads as "throw unless it's a LiveblocksError", which feels like it's handling
LiveblocksError — but handling it by doing nothing is the same as swallowing it.
The fix inverts the structure so each branch is explicit:

```ts
if (error instanceof LiveblocksError) {
  return new Response(...)  // handle it explicitly
}
throw error                 // rethrow everything else
```

Now a reader can see both outcomes without mentally negating the condition.

---

## The Fix

### Before

```ts
try {
  await lb.getOrCreateRoom(room, { defaultAccesses: [] })
} catch (error) {
  if (!(error instanceof LiveblocksError)) throw error
  // LiveblocksError: falls through silently
}
```

### After

```ts
try {
  await lb.getOrCreateRoom(room, { defaultAccesses: [] })
} catch (error) {
  if (error instanceof LiveblocksError) {
    return new Response(JSON.stringify({ error: error.message }), { status: error.status })
  }
  throw error
}
```

Two things changed:

1. **`LiveblocksError` now returns a response** — using `error.status` (the HTTP status
   code the Liveblocks API returned, e.g. 429 for rate limit, 403 for permission denied)
   and `error.message` as the body. This gives the client a meaningful, correctly-coded
   error instead of either a silent failure or a generic 500.

2. **Non-`LiveblocksError` errors are still rethrown** — they propagate to the outer
   `try/catch` (lines 8/53) which logs and returns a 500. Behaviour for these errors is
   unchanged.

### Why `error.status` instead of a hardcoded 500

`LiveblocksError` carries the HTTP status from the Liveblocks API response. Using it
passes the right semantic to the client:
- 429 (rate limit) → client knows to back off
- 403 (permission denied) → client knows the auth or room config is wrong
- 404 (not found) → client knows the resource doesn't exist

A hardcoded 500 would collapse all of these into "Internal Server Error", hiding the
real cause.

---

## What Did Not Change

- The outer `try/catch` (lines 8/53) is untouched — it handles all unhandled throws
  and returns a generic 500.
- All auth and access checks before `getOrCreateRoom` are untouched.
- `lb.prepareSession`, `session.allow`, and `session.authorize()` are untouched.
- The `LiveblocksError` import on line 3 was already present; no new imports needed.

---

## Beginner Mental Model: Silent `catch` vs. Explicit Error Routing

### The problem with `catch` blocks that do nothing

A `try/catch` where the catch block is empty (or does nothing useful) is sometimes called
a "swallowed error" or "error sink." It looks like error handling but is actually the
opposite — it hides the error from everything downstream.

```ts
try {
  riskyOperation()
} catch {
  // nothing here
}
// code continues as if riskyOperation() never failed
```

The danger: the system is now in an undefined state. The operation failed, but the rest
of the code doesn't know that. It may read uninitialized variables, write corrupted data,
or return a success response to the client when the actual operation failed.

### The right pattern: every catch branch should take an action

A catch block should always do at least one of:
- **Return an error response** (route handlers, API routes)
- **Re-throw** (let a higher layer handle it)
- **Log and set error state** (React components — see the `handleInvite` fix)
- **Handle the specific case** (e.g. ignore "already exists" if that's truly expected)

"Ignore it and continue" is only correct when you have explicitly confirmed that the
error condition is harmless and expected. A broad `LiveblocksError` catch does not
qualify — it includes dozens of error types, most of which are not harmless.

### The inverted condition pattern to avoid

```ts
// Fragile: easy to miss what's being handled
if (!(error instanceof SpecificError)) throw error

// Clear: both branches are explicit
if (error instanceof SpecificError) {
  /* handle it */
} else {
  throw error
}
```

Both forms are logically equivalent, but the second makes it impossible to accidentally
add "handle it by doing nothing" — every positive branch requires a statement.

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/liveblocks-auth/route.ts` | Inner catch now returns `new Response(...)` with `error.status` / `error.message` for `LiveblocksError`; non-`LiveblocksError` errors still rethrown |
