# Fix: Cancellable Collaborator Fetch (`hooks/use-project-share.ts`)

## Summary

Two fetch paths in `useProjectShare` had no cancellation support. If the component unmounted,
or `projectId`/`open` changed while a request was in-flight, React state setters would still
fire against stale or dead state. Rapid calls to `reloadCollaborators` could also let a slow
earlier response overwrite the result from a faster later one (a race condition).

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `hooks/use-project-share.ts` | 65–79 | `useEffect` fetch not cancelled on cleanup | Fixed |
| `hooks/use-project-share.ts` | 142–152 | `reloadCollaborators` no cancellation / no race guard | Fixed |

---

## Step 1 — Verification (Always Do This First)

Before touching code, confirm the issue exists in the current file. Reports can be stale.

### Check 1 — `useEffect` cleanup

```ts
// Before fix — the effect has no cleanup function at all
useEffect(() => {
  if (!open) return
  void (async () => {
    setIsLoading(true)
    try {
      setCollaborators(await fetchCollaborators())  // ← no way to cancel this
    } catch {
      setError("Failed to load collaborators")
    } finally {
      setIsLoading(false)                           // ← always fires, even after unmount
    }
  })()
}, [open, projectId])                              // ← no return value = no cleanup
```

No cleanup function is returned — confirmed valid.

### Check 2 — `reloadCollaborators`

```ts
// Before fix — plain async function, no tracking of previous calls
async function reloadCollaborators() {
  setIsLoading(true)
  try {
    setCollaborators(await fetchCollaborators())  // ← could be superseded by newer call
  } catch {
    setError("Failed to load collaborators")
  } finally {
    setIsLoading(false)
  }
}
```

No `AbortController`, no ref tracking of in-flight requests — confirmed valid.

### Check 3 — `fetchCollaborators`

```ts
async function fetchCollaborators(): Promise<CollaboratorItem[]> {
  const res = await fetch(`/api/projects/${projectId}/collaborators`)  // ← no signal
  if (!res.ok) throw new Error("Failed to load collaborators")
  return res.json()
}
```

Fetch has no `signal` option — browser cannot cancel the underlying network request.

All three checks confirmed the issue was real.

---

## The Bug Explained

### Problem 1: Setting state after unmount (or after re-render)

React effects run after a component renders. If the component unmounts before an async
operation completes, that operation may still call `setCollaborators`, `setIsLoading`, or
`setError`. In React 18+ this is silently ignored, but it is still wrong: you may be
updating state for a component instance that no longer exists, or updating a *new*
component instance with data from an *old* request.

```
Timeline (broken)
─────────────────────────────────────────────────────────
Dialog opens           → effect runs, fetch starts
User closes dialog     → component unmounts (no cleanup)
Fetch completes        → setCollaborators() fires  ← stale update!
                          setIsLoading(false) fires ← stale update!
```

### Problem 2: Race condition in `reloadCollaborators`

If `reloadCollaborators` is called twice quickly (e.g. user clicks Refresh twice), two
requests fly in parallel. The second request might finish before the first (network is
unpredictable). The first request then completes later and overwrites the second's result
with stale data:

```
Timeline (broken)
─────────────────────────────────────────────────────────
Call #1 starts         → fetches collaborators
Call #2 starts         → fetches collaborators (same endpoint)
Call #2 finishes       → setCollaborators([A, B, C])   ← correct
Call #1 finishes       → setCollaborators([A, B])      ← stale! overwrites correct data
```

### Why `fetch` can be cancelled

The browser's `fetch` API accepts an `AbortSignal` as part of its options. An
`AbortController` creates a matched `controller.abort()` / `controller.signal` pair.
Calling `abort()` triggers the signal, and the browser cancels the in-flight request,
causing the promise to reject with an `AbortError`.

```ts
const controller = new AbortController()
fetch(url, { signal: controller.signal })  // linked to controller
controller.abort()                          // cancels the request mid-flight
```

---

## The Fix

### Part 1 — `fetchCollaborators` accepts an optional signal

```ts
// Before
async function fetchCollaborators(): Promise<CollaboratorItem[]> {
  const res = await fetch(`/api/projects/${projectId}/collaborators`)
  if (!res.ok) throw new Error("Failed to load collaborators")
  return res.json()
}

// After
async function fetchCollaborators(signal?: AbortSignal): Promise<CollaboratorItem[]> {
  const res = await fetch(`/api/projects/${projectId}/collaborators`, { signal })
  if (!res.ok) throw new Error("Failed to load collaborators")
  return res.json()
}
```

Adding `signal?: AbortSignal` is purely additive — existing callers that pass nothing
still work. When a signal is passed and aborted, `fetch` throws an `AbortError`.

### Part 2 — A shared ref to track the most recent fetch controller

```ts
// Added alongside copyTimer ref
const latestFetchRef = useRef<AbortController | null>(null)
```

`useRef` holds a mutable value that persists across renders without triggering a
re-render. It is the right tool for "I need to remember the controller from the previous
render so I can cancel it." A `useState` would cause a re-render on every fetch start,
which is not what we want.

Both the `useEffect` and `reloadCollaborators` store their controllers here, so either
one can cancel the other if they happen to race.

### Part 3 — Cancellable `useEffect`

```ts
// Before
useEffect(() => {
  if (!open) return
  void (async () => {
    setError(null)
    setIsLoading(true)
    try {
      setCollaborators(await fetchCollaborators())
    } catch {
      setError("Failed to load collaborators")
    } finally {
      setIsLoading(false)
    }
  })()
}, [open, projectId])

// After
useEffect(() => {
  if (!open) return
  const controller = new AbortController()
  latestFetchRef.current = controller
  void (async () => {
    setError(null)
    setIsLoading(true)
    try {
      setCollaborators(await fetchCollaborators(controller.signal))
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError("Failed to load collaborators")
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  })()
  return () => { controller.abort() }
}, [open, projectId])
```

Four changes:

1. **Create a controller** — `new AbortController()` each time the effect runs.
2. **Store it in the ref** — so `reloadCollaborators` can cancel it if needed.
3. **Pass `controller.signal` to `fetchCollaborators`** — links the fetch to this controller.
4. **Return a cleanup function** — React calls this when the component unmounts OR before
   re-running the effect (e.g. when `projectId` or `open` changes). `controller.abort()`
   cancels any in-flight request.

**The `AbortError` guard in catch:**

```ts
if (err instanceof Error && err.name === "AbortError") return
```

When we deliberately abort, `fetch` throws `AbortError`. This is not a real error — it is
us cancelling the request. We return early (skip `setError`) so the user does not see a
spurious "Failed to load collaborators" message.

**The `signal.aborted` guard in finally:**

```ts
if (!controller.signal.aborted) setIsLoading(false)
```

`finally` always runs, even when we `return` early in `catch`. If we just said
`setIsLoading(false)` unconditionally, we would reset the loading state for a component
that may already be unmounted or may be in the middle of a new fetch (which has its own
`setIsLoading(true)`). Checking `signal.aborted` means: "only clear the loading state if
*this specific request* completed normally."

### Part 4 — Cancellable `reloadCollaborators`

```ts
// Before
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

// After
async function reloadCollaborators() {
  latestFetchRef.current?.abort()
  const controller = new AbortController()
  latestFetchRef.current = controller
  setError(null)
  setIsLoading(true)
  try {
    setCollaborators(await fetchCollaborators(controller.signal))
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return
    setError("Failed to load collaborators")
  } finally {
    if (!controller.signal.aborted) setIsLoading(false)
  }
}
```

The two new lines at the top:

```ts
latestFetchRef.current?.abort()   // cancel previous in-flight request (if any)
const controller = new AbortController()
latestFetchRef.current = controller
```

This is the "latest request wins" pattern. Before starting a new fetch, we cancel the
previous one. Only the newest controller can reach `setCollaborators` because all older
ones will throw `AbortError` and return early.

---

## What Did Not Change

- The public interface (`ProjectShareValue`) is identical — all return values have the
  same names and types.
- `handleInvite`, `handleRemove`, `handleCopy` are untouched.
- `copyTimer` and its cleanup effect are untouched.
- The `fetchCollaborators` signature change is backwards-compatible — the `signal`
  parameter is optional.

---

## Beginner Mental Model: `AbortController` and React Effects

### Think of it like a task ticket

Imagine each fetch is a task you hand to a courier:

- Without `AbortController`: once you hand the courier the task, you have no way to
  recall it. If you realize the task is stale (you closed the dialog), the courier still
  delivers the package to your door and you have to deal with it.
- With `AbortController`: you give the courier a phone number. If you call that number
  before they arrive, they drop the package and turn around. Nothing lands on your door.

### The React effect lifecycle

React effects follow a strict lifecycle that makes cleanup critical:

```
Component mounts         → effect runs → fetch starts
open/projectId changes   → cleanup runs (abort!) → effect re-runs → new fetch starts
Component unmounts       → cleanup runs (abort!) → no further state updates
```

The cleanup function returned from `useEffect` is React's built-in mechanism for
"undo the side-effect you started." Not returning one means React has no way to clean up
async work — leaking requests and potentially updating stale state.

### The three-guard pattern (memorise this)

Whenever you write an async fetch inside a React effect, use all three:

```ts
useEffect(() => {
  const controller = new AbortController()                    // 1. create controller

  void (async () => {
    try {
      const data = await fetch(url, { signal: controller.signal })  // 2. pass signal
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return  // 3a. ignore abort
      // handle real errors
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)           // 3b. guard finally
    }
  })()

  return () => { controller.abort() }                         // 3c. cleanup = abort
}, [deps])
```

Miss guard 3a and you show false error messages. Miss 3b and you clear loading state at
the wrong time. Miss 3c and cleanup never happens. All three work together.

---

## Files Changed

| File | Change |
|------|--------|
| `hooks/use-project-share.ts` | Added `latestFetchRef`; `fetchCollaborators` now accepts optional `signal`; `useEffect` creates controller, passes signal, and returns abort cleanup; `reloadCollaborators` cancels previous controller before starting new one |
