# Fix: Deduplicate Collaborator Fetch Logic in `use-project-share.ts`

## What Was Wrong

Two places in `useProjectShare` fetched the collaborator list with identical
logic — the same URL, the same `res.ok` check, the same JSON parsing, and the
same error/loading state updates:

```ts
// Place 1: useEffect (lines 61–78)
useEffect(() => {
  if (!open) return
  setError(null)
  setIsLoading(true)
  fetch(`/api/projects/${projectId}/collaborators`)
    .then((r) => { if (!r.ok) throw new Error(); return r.json() })
    .then((data) => { setCollaborators(data); setIsLoading(false) })
    .catch(() => { setError("Failed to load collaborators"); setIsLoading(false) })
}, [open, projectId])

// Place 2: reloadCollaborators (lines 141–156) — exact same chain
async function reloadCollaborators() {
  setIsLoading(true)
  fetch(`/api/projects/${projectId}/collaborators`)
    .then((r) => { if (!r.ok) throw new Error(); return r.json() })
    .then((data) => { setCollaborators(data); setIsLoading(false) })
    .catch(() => { setError("Failed to load collaborators"); setIsLoading(false) })
}
```

This is classic **DRY (Don't Repeat Yourself)** violation. If you later need to
change the URL, add a header, change error wording, or add retry logic, you'd
have to remember to update both places. Forgetting one creates a subtle
inconsistency.

There was also a secondary issue: **the file had stray text accidentally
prepended** before the `"use client"` directive (lines 1–3 contained a previous
finding prompt embedded in the source). This was cleaned up.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `hooks/use-project-share.ts` | 61–78, 141–156 | Duplicated fetch logic | Fixed |
| `hooks/use-project-share.ts` | 1–3 | Stray text before `"use client"` | Fixed |

---

## How It Was Fixed

### Step 1: Extract a pure data-fetching helper

```ts
async function fetchCollaborators(): Promise<CollaboratorItem[]> {
  const res = await fetch(`/api/projects/${projectId}/collaborators`)
  if (!res.ok) throw new Error("Failed to load collaborators")
  return res.json()
}
```

This function only does the fetch and returns the data. It has **no side effects**
— it doesn't call `setState`, it doesn't manage loading flags. It either returns
`CollaboratorItem[]` or throws.

### Step 2: Both call sites use the helper

```ts
// useEffect — uses .then() chain (avoids lint about sync setState in effects)
useEffect(() => {
  if (!open) return
  setError(null)
  setIsLoading(true)
  fetchCollaborators()
    .then(setCollaborators)
    .catch(() => setError("Failed to load collaborators"))
    .finally(() => setIsLoading(false))
}, [open, projectId])

// reloadCollaborators — uses async/await
async function reloadCollaborators() {
  setError(null)
  setIsLoading(true)
  try {
    setCollaborators(await fetchCollaborators())
  } catch {
    setError("Failed to load collaborators")
  } finally {
    setIsLoading(false)
  }
}
```

Both call `fetchCollaborators()` and handle the result in their own style, but
the actual fetch logic (URL, ok-check, JSON parsing) lives in one place.

---

## Why This Approach (Decisions Made)

### Decision 1: Extract the fetch, not the fetch + setState

The first attempt extracted a `loadCollaborators()` function that included all
the `setState` calls. This triggered a lint error: the React compiler flagged
"calling setState synchronously within an effect" because it traced through the
function call and saw setState.

The solution was to make the helper a **pure data function** that returns a
promise — no side effects. Each call site manages its own state updates. This is
actually a better design:

| Approach | Pros | Cons |
|----------|------|------|
| Helper includes setState (first attempt) | Maximum deduplication | Triggers lint; couples data fetching to React state; harder to test |
| Helper returns data only (chosen) | Lint-clean; pure function; testable | Call sites repeat `setError`/`setIsLoading` (3 lines each) |

The small duplication of `setError`/`setIsLoading` at each call site is
acceptable — those are one-liner state updates that are trivially correct. The
**meaningful** logic (URL construction, response validation, JSON parsing) is
deduplicated.

### Decision 2: useEffect uses `.then()`, reloadCollaborators uses `async/await`

The useEffect could use either style. We chose `.then()` because:

1. React effects that return a cleanup function must return it synchronously.
   Making the effect callback `async` would return a Promise, which React
   ignores — meaning cleanup functions would silently not register.
2. The `.then()` style keeps `setState` calls in callbacks, which the linter
   considers "asynchronous" and doesn't flag.

`reloadCollaborators` is a standalone async function (not an effect callback),
so `async/await` is cleaner and more readable there.

### Decision 3: Clean up the stray text

Lines 1–3 contained a previous finding prompt accidentally embedded in the
source file. This isn't a code change — it's removing garbage that would cause a
syntax error or break the `"use client"` directive if it were ever parsed
without a preceding build step that strips it.

---

## Beginner Mental Model: When to Extract a Helper

A good rule of thumb for when to extract duplicated code into a helper:

```
Extract when ALL of these are true:
1. The same logic appears in 2+ places
2. The logic has meaningful complexity (not just a one-liner)
3. Changes to the logic should apply to all call sites

Don't extract when:
- The duplication is coincidental (two things happen to look alike today but
  serve different purposes and will diverge)
- The "helper" would need so many parameters that it's harder to read than
  the inline version
```

In this case, both fetch blocks:
- Hit the same URL ✓
- Perform the same validation ✓  
- Parse the same response type ✓
- Should always stay in sync ✓

That's a clear candidate for extraction.

### Pure functions vs. side-effectful helpers

When extracting, prefer **pure functions** (input → output, no side effects)
over functions that reach out and modify state. Pure functions are:

- Easier to test (call with input, check output)
- Easier to compose (chain with `.then()`, use with `await`)
- Less likely to trigger framework-specific lint rules
- Reusable in contexts that manage state differently

The pattern: `fetchThing()` returns data, callers decide what to do with it.

---

## Pre-existing Lint Note

The useEffect still has a pre-existing lint warning about `setError(null)` and
`setIsLoading(true)` being "synchronous setState in an effect." This was present
in the original code before this refactoring — the linter considers any
`setState` call directly in the effect body (not in a callback) as synchronous.
This is a legitimate data-fetching pattern and was not introduced by this change.

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `hooks/use-project-share.ts` | 1–3 | Removed stray text before `"use client"` |
| `hooks/use-project-share.ts` | 59–63 | New `fetchCollaborators()` pure helper |
| `hooks/use-project-share.ts` | 65–74 | useEffect now calls `fetchCollaborators()` |
| `hooks/use-project-share.ts` | 137–147 | `reloadCollaborators` now calls `fetchCollaborators()` |
