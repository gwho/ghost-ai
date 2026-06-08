# Fix: "Failed to connect to upstream database" When Sharing Canvas

## What Broke

When a collaborator (second user) tried to open the shared canvas, the page crashed with:

```
Runtime error: Failed to connect to upstream database.
Please contact Prisma support if the problem persists.

    at e.interpretNode (lib/generated/prisma/runtime/client.js:15:44621)
    ...
```

The error appeared in the Next.js browser error overlay.

The owner's canvas and home page worked fine. Only the first connection attempt after a period of inactivity, or when a second user joined simultaneously, triggered the error.

---

## Root Cause (Layered)

### Layer 1 — Where the message comes from

The error message "Failed to connect to upstream database" is not a JavaScript or Node.js error. It is a **PostgreSQL protocol-level error** returned directly by the `pooled.db.prisma.io` proxy.

`pooled.db.prisma.io` is Prisma's connection pooling proxy. It sits between your app and the actual PostgreSQL database. When you execute a query, the flow is:

```
Your app
  → pg.Pool (in-process connection pool)
  → pooled.db.prisma.io (Prisma's proxy)
  → actual Prisma Postgres database instance
```

If the proxy cannot connect to the actual database — for example, because the database is momentarily busy, the proxy's own internal pool is exhausted, or the underlying instance is waking up from a brief pause — it returns a raw PostgreSQL error with the text "Failed to connect to upstream database."

The `pg` driver receives this as a normal PostgreSQL `DatabaseError` and throws it as a JavaScript error. Prisma's driver adapter (`@prisma/adapter-pg`) passes it through. Prisma's runtime (`interpretNode`) re-wraps it and throws it to your code.

Diagnosis confirmed: direct `pg.Pool` and direct `prisma.project.findMany()` tests both succeed reliably. The error is **intermittent** and tied to cold connection establishment — the proxy proxy momentarily failing to create a connection to its own upstream.

### Layer 2 — Why the collaborator is the trigger

For the *owner*, the app has recently made database queries (loading the project list, serving the home page). The pg pool has live, warm connections to the proxy. The proxy's own internal pool is already warm for that session.

For the *collaborator*, this is their first request. The pg pool's connections have been idle for > `idleTimeoutMillis` (the old default: 10 seconds), so all pool connections have been closed. When the collaborator's request arrives:

1. The pg pool creates a **brand-new connection** to `pooled.db.prisma.io`
2. The proxy needs to establish or reassign a connection to the actual Postgres instance
3. If the proxy is momentarily busy establishing that upstream connection, the request fails immediately with "Failed to connect to upstream database"

This is a **transient race condition** at Prisma's infrastructure layer — a real failure, not a bug in authentication or access logic.

### Layer 3 — Why it crashed the page instead of showing an error

The Prisma query lives in `lib/project-access.ts → getProjectAccess()`, which is called from:

1. `app/editor/[roomId]/page.tsx` — a **React Server Component**  
2. `app/api/liveblocks-auth/route.ts` — an API route

In the server component path, an unhandled `throw` propagates up through Next.js's rendering pipeline. With no `error.tsx` boundary defined for the `[roomId]` route, Next.js surfaces the raw error in the browser's dev overlay and halts rendering.

In the API route path, the outer `try/catch` catches it and returns a 500 response — but by then the server component has already failed.

---

## The Fix

Two coordinated changes:

### 1. `lib/prisma.ts` — Better pg Pool Configuration

**Before:**
```ts
const adapter = new PrismaPg({ connectionString: normalizedUrl })
```

**After:**
```ts
const adapter = new PrismaPg({
  connectionString: normalizedUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})
```

What each option does:

| Option | Old | New | Why |
|---|---|---|---|
| `max` | 10 (pg default) | 5 | Fewer simultaneous connections means less competition for the proxy's upstream pool slots |
| `idleTimeoutMillis` | 10 000 ms | 30 000 ms | Connections stay in the pool 3× longer before being discarded, reducing "cold connection on first request" scenarios |
| `connectionTimeoutMillis` | 0 (infinite) | 10 000 ms | Fail fast if a new connection can't be established in 10 s, rather than hanging indefinitely |

### 2. `lib/project-access.ts` — One-Shot Retry on Transient Errors

**Added:**
```ts
function isTransientConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return (
    msg.includes('Failed to connect') ||
    msg.includes('upstream database') ||
    msg.includes("Can't reach database") ||
    msg.includes('Connection timed out')
  )
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientConnectionError(err)) throw err
    await new Promise((r) => setTimeout(r, 300))
    return fn()
  }
}
```

**Applied to the Prisma query in `getProjectAccess`:**
```ts
const project = await withRetry(() =>
  prisma.project.findUnique({
    where: { id: projectId },
    include: { collaborators: true },
  }),
)
```

The retry strategy:
- Attempt 1: run the query normally
- If it throws a transient connection error: wait 300 ms (gives the proxy time to recover), then try once more
- If it throws any other error: rethrow immediately (no retry for auth errors, not-found, etc.)
- If the retry also fails: rethrow the error (it's not transient — there's a real problem)

300 ms is long enough for the proxy to establish an upstream connection, short enough to be invisible to the user.

---

## What Was Ruled Out

| Hypothesis | Evidence against |
|---|---|
| SSL certificate failure (`verify-full`) | Direct `pg.Pool` test succeeded with `sslmode=verify-full` — TLS handshake works |
| Wrong credentials | Same test succeeded with authentication — credentials are correct |
| Prisma singleton re-created on each request | Module-level singleton with `globalThis` guard is correct; works in dev hot-reload |
| Concurrent query limit | Stress test with 3 simultaneous queries succeeded |
| `accelerateUrl` API mismatch in Prisma 7 | URL starts with `postgres://`, so the `accelerateUrl` branch is never taken |

---

## Beginner-Friendly Explanation

### What is a "connection pool" and why does it matter?

When your app needs to query the database, it can't just open and close a direct network connection for every single query — that would be too slow (each connection setup takes ~100 ms for SSL, auth, etc.). Instead, a **connection pool** keeps several connections alive in the background. When a query arrives, it borrows one of these ready connections, runs the query, and returns the connection to the pool.

This is like a parking lot of pre-warmed cars rather than starting a cold engine for every trip.

### What is `pooled.db.prisma.io` and why does it add complexity?

Your app's pg pool connects to `pooled.db.prisma.io`, which is itself a connection pooler running on Prisma's infrastructure. It's a **proxy** that sits in front of the actual Postgres database. So there are actually TWO pools in play:

```
Your app (pg.Pool: up to 5 connections)
  ↕
pooled.db.prisma.io (Prisma's proxy pool)
  ↕
Actual Postgres database (with its own connection limit)
```

When both pools need to create new connections at the same time, there's a brief window where requests can fail. That's what "Failed to connect to upstream database" means — the proxy couldn't get a connection slot from the actual database fast enough.

### Why does the collaborator trigger this more often than the owner?

The owner has been actively using the app, so their pg pool has warm, live connections to the proxy. The collaborator's first request arrives with a cold pool — all idle connections have been closed. So the pg pool creates a fresh connection to the proxy, which then needs to create a fresh connection to the actual database. Two cold starts happening at once → higher chance of a timing collision.

### Why is a 300 ms wait the right retry delay?

A typical TCP connection + TLS handshake + PostgreSQL authentication round trip takes 50–150 ms. By waiting 300 ms before retrying, you're giving the proxy enough time to:
1. Complete any in-progress connection setup
2. Notice and clean up any stale internal connections
3. Re-establish a healthy upstream connection

If 300 ms isn't enough and the retry also fails, the error is thrown as normal — it means the database is genuinely unavailable, and a retry loop wouldn't help.

### What does `idleTimeoutMillis: 30_000` actually change?

`idleTimeoutMillis` controls how long an **unused connection** stays alive in the pool before being discarded. With the old default of 10 seconds, any connection unused for 10 seconds was destroyed. Between user requests, this means the pool often becomes empty. When the next request arrives, a new connection must be created from scratch — which is exactly when the "upstream database" error is most likely to occur.

With 30 seconds, connections stay alive for three times as long between requests. A casual user interacting every 10–30 seconds will almost always find a warm connection ready.

### Why `max: 5` instead of the default `max: 10`?

The Prisma Postgres development tier has a limit on how many simultaneous connections the proxy and underlying database will accept. If `pg.Pool` tries to create 10 simultaneous connections (the default max), it may exceed that limit — causing some connections to fail. With `max: 5`, we stay comfortably below typical tier limits while still supporting multiple concurrent users.

---

## Reusable Lessons

**1. Two pools in series multiply failure probability.**  
When you have an in-process pool (pg.Pool) + an external proxy pool (pooled.db.prisma.io) + the actual database, transient failures at any layer can bubble up as cryptic errors. Always test by simulating a cold start (idle for >30 s), not just a warm restart.

**2. "Failed to connect" errors from a proxy are not the same as "connection refused."**  
`ECONNREFUSED` means your app can't even reach the proxy — the proxy is down. "Failed to connect to upstream database" means the proxy IS reachable but it can't reach what's behind it. These require different fixes.

**3. Retry exactly once, for exactly the right error class.**  
Don't retry on all errors. Retrying a "Forbidden" or "Not found" error wastes time and hides bugs. Use `isTransientConnectionError()` to narrow retries to network-layer failures. And retry once, not in a loop — if one retry doesn't fix a transient error, it means the problem is persistent.

**4. Server component throws are visible to the user.**  
In Next.js App Router, a server component that throws and is not wrapped in an `error.tsx` boundary will crash the entire page and show the raw error in the browser (in dev mode) or a blank error page (in production). Either add an error boundary or ensure all potentially-failing operations have graceful fallbacks.

**5. `connectionTimeoutMillis: 0` means infinite wait.**  
The default for `pg.Pool` is `connectionTimeoutMillis: 0` — if a connection can never be established, the promise hangs forever. In a Next.js server context, this will stall the page render indefinitely. Always set a reasonable timeout (10 s here) so failures surface quickly.

---

## Topics to Discuss with an LLM / AI to Learn More

### Database & Connection Layer
1. **"Explain connection pools (pg.Pool) and why they exist — with a simple Node.js example"**  
   Ask it to walk through creating a pool, borrowing a client, running a query, and releasing the client. Then ask what happens if you forget to release.

2. **"What is the difference between sslmode=require, sslmode=verify-ca, and sslmode=verify-full in PostgreSQL? When would each mode fail?"**  
   This will teach you the full TLS/SSL trust model for database connections.

3. **"What is PgBouncer and how does it work? What are transaction mode vs session mode?"**  
   `pooled.db.prisma.io` is a PgBouncer-style proxy. Understanding modes helps you understand why the error message refers to "upstream."

4. **"What does idleTimeoutMillis do in pg.Pool? Draw a timeline showing connection lifecycle from creation to destruction."**  
   Ask for a visual/narrative explanation of the full pool lifecycle.

5. **"What is a cold start in the context of serverless or connection pools? How does it cause latency and transient errors?"**  
   Understand why the second user — not the first — typically experiences cold-start errors.

### Error Handling Patterns
6. **"Explain the retry-with-backoff pattern in JavaScript. Why is exponential backoff better than a fixed delay for retries?"**  
   Our fix uses a single fixed delay (300 ms). Ask about when to use exponential backoff instead (multiple attempts, external APIs, etc.).

7. **"What is the difference between a transient error and a persistent error in distributed systems? How do you decide whether to retry?"**  
   This is the core of why `isTransientConnectionError()` only matches specific message strings.

8. **"What are Prisma error codes (P1001, P2024, etc.) and how do you catch specific ones?"**  
   Learn how to narrow error handling using Prisma's error class and `code` property rather than string-matching on messages.

### Next.js Specific
9. **"What is error.tsx in Next.js App Router? How does it catch server component errors and show a graceful fallback?"**  
   Our fix prevents the error from being thrown at all — but the next defensive layer would be an `error.tsx` file.

10. **"What is the difference between throwing inside a server component vs inside an API route handler in Next.js? How does each surface to the user?"**  
    Understanding this helps you decide where to place error handling and what the user experience looks like in each case.

### Prisma Specific
11. **"How does @prisma/adapter-pg work? Why does Prisma 7 use driver adapters instead of its own binary query engine?"**  
    Prisma 7's adapter-based architecture replaced the Rust-based binary query engine. Understanding this helps you debug future Prisma errors.

12. **"What is the Prisma Postgres pooled connection URL (pooled.db.prisma.io) vs the Prisma Accelerate URL (accelerate.prisma-data.net)? When do you use each?"**  
    These are two different Prisma infrastructure services and their URLs have different behaviors with the pg driver.
