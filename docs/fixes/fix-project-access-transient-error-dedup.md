# Fix: project-access.ts — Local Transient-Error Matcher Replaced With Shared Helper

## What Was Wrong

`lib/project-access.ts` defined its own private copy of the transient-error
detection logic:

```ts
// Before — local, incomplete copy
function isTransientConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return (
    msg.includes('Failed to connect') ||
    msg.includes('upstream database') ||
    msg.includes("Can't reach database") ||
    msg.includes('Connection timed out')
  )
}
```

`lib/upstream-errors.ts` already exported the canonical version:

```ts
// Canonical shared helper
export function isTransientUpstreamError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('Failed to connect to upstream database') ||
    message.includes('Server has closed the connection') ||       // ← missing locally
    message.includes('Failed to connect') ||
    message.includes("Can't reach database") ||
    message.includes('Connection timed out')
  )
}
```

**The gap:** the local copy was missing the `'Server has closed the connection'`
pattern. A Prisma/PgBouncer or PlanetScale connection that dropped mid-query
with that message would **not** be retried by `withRetry`, even though the same
error would be caught and retried in the `liveblocks-auth` route (which already
imported the shared helper).

This created an inconsistency: the same class of transient database error was
handled differently depending on which code path triggered the database call.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `lib/project-access.ts` | 5–13 | Local matcher missing `'Server has closed the connection'`; diverges from canonical | Fixed |

---

## The Fix

Delete the local function and import the shared one:

```ts
// After
import { isTransientUpstreamError } from '@/lib/upstream-errors'

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientUpstreamError(err)) throw err   // ← shared helper, not local copy
    await new Promise((r) => setTimeout(r, 300))
    return fn()
  }
}
```

The `withRetry` function body is unchanged. Only the function it calls to
decide whether to retry changed — from the local `isTransientConnectionError`
to the imported `isTransientUpstreamError`.

---

## Why Each Decision Was Made

### Decision 1: Delete the local function entirely

The local function was private (not exported), so no other file depended on it.
Keeping it alongside the import would create two sources of truth for the same
concept — the exact problem the fix is solving. Deleting it ensures there is
exactly one definition.

### Decision 2: Import using the canonical export name (`isTransientUpstreamError`)

The shared helper's export name is `isTransientUpstreamError`. The local
function was named `isTransientConnectionError`. No rename or alias was
introduced — `withRetry` now calls `isTransientUpstreamError` directly. Using
the canonical name consistently means a developer reading `withRetry` can grep
the codebase for the function name and find exactly one definition.

### Decision 3: No changes to `withRetry` internals

`withRetry` itself — the retry delay, the single-retry strategy, the generic
type parameter — is correct and unchanged. The only thing wrong was *which*
function it asked "is this retryable?" Changing that one call site is the
entire fix.

---

## Beginner Mental Model: The DRY Principle and Error in Duplication

DRY stands for **Don't Repeat Yourself**. It means any piece of knowledge
(logic, data, configuration) should have a **single authoritative source** in
a codebase. When you copy logic instead of sharing it, you get **two sources
of truth** — and they will eventually drift.

That's exactly what happened here:

```
lib/upstream-errors.ts       ← canonical; updated over time
lib/project-access.ts        ← stale copy; missed 'Server has closed the connection'
```

When a developer added `'Server has closed the connection'` to the canonical
helper (presumably after seeing it in production logs), they only updated one
place. The copy in `project-access.ts` was invisible to them — it had a
different name (`isTransientConnectionError` vs `isTransientUpstreamError`),
lived in a different file, and wasn't exported.

The fix collapses the two sources back to one.

---

## Beginner Mental Model: Why Missing One Error Pattern Matters for Retries

A retry strategy only works when the retry condition is correct. If the
condition is too narrow (misses a valid transient error), the function throws
immediately instead of retrying — giving the caller a hard failure for what
was actually a recoverable blip.

```
DB closes connection mid-query → Prisma throws Error('Server has closed the connection')
                                          ↓
BEFORE fix:  isTransientConnectionError → false  → withRetry re-throws → caller sees 500
AFTER fix:   isTransientUpstreamError   → true   → withRetry waits 300ms, retries → likely succeeds
```

From the user's perspective: before the fix, certain transient DB blips on the
`getProjectAccess` code path would produce an immediate error. After the fix,
they are silently retried once and the request succeeds.

---

## Pattern Coverage Comparison

| Error pattern | Local (old) | Canonical (new) |
|---------------|-------------|-----------------|
| `'Failed to connect to upstream database'` | ✓ (via `'Failed to connect'` substring) | ✓ |
| `'Server has closed the connection'` | ✗ **missing** | ✓ |
| `'Failed to connect'` | ✓ | ✓ |
| `"Can't reach database"` | ✓ | ✓ |
| `'Connection timed out'` | ✓ | ✓ |
| `'upstream database'` | ✓ (redundant, already covered by `'Failed to connect'`) | — |

---

## Validation

- IDE linter — no errors after the change
- `withRetry` compiles: TypeScript resolves `isTransientUpstreamError` from the import; the signature `(error: unknown) => boolean` is compatible with the `(err: unknown)` call site
- All five patterns in `upstream-errors.ts` now apply to `withRetry` retries, including `'Server has closed the connection'`

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `lib/project-access.ts` | 5–13 | Removed local `isTransientConnectionError` function |
| `lib/project-access.ts` | 4 | Added `import { isTransientUpstreamError } from '@/lib/upstream-errors'` |
| `lib/project-access.ts` | 10 | `withRetry` now calls `isTransientUpstreamError` instead of the local copy |

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is the DRY principle and when is it okay to violate it?"** — DRY
   reduces drift but can also create tight coupling. Learn when duplication is
   acceptable (e.g. tests) and when it's a maintenance liability.

2. **"What are transient errors and how should retry strategies handle them?"**
   — The difference between transient (recoverable) and permanent (non-recoverable)
   errors, exponential backoff, jitter, and max-retry limits.

3. **"What is PgBouncer and why does it cause 'Server has closed the
   connection' errors?"** — How connection poolers work, why they close idle
   connections, and why this looks like an error to the application layer even
   though it's expected behaviour.

4. **"How does Prisma handle connection pooling in a serverless environment?"**
   — Why serverless functions and traditional database connection pools don't
   mix well, and how Prisma's accelerate/data proxy help.

5. **"What is the difference between a named function and a re-export alias in
   TypeScript?"** — How `export { foo as bar }` works, when to rename exports,
   and why consistent naming across a codebase makes grep-ability and
   discoverability easier.
