# Fix: Liveblocks Auth — Raw Error Message Disclosed to Clients

## What Was Wrong

The fallback `catch` block in `app/api/liveblocks-auth/route.ts` built a
`message` from `error.message` and sent it directly in the JSON response body:

```ts
// Before — leaks internal error details to callers
const message =
  error instanceof Error ? error.message : 'Internal server error'
console.error('[liveblocks-auth]', message)
return NextResponse.json({ error: message }, { status: 500 })
```

If an unexpected error occurred (e.g. a database failure, a misconfigured
environment variable, a library throwing an exception), the raw
`error.message` could contain sensitive internal details such as:

- `"Cannot read properties of undefined (reading 'userId')"`
- `"ECONNREFUSED 127.0.0.1:5432"` — a database address
- `"Invalid API key for service X"` — a service credential hint

Any of those strings would be returned to whoever made the HTTP request,
including potentially malicious actors. This is called **information
disclosure**: accidentally revealing how your server works internally.

Note: the two other error branches in the same catch block were already safe —
`AsyncTimeoutError` (line 36) and `isTransientUpstreamError` (line 48) both
use hardcoded fixed strings in their responses. Only the fallback branch was
affected.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `app/api/liveblocks-auth/route.ts` | 54–57 | `error.message` echoed into JSON response | Fixed |

---

## The Fix

```ts
// After — full error logged server-side, opaque string sent to client
console.error('[liveblocks-auth]', error)
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
```

Two targeted changes, nothing else touched:

**Change 1 — Log the full `Error` object, not just the message.**
`console.error('[liveblocks-auth]', error)` passes the entire `Error` object
to the server log. Developers see the complete picture — message, stack trace,
cause chain — in the server's stdout/log stream where only authorized people
have access.

The previous code logged only `message` (a string), which discarded the stack
trace. Passing the object instead gives more diagnostic information without any
extra code.

**Change 2 — Respond with a fixed, opaque string.**
`{ error: 'Internal server error' }` is hardcoded. It tells the caller
"something went wrong" without revealing *what* or *where*. The HTTP 500 status
code signals a server problem; the body adds nothing actionable for a client
and should add nothing dangerous for an attacker.

---

## Why Each Decision Was Made

### Decision 1: Log the object, not the string

```ts
// Less useful — stack trace is lost
console.error('[liveblocks-auth]', error.message)

// More useful — full Error object including stack
console.error('[liveblocks-auth]', error)
```

`console.error` accepts any value. When you pass an `Error` object, Node.js
formats it with the message *and* the stack trace in the terminal. When you
pass a string, you only see the string. Since we're already removing
`error.message` from the response, there's no reason to also strip the stack
from the logs — keep everything on the server side.

### Decision 2: Hardcode the client-facing message

The client-facing `"Internal server error"` is intentionally generic. The
design principle is **separation of concerns between audiences**:

| Audience | What they need | What they should NOT get |
|----------|----------------|--------------------------|
| Client (browser / app) | "Something went wrong, try again" | Stack traces, DB addresses, API keys |
| Developer (server logs) | The full error, stack, context | Nothing — they need everything |

A hardcoded string satisfies the client's need (signal that the request
failed) without satisfying an attacker's need (map your server internals).

### Decision 3: Minimal change — no new abstractions

The fix removes 3 lines and replaces them with 2. No new files, no new helper
functions, no restructuring. The smallest correct change has the smallest blast
radius: easier to review, easier to revert, and less likely to accidentally
break an adjacent code path.

---

## Beginner Mental Model: The Two-Audience Rule

Think of your server like a hospital reception desk. When a patient asks
"what's wrong?", the receptionist says "The doctor will be with you shortly" —
not "Your chart shows elevated creatinine suggesting stage 3 CKD." The raw
chart stays with the medical staff who need it to act.

Server error messages work the same way:

```
Attacker sends a crafted request → server throws an exception
                                          ↓
BEFORE fix:  client receives { error: "ECONNREFUSED 127.0.0.1:5432" }
             → attacker now knows you use Postgres, its local address, and the port

AFTER fix:   client receives { error: "Internal server error" }
             → attacker learns only that the request failed (which they already knew)
             → server log has the full error for the developer
```

The rule: **never let the path from `throw` to the HTTP response body pass
through `error.message` directly.** Always go through a hardcoded or
sanitised string.

---

## Beginner Mental Model: `instanceof Error` Is Not Always Reliable

The old code used `error instanceof Error ? error.message : 'Internal server
error'` as a type guard. This pattern appears throughout the codebase and is
reasonable, but it has a subtle limitation worth knowing:

```ts
// In the same JS runtime process — works fine
throw new Error('oops')
error instanceof Error // → true

// Across module/realm boundaries (e.g. iframes, vm.runInContext, some bundlers)
// a different Error class is used, and instanceof can return false
error instanceof Error // → false (even though it looks like an Error)
```

For this route the guard worked correctly, but the real problem was never the
guard — it was that `error.message` (whatever it contained) was forwarded to
clients. Removing the forwarding is the correct fix regardless of whether
`instanceof` was reliable.

---

## Validation

- IDE linter — no errors on the file after the change
- The two safe branches (`AsyncTimeoutError`, `isTransientUpstreamError`) are
  unchanged and continue to return fixed strings
- Any unhandled exception now: logs the full `Error` object to the server
  terminal and returns `{ error: 'Internal server error' }` with HTTP 500 to
  the client

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `app/api/liveblocks-auth/route.ts` | 54–55 | Replace `message`-forwarding response with fixed string; log full `error` object instead of message string |

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is information disclosure and how do attackers exploit it?"** —
   OWASP A05 (Security Misconfiguration) and real-world examples of leaky error
   messages being used to fingerprint server internals.

2. **"What is the difference between `error.message`, `error.stack`, and
   passing the full `Error` object to `console.error` in Node.js?"** — What
   each one contains and why the full object gives more diagnostic value in
   server logs.

3. **"How does structured logging work in Node.js/Next.js and why is it better
   than `console.error`?"** — Tools like `pino` or `winston` that let you log
   JSON with severity levels, correlation IDs, and request context.

4. **"What is the difference between 500, 502, 503, and 504 HTTP status codes
   and when do you use each?"** — This file uses all four and the semantics
   matter for clients deciding whether to retry.

5. **"What is the principle of least privilege in API design?"** — How the same
   idea (expose only what's necessary) applies to error messages, API responses,
   and permissions broadly.

6. **"How do you write a custom error class in TypeScript and why is `error
   instanceof Error` not always reliable?"** — Module boundary edge cases, the
   `cause` field in ES2022 errors, and patterns for safe cross-boundary error
   handling.
