# Fix: Collaborators Fetch Missing `r.ok` Check (`share-dialog.tsx`)

## Summary

The `useEffect` that loads collaborators when the dialog opens called `r.json()`
unconditionally. A non-OK API response (e.g. `{ error: "Unauthorized" }`) was cast
to `CollaboratorItem[]` and written into state, which would crash the `.map()` in the
render. Errors were also silently swallowed with no feedback. Added an `r.ok` guard
and surfaced the failure through the existing `error` state.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `components/editor/share-dialog.tsx` | 102–112 | No `r.ok` check; errors silently discarded | Fixed |

---

## Step 1 — Verification

```ts
// Before — lines 102-112
useEffect(() => {
  if (!open) return
  setIsLoading(true)
  fetch(`/api/projects/${projectId}/collaborators`)
    .then((r) => r.json())                       // ← no r.ok check
    .then((data: CollaboratorItem[]) => {
      setCollaborators(data)                     // ← sets state with whatever came back
      setIsLoading(false)
    })
    .catch(() => setIsLoading(false))            // ← swallows error silently
}, [open, projectId])
```

Two problems confirmed:

1. **No `r.ok` check.** The Fetch API only rejects its promise for network-level
   failures (no connection, DNS failure, etc.). HTTP error responses — 401, 403, 500 —
   resolve successfully with `r.ok === false`. Calling `r.json()` on them parses the
   error payload (e.g. `{ error: "Unauthorized" }`) and the `.then` receives that
   object. TypeScript's type assertion `(data: CollaboratorItem[])` is compile-time
   only — it does not validate the shape at runtime. The object gets written into
   `collaborators` state as if it were a valid array.

2. **Crash site.** Line 240 renders `collaborators.map((c) => ...)`. If `collaborators`
   holds `{ error: "Unauthorized" }` instead of an array, `.map` is not a function and
   React throws, crashing the dialog.

3. **Silent catch.** The `.catch` only reset `isLoading`. No error message was ever
   shown to the user.

---

## The Bug Explained

### Why `fetch` doesn't throw on HTTP errors

This is one of the most common JavaScript gotchas. The native `fetch` API was designed
to mirror how HTTP actually works: a 401 or 500 is a valid, complete HTTP response —
the server replied, the connection worked. Only a failure to get any response at all
(network down, request aborted, CORS block) causes the promise to reject.

```
fetch('/api/...')
  ├── Network error (no response)   → Promise rejects → .catch fires
  └── HTTP response (any status)    → Promise resolves → .then fires
        ├── r.ok === true  (2xx)    → safe to parse
        └── r.ok === false (4xx/5xx) → still resolves, but body is an error payload
```

Calling `r.json()` on a non-OK response parses the error body. That body is typically
an object like `{ error: "Unauthorized" }` — not an array. Treating it as one breaks
any code that calls `.map`, `.filter`, `.length`, etc.

### Why TypeScript didn't catch it

The type annotation `(data: CollaboratorItem[])` in the `.then` callback is an
**assertion**, not a validation. TypeScript trusts you that `data` will be a
`CollaboratorItem[]`. It cannot verify this at runtime because TypeScript is erased at
compile time — there is no type information left when the code actually runs. If the
API returns something else, JavaScript has no idea and happily stores the wrong shape.

The rule: **never trust the shape of data from an external source** (API, user input,
local storage). Always guard before using it.

---

## The Fix

### Before

```ts
useEffect(() => {
  if (!open) return
  setIsLoading(true)
  fetch(`/api/projects/${projectId}/collaborators`)
    .then((r) => r.json())
    .then((data: CollaboratorItem[]) => {
      setCollaborators(data)
      setIsLoading(false)
    })
    .catch(() => setIsLoading(false))
}, [open, projectId])
```

### After

```ts
useEffect(() => {
  if (!open) return
  setError(null)
  setIsLoading(true)
  fetch(`/api/projects/${projectId}/collaborators`)
    .then((r) => {
      if (!r.ok) throw new Error()
      return r.json()
    })
    .then((data: CollaboratorItem[]) => {
      setCollaborators(data)
      setIsLoading(false)
    })
    .catch(() => {
      setError('Failed to load collaborators')
      setIsLoading(false)
    })
}, [open, projectId])
```

Three changes:

1. **`setError(null)` at the top** — clears any error from a previous open/close
   cycle so a successful reload doesn't leave a stale error banner visible.

2. **`if (!r.ok) throw new Error()`** — converts a non-OK HTTP response into a
   rejection, so the `.then` that calls `setCollaborators` is only reached when the
   response is genuinely a valid array.

3. **`setError('Failed to load collaborators')` in `.catch`** — surfaces the failure
   through the existing `error` state that already has a display path in the JSX
   (`{error && <p className="text-sm text-error">{error}</p>}`).

No new state variables, no JSX changes. The `error` state and its display were already
present for the invite flow — reusing them here keeps the implementation minimal.

---

## What Did Not Change

- The `handleInvite` function, which already had a correct `r.ok` check and error
  handling pattern, is untouched.
- The `handleRemove` function is untouched.
- No JSX changes.

---

## Beginner Mental Model: The Three Sources of Fetch Failures

When using `fetch`, there are three distinct failure modes and each needs its own
handling:

```
1. Network failure      → fetch() rejects → .catch fires
   (no connection, DNS, CORS, timeout)

2. HTTP error response  → fetch() resolves, r.ok === false → need manual check
   (401, 403, 404, 500, …)

3. Bad response body    → r.json() rejects → .catch fires
   (response is not valid JSON)
```

A `.catch` alone only handles cases 1 and 3. Case 2 — which includes nearly all
application-level errors like auth failures, not-found, server crashes — falls
silently through without a check on `r.ok`.

The minimal safe pattern for any fetch that returns JSON:

```ts
fetch(url)
  .then((r) => {
    if (!r.ok) throw new Error()   // turns case 2 into a rejection
    return r.json()                // safe to parse — we know it's a success response
  })
  .then((data) => {
    // use data here
  })
  .catch(() => {
    // handles all three failure modes
  })
```

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `components/editor/share-dialog.tsx` | 102–117 | Added `r.ok` guard; `setError` on failure; `setError(null)` reset on open |
