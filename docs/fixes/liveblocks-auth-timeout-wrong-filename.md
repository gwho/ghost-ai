# Fix: Liveblocks "Authentication failed: Timed out during auth"

## What Was Broken

Opening any workspace page caused a persistent "Connecting…" spinner. The browser
console showed:

```
[Liveblocks] Authentication failed: Timed out during auth
```

The canvas never loaded. The collaborative session never started.

---

## Root Cause — Clerk Middleware Not Running

### The three-layer chain

**Layer 1 — The immediate error: Liveblocks client-side auth timeout**

Liveblocks's JavaScript client POSTs to `/api/liveblocks-auth` to get an auth token.
It has a built-in timeout (~5 seconds). If the server doesn't respond with a valid
token within that window, it fires the error and the canvas stays in "Connecting…"
forever.

**Layer 2 — Why the server was slow: Clerk session not pre-validated**

The auth route handler calls `currentUser()` from Clerk to identify the user. This
function needs access to the validated session — specifically, the user's JWT token
claims. In a properly configured Next.js app, Clerk's proxy runs on every request
FIRST, validates the JWT locally (using the public key, no network call), and injects
the session data into the request context as HTTP headers. `currentUser()` then reads
those headers — an in-process operation that takes essentially zero time.

Without the proxy running, `currentUser()` has no pre-processed session to read. It
falls back to making a **live network call to Clerk's backend API** to validate the
session cookie from scratch. This round-trip adds hundreds of milliseconds under
good conditions and can balloon to several seconds under network latency, Clerk API
slowdown, or cold-start conditions. When it exceeds Liveblocks's ~5-second timeout,
the error fires.

**Layer 3 — Why the proxy wasn't running**

The Clerk proxy code was present in `proxy.ts` and was correctly written. However,
Next.js must be able to discover and load it. Correct file placement and naming is
required for Next.js to wire it in as the proxy handler.

---

## Next.js 16 File Convention: `proxy.ts`

Next.js 16 renamed the middleware file convention from `middleware.ts` to `proxy.ts`.
The rationale from the Next.js docs:

> The term "middleware" often confuses users with Express.js middleware. The name
> "Proxy" clarifies what the feature is capable of — it runs at the network boundary
> in front of the app, closer to the client at the Edge Runtime.

If you have an existing `middleware.ts`, Next.js 16 provides a codemod to migrate:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

The codemod renames the file AND the export function:

```ts
// middleware.ts → proxy.ts
- export function middleware() {
+ export function proxy() {
```

**Important:** Our file uses `export default clerkMiddleware(...)` — a default export
of Clerk's wrapper, not a named `middleware` function. Only the **filename** needed
to be `proxy.ts`. The export itself did not change.

---

## What the Fix Looks Like

The `proxy.ts` file in the project root must contain a valid default export and a
`config` export with the `matcher`:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const signInPath = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'
const signUpPath = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up'

const isPublicRoute = createRouteMatcher([
  `${signInPath}(.*)`,
  `${signUpPath}(.*)`,
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

When this runs on every matching request:

1. **Reads the session cookie** from the incoming request
2. **Validates the JWT locally** using the Clerk public key (no network call needed)
3. **Injects session context** into request headers so `auth()` and `currentUser()`
   can read it instantly in any route handler
4. **Calls `auth.protect()`** for non-public routes:
   - Browser request + not signed in → redirect to sign-in
   - API request + not signed in → 401 JSON response
   - Signed in → passes through to the route handler

---

## Why the Build Never Warned About This

`npm run build` compiles TypeScript and checks types. It cannot verify runtime
behavior — it does not know that `currentUser()` will be slow without the proxy, or
that Liveblocks's client will time out waiting for a response. The build output
shows `ƒ Proxy (Middleware)` when the proxy is loaded correctly; if the file isn't
discoverable, this entry is absent.

This is a category of bug that only manifests at runtime under real network
conditions. Static analysis has no way to catch it.

---

## The Reusable Lesson

**Next.js 16 uses `proxy.ts`, not `middleware.ts`. The old convention is deprecated.**

The `proxy.ts` file must be at the project root (or `src/` if using that layout).
Any other name is compiled as an ordinary TypeScript module and ignored by the
Next.js runtime.

**When using Clerk + Next.js 16, `proxy.ts` is required, not optional.** Without it:
- `auth()` and `currentUser()` in route handlers require live network validation on
  every call — slow and sensitive to upstream latency
- Route protection doesn't work (any URL is accessible without sign-in)
- Session refresh doesn't happen (tokens expire without renewal)
- Real-time auth integrations (like Liveblocks) will time out waiting for responses

---

## AI Discussion Topics

**1. Why did Next.js rename "middleware" to "proxy"?**
The renaming was driven by developer confusion — "middleware" means something
different in Express.js (function injected into the request/response cycle within
the same process). Next.js's equivalent runs at the Edge Runtime, separated from the
app server, with a network boundary in front. "Proxy" maps to this mental model more
accurately. When naming features in frameworks or libraries, what principles guide
good naming? What makes a name "confusing" vs "clear"?

**2. Why does Clerk validate JWTs locally instead of via network?**
Clerk uses asymmetric cryptography: the private key signs tokens on Clerk's servers;
the public key verifies them locally in your app. The public key is embedded in
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Local JWT validation is sub-millisecond and
requires no network round-trip. What are the security implications? What scenarios
would require calling Clerk's backend even with a locally-valid JWT?

**3. The Liveblocks auth timeout chain**
The Liveblocks client had a ~5-second timeout. The server had an 8-second timeout.
The slow Clerk validation pushed response time past the client's limit. When
designing timeout hierarchies (client < server < database), what rules should you
follow? What happens when a client gives up but the server continues working —
are there resource leak implications?

**4. Build passing vs. runtime correctness**
`npm run build` cannot catch "proxy.ts is not being loaded." What categories of bugs
CAN static analysis catch, and what categories require integration tests or runtime
observation? How would you write a test to verify the proxy is actually intercepting
requests?

**5. What does `auth.protect()` do differently for API vs. page routes?**
For browser requests, `auth.protect()` redirects to sign-in. For API requests, it
returns a JSON 401. How does Clerk detect which behavior to apply? (Hint: `Accept`
header and URL pattern.) What happens if a client-side `fetch()` to an API route
doesn't include the right headers — could it accidentally receive an HTML redirect
instead of a 401?
