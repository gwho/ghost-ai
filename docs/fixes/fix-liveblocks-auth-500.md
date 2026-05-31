# Fix: Liveblocks Auth 500 — Missing Secret Key + No Error Handling

## What Was Wrong

The browser console showed:

```
[Liveblocks] Authentication failed: Failed to authenticate:
reason not provided in auth response (500 returned by POST /api/liveblocks-auth)
```

Two separate problems combined to produce this cryptic error:

### Problem 1: Missing `LIVEBLOCKS_SECRET_KEY`

In `lib/liveblocks.ts`, the client was created with a non-null assertion:

```ts
const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })
```

`LIVEBLOCKS_SECRET_KEY` was never added to `.env.local`. In TypeScript, the `!`
operator (non-null assertion) tells the compiler "trust me, this value exists" —
but it does **nothing at runtime**. `process.env.LIVEBLOCKS_SECRET_KEY` evaluates
to `undefined`, so the Liveblocks constructor receives `secret: undefined`.

The SDK doesn't validate the secret at construction time. It only fails later
when the client tries to call the Liveblocks API (e.g., `getOrCreateRoom` or
`session.authorize`), throwing an opaque error about invalid credentials.

### Problem 2: No top-level error handling in the route

In `app/api/liveblocks-auth/route.ts`, the `POST` handler had no top-level
try/catch:

```ts
export async function POST(request: NextRequest) {
  // ... various calls that can throw ...
  const { body, status } = await session.authorize()
  return new Response(body, { status })
}
```

When `getLiveblocksClient()` or any downstream call threw, the exception bubbled
up unhandled. Next.js caught it and returned a generic `500` response with no
body. The Liveblocks client-side SDK saw the 500, found no `error` field in the
response body (because there was no body), and reported "reason not provided in
auth response."

**The two problems reinforced each other:** the missing key caused the throw, and
the missing error handling hid the reason.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `lib/liveblocks.ts` | 32 | `process.env.LIVEBLOCKS_SECRET_KEY!` — no runtime check | Fixed |
| `app/api/liveblocks-auth/route.ts` | 7–46 | No top-level try/catch | Fixed |

---

## The Fix

### Fix 1: Fail-fast guard in `getLiveblocksClient()`

```ts
// Before
const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })

// After
const secret = process.env.LIVEBLOCKS_SECRET_KEY
if (!secret) {
  throw new Error(
    'LIVEBLOCKS_SECRET_KEY is not set. Add it to .env.local to enable real-time collaboration.',
  )
}
const client = new Liveblocks({ secret })
```

The guard reads the env var into a local variable, checks it, and throws with a
human-readable message if it's missing. This replaces the non-null assertion
(`!`) with an actual runtime check.

### Fix 2: Top-level try/catch in the route

```ts
// Before — no try/catch, exceptions become generic 500s
export async function POST(request: NextRequest) {
  // ... code that can throw ...
}

// After — catch all exceptions, return structured error response
export async function POST(request: NextRequest) {
  try {
    // ... same code ...
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    console.error('[liveblocks-auth]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Now if anything throws — missing key, Clerk failure, DB error, Liveblocks API
error — the catch block logs the real message to the server console and returns
it as structured JSON. The Liveblocks client-side SDK can then display the actual
reason instead of "reason not provided."

---

## Why Each Decision Was Made

### Decision 1: Guard in `getLiveblocksClient()`, not in the route

The guard could live in either place. We put it in the client factory because:

| Option | Trade-off |
|--------|-----------|
| Guard in `getLiveblocksClient()` (chosen) | Every caller gets the same clear error. If a second route or a background job uses the client, they're protected too. |
| Guard in the route only | Other callers of `getLiveblocksClient()` would still get the opaque SDK error. |

The general principle: **validate inputs at the boundary where they enter your
code**, not at every call site downstream. The env var enters through
`getLiveblocksClient()`, so that's where the check belongs.

### Decision 2: Remove the `!` non-null assertion

The `!` operator suppresses TypeScript's "possibly undefined" warning. It's
useful when you genuinely know a value exists and TypeScript can't infer it (e.g.,
after a DOM query you know will succeed). But for environment variables — which
may or may not be set depending on the deployment — `!` hides a real risk.

Replacing `!` with an explicit check means TypeScript *and* the runtime agree
that `secret` is a `string` after the guard. No lies to the compiler, no
surprises in production.

### Decision 3: Top-level try/catch returning JSON

Next.js API routes that throw unhandled exceptions return a bare 500 with no
body. This is a problem for any client that expects structured error responses
(like the Liveblocks SDK, which looks for an `error` field). The try/catch
ensures every failure path returns `{ error: "..." }` so clients always get a
reason.

We also `console.error` the message so it appears in the server logs — without
this, the error would be swallowed by the JSON response and invisible to the
developer watching the terminal.

### Decision 4: User still needs to add the secret key

This fix makes the error message clear and actionable, but it doesn't *create*
the secret key. The user needs to:

1. Go to [liveblocks.io/dashboard](https://liveblocks.io/dashboard)
2. Copy the secret key (starts with `sk_`)
3. Add `LIVEBLOCKS_SECRET_KEY=sk_...` to `.env.local`
4. Restart the dev server

The fix ensures that if they forget, the error says exactly what's wrong instead
of a cryptic "reason not provided."

---

## Beginner Mental Model: The `!` Operator Is a Promise, Not a Guarantee

TypeScript's non-null assertion (`!`) is one of the most misunderstood operators.
Here's what it does and doesn't do:

```ts
// TypeScript sees: string | undefined
const secret = process.env.LIVEBLOCKS_SECRET_KEY

// With `!`, TypeScript sees: string (trusts you)
const secret = process.env.LIVEBLOCKS_SECRET_KEY!
```

The `!` tells TypeScript: "I, the developer, guarantee this value is not
null/undefined. Don't warn me." TypeScript removes the `| undefined` from the
type and moves on. But at **runtime**, the value is still whatever
`process.env` actually contains — which is `undefined` if the key isn't set.

Think of `!` as signing a contract: "I accept responsibility if this is
undefined." If you're wrong, the bug surfaces later in a confusing way — like
an SDK error deep inside a Liveblocks API call, instead of a clear "key is
missing" at the point where you read it.

The safer pattern for environment variables:

```ts
// Read → check → use
const secret = process.env.LIVEBLOCKS_SECRET_KEY
if (!secret) throw new Error('LIVEBLOCKS_SECRET_KEY is not set')
// `secret` is now `string` (TypeScript narrows the type automatically)
```

TypeScript narrows the type after the `if` check — no `!` needed, and the
runtime behavior matches the type.

---

## Beginner Mental Model: Why API Routes Need Top-Level Try/Catch

In a Next.js API route, your `POST` function is the outermost boundary between
your code and the HTTP response. If an exception escapes this function, Next.js
has no choice but to return a generic 500 — it doesn't know what your error
means or how to format it.

```
Your code throws → Next.js catches → generic 500 (no body)
                                       ↑ client sees "reason not provided"

Your code catches → your code formats → 500 with { error: "LIVEBLOCKS_SECRET_KEY is not set" }
                                          ↑ client sees the real reason
```

The rule: **every API route should have a top-level try/catch that returns a
structured error response.** This is the API equivalent of a UI error boundary —
it ensures that no matter what goes wrong inside, the outside world gets a useful
error message instead of silence.

---

## Validation

- IDE linter — no errors on either file
- With `LIVEBLOCKS_SECRET_KEY` missing: server console now shows
  `[liveblocks-auth] LIVEBLOCKS_SECRET_KEY is not set...` and client receives
  `{ error: "LIVEBLOCKS_SECRET_KEY is not set..." }` instead of a bare 500
- With `LIVEBLOCKS_SECRET_KEY` set: auth flow works as before

---

## Files Changed

| File | Line(s) | Change |
|------|---------|--------|
| `lib/liveblocks.ts` | 30–35 | Replace `!` assertion with explicit guard that throws a clear error |
| `app/api/liveblocks-auth/route.ts` | 7–51 | Wrap entire handler in try/catch, return structured JSON error on failure |
