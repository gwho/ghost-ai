# Fix: "Timed out while loading editor projects" / "Timed out while verifying project access"

## What Was Broken

Two server-side timeout errors appeared in the console:

```
[editor-layout] "Timed out while loading editor projects"
[workspace-page] "Timed out while verifying project access"
```

Both caused degraded experiences — the editor sidebar showed no projects, and the
workspace page showed a "Project is taking too long to load" error screen.

---

## Root Cause — Unnecessary Sequential Async Operations

Both functions had the same structural problem: they performed independent async
operations one after another, when the operations could run in parallel.

### `getEditorProjects()` in `lib/project-data.ts`

**Original order:**

```
auth()          →   userId
currentUser()   →   email (Clerk API call, ~200ms–2s)
prisma.owned    →   owned projects (DB query, ~50ms–3s cold start)
prisma.shared   →   shared projects (DB query, depends on email)
```

`currentUser()` and `prisma.owned` are **independent** — the owned query only needs
`userId` (from `auth()`), not the user object. They were running sequentially when
they could run in parallel. The shared query legitimately depends on email from
`currentUser()`, so it runs after.

**Fixed order:**
```
auth()
  ↓
Promise.all([currentUser(), prisma.owned])   ← parallel
  ↓
prisma.shared (if email available)
```

### `getProjectAccess()` in `lib/project-access.ts`

This had an even bigger opportunity. **Original order:**

```
getCurrentIdentity()   →   auth() then currentUser() (sequential, ~200ms–2s)
prisma.findUnique      →   fetch project with collaborators (~50ms–3s cold start)
```

The Prisma query only uses `projectId` — a parameter passed into the function. It
does **not** need anything from `getCurrentIdentity()`. These two operations were
waiting on each other for no reason.

When both are slow (e.g., cold start + Clerk API latency), the total exceeded the
5-second timeout:

```
t(currentUser) + t(prisma) = 2s + 3s = 5s → TIMEOUT
```

**Fixed order:**
```
Promise.all([getCurrentIdentity(), prisma.findUnique()])   ← parallel
```

```
max(t(currentUser), t(prisma)) = max(2s, 3s) = 3s → OK
```

This cuts the critical path from the **sum** of both durations to the **max** —
the biggest single speedup available without changing infrastructure.

### `getCurrentIdentity()` — also parallelized

`auth()` and `currentUser()` both read from the same proxy-processed session
context. They are independent reads with no ordering requirement. Running them in
parallel saves the sequential overhead of `auth()` (~10–50ms):

```ts
// Before:
const { userId } = await auth()
const user = await currentUser()

// After:
const [{ userId }, user] = await Promise.all([auth(), currentUser()])
```

---

## Why These Operations Can Safely Run in Parallel

| Operation | What it reads | What it writes |
|---|---|---|
| `auth()` | Request context headers (proxy-set) | Nothing |
| `currentUser()` | Request context → Clerk API call | Nothing local |
| `prisma.findUnique()` | Database | Nothing (read-only) |

All three are pure reads with no shared mutable state. Parallelizing them introduces
no race conditions.

The only legitimate dependency: `prisma.shared` needs the `email` that comes from
`currentUser()`. That query remains sequential after `currentUser()` resolves.

---

## The Numbers

Assume: `t(auth)=10ms`, `t(currentUser)=1500ms`, `t(prisma)=2000ms` (cold start)

### `getEditorProjects`

| Version | Timeline | Total |
|---|---|---|
| Before | `10 + 1500 + max(2000, 500)` | **3510 ms** |
| After | `10 + max(1500, 2000) + 500` | **2510 ms** |
| Saved | | **1000 ms** |

### `getProjectAccess`

| Version | Timeline | Total |
|---|---|---|
| Before | `10 + 1500 + 2000` | **3510 ms** |
| After | `10 + max(10+1500, 2000)` | **2010 ms** |
| Saved | | **1500 ms** |

Under bad conditions (`t(currentUser)=2500ms`, `t(prisma)=3000ms`):

| Version | Total |
|---|---|
| Before | `2500 + 3000 = 5500ms` → **TIMEOUT** |
| After | `max(2500, 3000) = 3000ms` → **OK** |

---

## The Reusable Lesson

**When multiple async operations are independent, run them in parallel with
`Promise.all`. Sequential `await` is only correct when operation B needs
the RESULT of operation A.**

The pattern to recognize:

```ts
// ❌ Sequential — B doesn't use A's result, so this wastes time
const a = await fetchA()
const b = await fetchB()

// ✅ Parallel — A and B are independent
const [a, b] = await Promise.all([fetchA(), fetchB()])
```

The mistake is easy to make because `await` is syntactically lightweight and async
code reads naturally top-to-bottom. But each `await` blocks the next line until it
resolves, even when there's no data dependency.

**How to spot this pattern:**
1. Look for multiple `await` calls in sequence
2. Ask: "Does the second call use any value returned by the first?"
3. If no: they can be parallelized with `Promise.all`

**When NOT to parallelize:**
- When B uses A's return value (obvious data dependency)
- When B has a SIDE EFFECT that A depends on (rare in read-heavy server code)
- When you want to limit concurrency to avoid overwhelming a database connection pool

---

## AI Discussion Topics

**1. sum vs max — the parallelism speedup model**
Sequential execution time is the SUM of individual durations. Parallel execution
time is the MAX. The speedup is greatest when the operations have similar durations.
If one operation dominates (e.g., 5s vs 10ms), parallelism barely helps. How do you
decide whether to spend engineering effort parallelizing when you don't know the
relative durations in advance?

**2. Cold start and connection pooling in serverless**
The Prisma query times here can balloon to 3–5 seconds on a cold start because
serverless functions don't maintain persistent database connections. Connection
poolers (PgBouncer, Neon's pooler, Supabase's pgBouncer) maintain a warm pool of
connections so each function invocation doesn't need to establish a new connection.
How does connection pooling interact with Prisma's query engine? What are the
trade-offs of connection pooling at the application layer vs. the infrastructure layer?

**3. Why `Promise.all` vs `Promise.allSettled`?**
`Promise.all` rejects immediately if any promise rejects (fail-fast). `Promise.allSettled`
waits for all promises and gives you each result (success or failure). For
`getProjectAccess`, if `currentUser()` fails (Clerk down) but the Prisma query
succeeds, should we still return null? Or should we let the user access their own
project without email verification? How does the choice between these two primitives
express your error-handling intent?

**4. Timeout placement — where in the call chain?**
The 5-second timeouts are set at the page/layout level, wrapping entire helper
function calls. An alternative is to set timeouts at the individual operation level
(e.g., 2s for Clerk, 3s for Prisma). What are the trade-offs? Which approach gives
better error messages and observability? Which is easier to tune?

**5. Reading sequential code as a performance smell**
In async codebases, sequential `await` chains are a performance smell when the
operations are independent. But they're also easier to read, test, and debug. How
do you balance code clarity against performance? Are there linting rules or code
review patterns that help catch unnecessary sequential awaits before they reach
production?
