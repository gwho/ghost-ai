# Fix: Liveblocks Auth Timed Out During Auth

## What Was Broken

The browser console showed this error when the editor tried to open the
collaborative canvas:

```text
[Liveblocks] Authentication failed: Timed out during auth
```

The canvas depends on this endpoint:

```text
POST /api/liveblocks-auth
```

Liveblocks calls that endpoint before it joins a room. If the endpoint does not
answer quickly enough, the Liveblocks client stops waiting and reports an auth
timeout.

## Why The Bug Happened

Liveblocks authentication is intentionally server-side. The browser cannot use
`LIVEBLOCKS_SECRET_KEY`, because that key would let anyone mint room tokens.
Instead, the browser asks the Next.js route for a short-lived token.

The route still has to do real security work before issuing that token:

1. Read the room id from the request body.
2. Ask Clerk who the current user is.
3. Ask Prisma whether that user owns or collaborates on the project.
4. Ask Liveblocks to authorize a room-scoped session.
5. Return the official Liveblocks auth response.

The slow part was the project access check. The database client can wait up to
10 seconds for a connection, and the helper can retry transient database
connection failures. That is reasonable for many API routes, but it is too long
for Liveblocks auth because the Liveblocks client also has its own auth timeout.

So when the database or another upstream service stalled, the app did not return
a useful response first. The browser only saw that Liveblocks gave up waiting.

There was a second visible-load problem too: the editor layout and workspace
page also read from the database before rendering the shell. If either of those
server-side reads stalled or threw a transient Prisma connection error, the user
could see an empty page or a development error overlay before the canvas or
toolbar had a chance to appear.

## The Fix

`app/api/liveblocks-auth/route.ts` now wraps the expensive auth work in a
route-level timeout:

```ts
const LIVEBLOCKS_AUTH_ROUTE_TIMEOUT_MS = 8_000

return await withLiveblocksAuthTimeout(authorizeLiveblocksRoom(room))
```

The timeout is shorter than Liveblocks' client-side auth timeout. If Clerk,
Prisma, or Liveblocks server authorization stalls, our route returns a controlled
HTTP 504 response before the Liveblocks SDK hits its own timeout.

The route also explicitly opts into the Node.js runtime:

```ts
export const runtime = 'nodejs'
```

That keeps this Prisma-backed route away from Edge-style runtimes. Prisma's
database adapter and the generated Prisma client are intended to run in Node for
this app.

The editor's server-rendered access checks now also use bounded waits:

- `app/editor/layout.tsx` waits up to 5 seconds for the sidebar project list,
  then renders the editor shell with empty project lists if the database is too
  slow or temporarily unavailable.
- `app/editor/[roomId]/page.tsx` waits up to 5 seconds for project access, then
  renders a visible "taking too long to load" message instead of leaving the
  page blank or crashing on a transient Prisma connection error.

`CanvasWrapper` now uses a Liveblocks auth callback instead of a plain endpoint
string. That callback turns 400, 401, 403, 404, 503, and 504 auth responses into
a terminal Liveblocks auth error. This prevents Liveblocks from retrying a known
server timeout or database outage forever while the canvas remains hidden behind
Suspense.

## How The Fixed Flow Works

### 1. The browser asks for a token

`CanvasWrapper` renders:

```tsx
<LiveblocksProvider authEndpoint="/api/liveblocks-auth">
```

When `RoomProvider` mounts, Liveblocks posts the room id to
`/api/liveblocks-auth`.

### 2. The route validates the request

The route still rejects malformed JSON, missing room ids, signed-out users, and
users who do not have project access.

This part did not change. The fix does not skip authentication or
authorization.

### 3. The route races auth work against a timeout

The expensive work happens inside `authorizeLiveblocksRoom(room)`. The route
wraps it with `withLiveblocksAuthTimeout(...)`.

If the work finishes in time, the browser receives the normal Liveblocks token
response.

If the work takes too long, the browser receives:

```text
504 Gateway Timeout
```

with a clear JSON error message.

The client auth callback treats that response as a clear connection failure, so
the canvas can show its error boundary instead of retrying endlessly.

## Why This Fix Works

Before the fix, the auth route could outlive the Liveblocks SDK's auth wait
window. That made the client print:

```text
Timed out during auth
```

After the fix, the app fails first with a specific server response when upstream
services stall. That changes the failure mode from "the SDK waited too long" to
"the app could not verify access quickly enough."

This is important because those are different problems:

| Problem | Meaning |
| --- | --- |
| Liveblocks client timeout | The browser waited for auth but got no answer in time. |
| Route-level 504 | The server started auth work but an upstream dependency was too slow. |

The second error is easier to debug. It points developers toward Clerk, Prisma,
the database connection pool, or Liveblocks server authorization latency instead
of making the canvas UI look broken.

## Beginner Mental Model

Think of Liveblocks auth like a security desk:

```text
Browser: "Can I enter room project_123?"
Server:  "I need to check your ID and the project access list."
Clerk:   "This is user_abc."
Database:"user_abc owns or collaborates on project_123."
Server:  "Here is a temporary Liveblocks pass."
```

The bug was that the security desk could get stuck waiting on a phone call. The
browser waited too, but only for a limited time. When the pass did not arrive
quickly enough, Liveblocks reported an auth timeout.

The fix adds a timer at the security desk. If the checks cannot finish quickly,
the server says so directly instead of making the browser wait until Liveblocks
gives up.

## What Changed

| File | Change |
| --- | --- |
| `app/api/liveblocks-auth/route.ts` | Added `runtime = 'nodejs'`, extracted `authorizeLiveblocksRoom(room)`, and wrapped the auth hot path in an 8 second timeout that returns HTTP 504 on stalls. |
| `app/editor/layout.tsx` | Wrapped the project-list load in a 5 second timeout so the editor shell can still render if the sidebar data stalls. |
| `app/editor/[roomId]/page.tsx` | Wrapped workspace access verification in a 5 second timeout and renders a visible fallback message on timeout. |
| `components/editor/canvas-wrapper.tsx` | Replaced the string `authEndpoint` with a callback that converts server timeout responses into terminal Liveblocks auth failures instead of endless retries. |
| `lib/async-timeout.ts` | Added a shared timeout helper used by server render paths and the Liveblocks auth route. |
| `lib/upstream-errors.ts` | Added transient upstream/database error detection so temporary Prisma failures can render controlled UI instead of crashing the page. |
| `docs/fixes/fix-liveblocks-auth-timeout.md` | Added this beginner-friendly what/how/why explanation and follow-up study prompts. |

## Topics To Discuss With LLMs Or Agents

Use these prompts to learn the concepts behind this bug:

1. "Explain Liveblocks authentication in a Next.js app. Why does the browser need an auth endpoint instead of using the secret key directly?"
2. "What is the difference between authentication, authorization, and issuing a Liveblocks room token?"
3. "Why can a slow server route show up as a browser-side SDK timeout?"
4. "How should I choose timeout values for latency-sensitive API routes?"
5. "What is a request hot path, and how do I remove unnecessary work from it?"
6. "How do Prisma connection timeouts and retry logic affect user-facing API latency?"
7. "Why does Prisma often need the Node.js runtime in Next.js route handlers?"
8. "How should an app distinguish between a 401, 403, 500, and 504 response?"
9. "What are the trade-offs of returning a fast 504 instead of waiting longer for an upstream dependency?"
10. "How can I instrument an auth endpoint to see whether Clerk, Prisma, or a third-party SDK is slow?"

## Validation

- Malformed JSON still returns 400.
- Missing or invalid room ids still return 400.
- Signed-out users still return 401.
- Users without project access still return 403.
- Successful requests still return the official `session.authorize()` response
  expected by the Liveblocks client SDK.
- Slow upstream auth work now returns 504 before the Liveblocks client reaches
  its own auth timeout.
- Slow editor sidebar loads no longer block the whole editor shell.
- Slow workspace access checks now render a visible timeout message instead of a
  blank page.
