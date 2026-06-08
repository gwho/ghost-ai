# Why Did Reverting + Restarting Fix Everything?

A beginner-friendly breakdown of a genuinely strange debugging session.

---

## What Happened (The Timeline)

1. Two console timeout errors appeared: `[editor-layout]` and `[workspace-page]`
2. An attempt was made to fix them by parallelizing async calls
3. The fix made things **worse** — projects disappeared entirely
4. Reverting the code AND restarting the server fixed **both** problems at once
5. No console errors. Projects visible. Nothing changed in the code logic.

This seems mysterious. It isn't — but you have to understand three separate things
to explain it fully.

---

## Problem 1 — Why Did the Parallelization Break Projects?

### What was changed

The original code fetched the user identity sequentially:

```ts
// Original — safe, sequential
const { userId } = await auth()           // step 1
const user = await currentUser()          // step 2 (waits for step 1)
```

The "optimization" ran them in parallel:

```ts
// Changed — runs both at the same time
const [{ userId }, user] = await Promise.all([auth(), currentUser()])
```

### Why this was dangerous

In Next.js App Router, every incoming HTTP request gets its own **isolated context**.
This context stores things like authentication state, cookies, and headers so that
server-side functions (`auth()`, `currentUser()`, `headers()`, etc.) know which
request they're handling.

This mechanism is called **AsyncLocalStorage** — a Node.js feature that lets you
store a value that is automatically available anywhere inside a specific async call
chain, without passing it explicitly.

Think of it like a backpack you carry through every door you open. When you open
multiple doors simultaneously (parallel async calls), each door might reach into
the backpack at the same time.

In Clerk's implementation, `auth()` and `currentUser()` are both designed to be
called **sequentially**, each reading from the request context in a controlled way.
`currentUser()` internally calls `auth()` first to get the userId, then makes an
API call to Clerk to fetch the full user object. When you call them simultaneously
with `Promise.all`, both try to access and potentially modify the request context
at the same time.

In some versions and environments, this concurrent access causes one function to
read **stale or incomplete context data**, returning null even for an authenticated
user. The result:

```
auth() runs in parallel with currentUser()
  → auth() reads context, gets userId correctly
  → currentUser() reads context SIMULTANEOUSLY, gets incomplete data, returns null
  → identity = null
  → getProjectAccess returns null
  → page shows "Access Denied" or nothing
```

The code looked logically correct on paper. The bug was at the **async context**
level — invisible to static analysis and TypeScript.

### The lesson

Not all async operations are safe to parallelize. Functions that share hidden
state (like a request context) can interfere with each other when called concurrently,
even if they appear independent.

---

## Problem 2 — Why Did the Timeout Exist in the First Place?

### The Prisma cold start

Before any of today's changes, the console showed:

```
[editor-layout] "Timed out while loading editor projects"
```

This came from the `withTimeout(getEditorProjects(), 5000, ...)` call — a 5-second
timer on loading projects from the database.

The root cause: **Prisma's cold start**.

In development (and serverless production), the Prisma query engine is not always
ready instantly. When you:

1. Start the dev server (`npm run dev`)
2. Make changes that trigger module reloads (HMR)
3. Make multiple rapid changes during a session

...the Prisma client goes through initialization cycles. Prisma loads a WebAssembly
(WASM) query engine, establishes a TCP connection to the database, sets up a
connection pool, and validates the schema. This can take **2–5 seconds** on first
use or after certain reloads.

The timeout was set at 5 seconds. On a bad day — slow network, Clerk API latency,
plus Prisma initialization all stacking up — the combined total exceeded 5 seconds.

### Why it was inconsistent

The timeout happened during the dev session but not after a clean restart. This is
because:

- **During a long dev session**: Prisma's connection pool accumulates stale
  connections from repeated hot reloads. Each HMR cycle might not cleanly close
  the existing connection before opening a new one. Over time, the pool gets into
  a degraded state where connections are slow or partially broken.
  
- **After a clean restart**: Prisma creates a brand-new client with a fresh
  connection to the database. The first few requests may be slightly slower (cold
  start), but there are no stale connections to cause timeouts.

This is why `npm run dev` sometimes behaves differently on the first start vs. after
hours of development: the server has accumulated state that a fresh start clears.

---

## Problem 3 — Why HMR Is Not the Same as a Clean Restart

When you save a file in Next.js, **Hot Module Replacement (HMR)** swaps out the
changed module without restarting the entire server. This is great for speed but
creates a subtle problem:

**Global state persists across HMR.**

Look at how Prisma is initialized in this project (`lib/prisma.ts`):

```ts
declare global {
  var _prisma: PrismaClient | undefined
}

export const prisma = globalThis._prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma
```

This pattern is intentional — without it, every HMR cycle would create a new
Prisma client and exhaust the database's connection limit. But it means the SAME
Prisma instance persists across all your code changes during a dev session.

If that Prisma instance gets into a bad state (stale connection, partial
transaction, connection timeout), HMR won't fix it. Only a full server restart
(which clears `globalThis._prisma`) creates a clean slate.

The same principle applies to Liveblocks, Clerk's internal caches, and any other
module-level singletons.

---

## Putting It All Together

Here's the full picture of the debugging session:

```
State during dev session (before revert + restart):
  ┌─────────────────────────────────────────────────────────┐
  │ Prisma client: stale connections from multiple HMR cycles │
  │ Clerk context: potentially degraded from parallel calls  │
  │ Server memory: accumulated state from session's changes  │
  └─────────────────────────────────────────────────────────┘
                              ↓
            Console error: timeout (from stale Prisma state)
            Projects not visible (from broken async context)

After reverting code AND doing a clean restart:
  ┌─────────────────────────────────────────────────────────┐
  │ Prisma client: brand new, fresh connection to database  │
  │ Clerk context: clean, no concurrent access issue        │
  │ Server memory: no accumulated state                     │
  └─────────────────────────────────────────────────────────┘
                              ↓
              No console errors. Projects visible.
```

The revert removed the async context bug. The restart cleared the stale Prisma
state. Both were necessary — the revert alone would have left the stale Prisma
issue, and the restart alone would have kept the broken parallelization.

---

## Why This Is "Strange" (And Why It Isn't)

The experience felt strange for several reasons:

**1. The fix was invisible.** Reverting code and restarting a server looks like
"doing less" — like you're undoing work. But the work being undone was the cause of
the problem. And the restart addressed a separate hidden state issue.

**2. The code looked correct.** The parallelized code was logically valid TypeScript.
No type errors, no syntax errors, build passed. The bug lived in the runtime behavior
of async context — something no static analysis tool could catch.

**3. The same symptoms had different causes.** The timeout and the missing projects
appeared together, so it was natural to assume they had the same cause. They didn't.
The timeout was an infrastructure/state issue. The missing projects were a code logic
issue. This kind of **symptom overlap from independent causes** is one of the hardest
debugging challenges.

**4. The problem only existed during the dev session.** In production (or on a clean
restart), neither issue would necessarily reproduce. This is called a
**Heisenbug** — a bug that changes behavior when you try to observe or reproduce it.

---

## The Core Lessons

### Lesson 1 — AsyncLocalStorage and request context are not free-threaded

Functions that read from request context (`auth()`, `headers()`, `cookies()`) depend
on a specific async call chain being intact. Running them with `Promise.all` can
break this chain in ways that look fine in code but fail at runtime.

**Rule of thumb:** If a function is documented as "call this in a Server Component
or route handler," treat it as context-dependent and don't parallelize it with other
context-reading functions unless the library explicitly supports it.

### Lesson 2 — Development server state is not production state

The `globalThis._prisma` singleton pattern exists because HMR makes it necessary.
But it means your dev server accumulates state across changes. When something "just
works" after a restart but not during a session, stale global state is a prime
suspect.

### Lesson 3 — A clean restart is a diagnostic tool

When you have inexplicable behavior during a long dev session, a clean restart is
often the first step to take before debugging further. It separates
"broken code" from "broken server state." If the problem goes away on restart, the
issue was state, not logic. If it persists, the issue is in the code.

### Lesson 4 — Multiple symptoms don't always share a cause

It's tempting to look for "the fix" when multiple things break at once. Sometimes
they are related. Sometimes they're not. The timeout was real but transient. The
missing projects were a code bug introduced by an optimization. Treating them as
one problem caused a longer debugging loop.

### Lesson 5 — Optimization without profiling is guessing

The parallelization was applied to fix a timeout that turned out to be mostly a
dev-environment state issue (stale Prisma connections), not a code efficiency issue.
The optimization introduced a worse bug. In general: measure first, then optimize
targeted bottlenecks. Don't optimize based on intuition alone.

---

## AI Discussion Topics

**1. What is AsyncLocalStorage and why does Next.js use it?**
AsyncLocalStorage is a Node.js API that stores values in a "context" tied to a
specific async call chain. Next.js uses it to make request data (headers, cookies,
auth state) available anywhere in a server component tree without explicitly passing
it as props. Ask an AI to explain how AsyncLocalStorage works with a visual diagram,
and compare it to how React Context works on the client side. Where do they overlap
conceptually? Where do they diverge?

**2. What is a race condition and when does Promise.all cause one?**
A race condition occurs when two operations that read or write shared state run
simultaneously and their order of execution affects the result. `Promise.all` starts
multiple operations at the same time. Ask an AI to give you three examples of async
operations that are safe to parallelize and three that are not, and explain the
distinguishing feature (hint: look for shared mutable state or sequential
dependencies).

**3. What is a cold start in serverless and how does it affect databases?**
Serverless functions (Vercel, AWS Lambda, etc.) don't stay alive between requests.
Each "cold start" must re-establish database connections, load runtime dependencies,
and initialize the query engine. Ask an AI to explain the full lifecycle of a Prisma
cold start, why WebAssembly loading adds to the latency, and what specific techniques
(connection pooling, keep-alive pinging, edge caching) are used to mitigate it in
production.

**4. What is Hot Module Replacement (HMR) and what state does it preserve?**
HMR is Next.js's ability to swap out changed code modules without restarting the
server process. But it deliberately preserves certain state to keep the server
running. Ask an AI to explain exactly which types of state are preserved vs. cleared
during HMR in Next.js, why the `globalThis._prisma` singleton pattern exists, and
what problems would occur if it DIDN'T use the global.

**5. What is a Heisenbug and how do you debug something that changes when observed?**
A Heisenbug (named after Werner Heisenberg's uncertainty principle) is a bug that
disappears or changes behavior when you try to observe it — such as adding console
logs, running in a debugger, or restarting the server. Ask an AI to walk through
strategies for debugging Heisenbugs: structured logging, reproducible test cases,
environment isolation, and how to tell the difference between "the bug is gone" and
"the bug is hiding."

**6. How do you test async race conditions?**
Race conditions in async code are notoriously hard to test because they depend on
timing. Ask an AI to explain how tools like `fake-timers`, controlled Promise
sequencing, and stress testing can expose async race conditions. Also ask about
how React Testing Library handles async component behavior and what its limitations
are for detecting timing-dependent bugs.

**7. When should you increase a timeout vs. fix the underlying slowness?**
The 5-second timeout on `getEditorProjects` was a guard against slow responses.
When it fired, it could mean "the code is slow" or "the infrastructure is in a bad
state." Ask an AI to discuss the philosophy of defensive timeouts: when they are
appropriate, what the right values are for different operation types (database
queries, external APIs, file I/O), and how to distinguish "normal slow" from
"abnormally slow" in a way that informs good timeout thresholds.
