# Fix: Liveblocks Auth Build Error — Extra Closing Brace

## What Was Wrong

Next.js failed to compile `app/api/liveblocks-auth/route.ts` with this error:

```text
Expected a semicolon
```

The error pointed at the outer `catch` block:

```ts
} catch (error) {
```

That line was not actually missing a semicolon. The real problem was a few lines
above it: an extra closing brace after the `!room` guard.

```ts
if (!room) {
  return NextResponse.json({ error: 'Missing or invalid room' }, { status: 400 })
}
}
```

That second `}` closed the outer `try` block too early. After that, TypeScript
started parsing the remaining route code in the wrong structural context, so by
the time it reached `catch`, the parser reported a confusing syntax error.

| File | Issue | Status |
| --- | --- | --- |
| `app/api/liveblocks-auth/route.ts` | Extra `}` after the room validation block | Fixed |

---

## The Fix

Remove the extra closing brace so the route stays inside the outer `try` block
until the Liveblocks authorization response is returned.

```ts
if (!room) {
  return NextResponse.json({ error: 'Missing or invalid room' }, { status: 400 })
}

const access = await getProjectAccess(room)
```

Nothing about the route behavior changed. The JSON parsing guard, missing-room
response, project access check, Clerk user check, Liveblocks room creation, and
session authorization logic remain the same.

---

## Why This Fix Works

JavaScript and TypeScript use braces to decide which statements belong together.
The intended structure is:

```text
POST handler
  outer try
    parse JSON
    validate room
    check project access
    check current user
    authorize Liveblocks session
  outer catch
    return 500 JSON error
```

With the extra brace, the structure accidentally became:

```text
POST handler
  outer try
    parse JSON
    validate room
  stray route code outside the try
  catch with no matching try in the parser's current position
```

A `catch` can only appear immediately after the `try` block it belongs to. Since
the extra brace broke that relationship, the parser did not understand the
`catch` keyword and reported the nearby "Expected a semicolon" error.

---

## How I Debugged It

1. Opened the exact file from the build error:

   ```text
   app/api/liveblocks-auth/route.ts
   ```

2. Checked the lines before the reported `catch` location instead of only the
   highlighted line. Parser errors often point to where parsing finally failed,
   not where the syntax first became invalid.

3. Compared the nested `try/catch` structure:

   - Outer `try/catch` wraps the whole route.
   - Inner `try/catch` only wraps `request.json()`.
   - Inner Liveblocks `try/catch` only wraps `lb.getOrCreateRoom(...)`.

4. Found that the `!room` guard had two closing braces even though it only
   needed one.

5. Removed the extra brace and reran validation.

---

## Validation

- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` no longer reports the `Expected a semicolon` error in
  `app/api/liveblocks-auth/route.ts`.

---

## Files Changed

| File | Change |
| --- | --- |
| `app/api/liveblocks-auth/route.ts` | Removed the extra `}` after the missing-room validation guard |
| `docs/fixes/fix-liveblocks-auth-extra-brace-build-error.md` | Added this debugging and fix explanation |
