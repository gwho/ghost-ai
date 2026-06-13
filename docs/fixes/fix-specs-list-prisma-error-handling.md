# Fix: Specs List Route — Handle Prisma Failures with 500

## What Was Wrong

The `GET /api/projects/[projectId]/specs` handler in
`app/api/projects/[projectId]/specs/route.ts` called
`prisma.projectSpec.findMany(...)` with no error handling:

```ts
// Before — uncaught Prisma errors bubble up as unhandled rejections
const specs = await prisma.projectSpec.findMany({
  where: { projectId },
  orderBy: { createdAt: 'desc' },
  select: { id: true, filePath: true, createdAt: true },
})

return NextResponse.json({ specs })
```

**Symptom:** When the database was unavailable, the migration was missing, or
Prisma threw for any transient reason, the route did not return a structured
JSON error. The request failed as an unhandled exception instead of a proper
`500` response. The AI sidebar Specs tab shows "Failed to load specs. Please
try again." whenever `fetch` receives `!res.ok` — but that only works if the
route returns a real HTTP error response rather than crashing.

**Test gap:** `__tests__/api/projects/specs.test.ts` covered happy paths (200
with specs, 200 with empty array) and auth (401/404) but had no test for database
failure.

| File | Issue | Status |
|------|-------|--------|
| `app/api/projects/[projectId]/specs/route.ts` | No try/catch around `findMany` | Fixed |
| `__tests__/api/projects/specs.test.ts` | No test for Prisma rejection → 500 | Fixed |

---

## The Fix

### Route — wrap Prisma call in try/catch

```ts
let specs
try {
  specs = await prisma.projectSpec.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, filePath: true, createdAt: true },
  })
} catch (error) {
  console.error('[specs] failed to load specs', error)
  return NextResponse.json({ error: 'Failed to load specs' }, { status: 500 })
}

return NextResponse.json({ specs })
```

### Test — mock Prisma rejection in `spec listing` block

```ts
it('returns 500 when Prisma findMany fails', async () => {
  mockPrismaProjectSpecFindMany.mockRejectedValueOnce(new Error('Database connection failed'))

  const res = await GET(makeRequest(), makeParams('project-123'))
  const body = await res.json()

  expect(res.status).toBe(500)
  expect(body).toEqual({ error: 'Failed to load specs' })
})
```

Uses existing helpers and mocks: `mockPrismaProjectSpecFindMany`, `GET`,
`makeRequest`, `makeParams`. The `beforeEach` in `spec listing` already grants
project access so the test isolates the Prisma failure path.

---

## Why This Fix Was Chosen

1. **Minimal scope** — Only the database read is wrapped. Auth checks (401/404)
   stay outside the try block so those paths are unchanged.
2. **Consistent with UI** — The sidebar treats any non-OK response as a load
   failure and shows a retry message. A structured 500 is easier to debug than
   an opaque framework error page.
3. **Server-side logging** — `console.error` preserves the real exception for
   logs while the client gets a safe, generic message (no stack traces or
   connection strings leaked).
4. **Test-driven verification** — `mockRejectedValueOnce` simulates a DB outage
   without needing a real database failure in CI.

---

## Beginner Mental Model: Errors at the API Boundary

An API route handler sits between the client and backend services (database,
blob storage, external APIs). Each layer can fail independently:

```
Client  ──GET /specs──▶  Route handler  ──findMany──▶  PostgreSQL
                              │
                              ├── 401  not authenticated
                              ├── 404  no project access
                              ├── 200  success
                              └── 500  database error  ◀── this fix
```

**Uncaught async errors** in Next.js route handlers propagate as failed
requests. The client may see a generic error or timeout instead of JSON with
`{ error: "..." }`. Wrapping I/O in try/catch lets you:

- Choose the HTTP status code (`500` for server-side failures)
- Return a predictable JSON shape the frontend can handle
- Log the real cause server-side for debugging

**500 vs 503:** Use `500` for unexpected internal failures (DB query threw).
Use `503` when a dependency is temporarily unavailable but the service logic
is sound (e.g. blob fetch timeout). This route uses `500` for Prisma errors
because they indicate the persistence layer failed during a normal read.

---

## How the Sidebar Consumes This

In `components/editor/ai-sidebar.tsx`, `fetchSpecs` does:

```ts
const res = await fetch(`/api/projects/${roomId}/specs`)
if (!res.ok) throw new Error('fetch-failed')
```

Any status outside 2xx triggers the catch block and sets
`specsError` to "Failed to load specs. Please try again." The Retry button
re-calls `fetchSpecs`. A proper 500 response keeps this flow working reliably.

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is the difference between 500, 502, and 503 in REST APIs, and
   when should a Prisma error map to each?"** — Walk through connection refused,
   query timeout, and schema mismatch scenarios.

2. **"How does Vitest `mockRejectedValueOnce` simulate async failures, and why
   is it better than skipping the test when you don't have a real DB?"** —
   Unit vs integration testing trade-offs.

3. **"Where should try/catch live in a Next.js App Router route — around the
   whole handler or only around I/O calls?"** — Compare wrapping everything vs
   granular catches for auth vs database vs external APIs.

4. **"What information is safe to return in a 500 JSON body vs what must stay
   in server logs only?"** — Error message design and security (no SQL leaks).

5. **"How would you add retry logic or circuit breaking for transient Prisma
   connection errors without changing the client?"** — Resilience patterns at
   the data layer.

6. **"How do mock call order and `beforeEach` setup affect test isolation when
   testing failure paths after happy-path tests?"** — Vitest mock lifecycle.

---

## Validation

```
npx vitest run __tests__/api/projects/specs.test.ts
```

- 10/10 tests pass (including new Prisma failure test)
- IDE linter — no errors on changed files

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/projects/[projectId]/specs/route.ts` | try/catch around `findMany`; return 500 with `{ error: 'Failed to load specs' }` |
| `__tests__/api/projects/specs.test.ts` | Added `returns 500 when Prisma findMany fails` in `spec listing` |
| `docs/fixes/fix-specs-list-prisma-error-handling.md` | This document |
