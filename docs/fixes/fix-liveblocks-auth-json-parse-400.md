# Fix: Liveblocks Auth — Malformed JSON Returns 400 Instead of 500

## What Was Wrong

In `app/api/liveblocks-auth/route.ts`, the handler parsed the request body like this:

```ts
const { room } = await request.json()
```

That line sits inside the outer `try/catch`, which is correct for catching
unexpected errors. But `request.json()` itself can throw a `SyntaxError` —
specifically when the client sends a body that is not valid JSON (e.g. an empty
body, a plain string, or corrupted data).

Because that `SyntaxError` has nothing to do with the real business logic of the
route (bad Liveblocks credentials, DB errors, missing user), it was falling
through to the generic catch block and returning:

```json
{ "error": "Unexpected end of JSON input" }   →  status 500
```

That is misleading. A 500 means "the server broke." But here the server is fine
— the *client* sent bad input. The correct status for bad client input is 400.

| File | Lines | Issue | Status |
| --- | --- | --- | --- |
| `app/api/liveblocks-auth/route.ts` | 9 | `request.json()` parse errors returned 500 | Fixed |

---

## The Fix

Wrap only the `request.json()` call in its own inner try/catch. On a parse
failure, return `400` immediately and exit. If parsing succeeds, fall through to
the existing `!room` guard as before.

```ts
// Before
const { room } = await request.json()

if (!room) {
  return NextResponse.json({ error: 'Missing room' }, { status: 400 })
}
```

```ts
// After
let room: string | undefined
try {
  const body = await request.json()
  room = body?.room
} catch {
  return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
}

if (!room) {
  return NextResponse.json({ error: 'Missing room' }, { status: 400 })
}
```

Nothing else in the file changed. The outer try/catch still catches everything
unexpected further down the route (Liveblocks SDK errors, DB errors, etc.).

---

## Why This Approach

### Why a separate inner try/catch rather than using the outer one?

The outer catch is intentionally a catch-all for *unexpected* server-side
failures, and it always returns 500. That is the right behaviour for errors the
server owns. But a parse failure is the *client's* fault — the client sent a
broken body. Mixing it into the 500 path gives the caller a misleading signal
and makes debugging harder (a developer sees a 500 in the network tab and
starts investigating the server, when the real problem is the request itself).

The inner try/catch isolates the parse step and lets it return the correct status
code before any server-side work even begins.

### Why `body?.room` instead of destructuring `{ room }`?

Destructuring works fine when the JSON is a plain object. But if the body parses
successfully as a non-object (e.g. `"hello"` or `42`), destructuring would
silently set `room` to `undefined` and fall through to the `!room` guard —
which is fine behaviour, but the optional chaining (`body?.room`) is slightly
more defensive because it handles `null` bodies without throwing. Both
approaches would produce a 400 in that case; the optional chaining just makes
the intent clearer.

### Why keep `let room: string | undefined` outside the inner try?

The inner try needs to assign `room`. The outer handler needs to read it. In
JavaScript/TypeScript, `let` declared inside a block is scoped to that block, so
if we declared `room` inside the inner try, it would be invisible to the `if
(!room)` check right after. Declaring it with `let` before the inner try makes
it visible in the surrounding scope while still being reassignable inside.

---

## Beginner Mental Model: HTTP Status Codes Are a Contract

HTTP status codes tell the caller whose fault the problem was:

```
2xx  →  Success — everything worked
4xx  →  Client error — the caller sent something wrong
5xx  →  Server error — the server broke on its own
```

When a route returns 500 for a problem that the *client* caused (like a bad
request body), it breaks that contract. The caller cannot tell whether they need
to fix their request or whether the server has a bug. Returning 400 for
client-caused problems and 500 for server-caused problems keeps the contract
honest.

---

## Beginner Mental Model: Nested Try/Catch for Layered Error Handling

It is perfectly valid to have a try/catch inside another try/catch when the
inner and outer errors require different responses:

```
outer try {
  inner try {
    parse the body          ← client might send garbage → 400
  } catch {
    return 400
  }

  call the database         ← server might fail → 500
  call Liveblocks           ← SDK might throw → 500

} catch {
  return 500                ← generic catch for server-side failures
}
```

The inner catch handles *one specific, expected failure type* with a precise
response. The outer catch handles *everything else* that is unexpected. This
pattern keeps error responses accurate without duplicating the whole outer
try/catch.

---

## Validation

- IDE diagnostics for `app/api/liveblocks-auth/route.ts`: no linter errors.
- The file reads cleanly with the new inner try/catch before the `!room` guard.
- The outer try/catch, all auth guards, and the Liveblocks session logic are
  unchanged.

---

## Files Changed

| File | Change |
| --- | --- |
| `app/api/liveblocks-auth/route.ts` | Wrapped `request.json()` in a defensive inner try/catch; malformed bodies now return 400 instead of 500 |
| `docs/fixes/fix-liveblocks-auth-json-parse-400.md` | Added this fix log |
