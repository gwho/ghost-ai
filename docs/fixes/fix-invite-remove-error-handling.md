# Fix: Unhandled Rejections and Stuck Loading in `handleInvite` / `handleRemove`

## Summary

`handleInvite` called `setIsLoading(false)` at the bottom of the function body with no
`try/catch/finally`. A network error thrown by `fetch` would skip that line entirely, leaving
`isLoading` permanently stuck at `true`. `handleRemove` had no error handling at all —
a network failure produced an unhandled promise rejection and the user saw no feedback.

| File | Function | Issue | Status |
|------|----------|-------|--------|
| `hooks/use-project-share.ts` | `handleInvite` | Network throw skips `setIsLoading(false)`; no catch for fetch/JSON errors | Fixed |
| `hooks/use-project-share.ts` | `handleRemove` | No try/catch; network failure is unhandled rejection; non-ok response is silent | Fixed |

**Skipped finding:** The report also asked to update `reloadCollaborators` and `useEffect`
with an AbortController guard. Both were already fully implemented in the previous session
(`latestFetchRef`, signal passing, `AbortError` guard, `signal.aborted` finally guard).
No change needed.

---

## Step 1 — Verification (Always Do This First)

### `handleInvite` — is `setIsLoading(false)` reachable on throw?

```ts
// Before
async function handleInvite() {
  ...
  setIsLoading(true)
  const res = await fetch(...)   // ← throws on network error
  if (res.ok) { ... }
  else { ... }
  setIsLoading(false)            // ← unreachable if fetch() threw
}
```

`await fetch(...)` on line 123 can throw (no network, DNS failure, CORS). If it does,
execution jumps out of the function — the final `setIsLoading(false)` on line 136 is
never reached. `isLoading` stays `true` forever.

Confirmed: no `try`, no `finally`, `setIsLoading(false)` is at the bottom of the function
body not in a `finally` block.

### `handleRemove` — is the rejection handled?

```ts
// Before
async function handleRemove(collaboratorId: string) {
  const res = await fetch(...)   // ← throws on network error, no catch anywhere
  if (res.ok) { setCollaborators(...) }
  // non-ok response: silently ignored
}
```

No `try/catch` anywhere in the function. If `fetch` throws, the async function returns a
rejected promise. Nothing in the call chain catches it — it becomes an unhandled rejection.
Non-ok HTTP responses (e.g. 403, 500) are silently swallowed: the list appears unchanged
with no error message.

Both confirmed valid.

---

## The Bugs Explained

### Bug 1: Stuck loading state (`handleInvite`)

`async function` bodies run sequentially line by line until they `await`. If a line throws,
JavaScript immediately exits the function — it does not run any remaining lines. There is no
such thing as a "line at the bottom that always runs" unless you put it in a `finally` block.

```
Timeline (broken):
────────────────────────────────────────────────────────
setIsLoading(true)               ← isLoading = true
await fetch(...)                 ← throws (no network)
                                   ↳ function exits immediately
setIsLoading(false)              ← NEVER REACHED
                                   ↳ isLoading stays true forever
User sees: spinner that never stops
```

The fix is `try/catch/finally`:

```
Timeline (fixed):
────────────────────────────────────────────────────────
setIsLoading(true)
try { await fetch(...) }         ← throws
catch { setError(...) }          ← error surfaced to user
finally { setIsLoading(false) }  ← ALWAYS runs, even after throw
```

`finally` is the JavaScript guarantee: "run this block no matter what happened before."
It runs after a normal return, after a throw, and after an explicit `return` inside
`try` or `catch`.

### Bug 2: Unhandled promise rejection (`handleRemove`)

In JavaScript, any `async` function that throws returns a rejected `Promise`. If nothing
`.catch()`es that promise (or `await`s it inside a `try/catch`), the runtime logs
"UnhandledPromiseRejection" and the error is silently swallowed in most environments.

In React, if this happens inside an event handler (like a button's `onClick`), the error
does not bubble to an error boundary — the component continues rendering as if nothing
happened.

The user experience: they click Remove, nothing happens, no error message.

### Why non-ok responses aren't errors by default

`fetch` only throws for network-level failures (no connection, DNS failure, timeout,
CORS block). A server responding with 403, 404, or 500 is a successful network round-trip
from `fetch`'s perspective — it resolves the promise with a `Response` whose `.ok` is
`false`. You must check `res.ok` yourself and decide what to do.

The original `handleRemove` checked `res.ok` to update the list on success, but did nothing
on failure — the `else` branch was missing entirely.

---

## The Fix

### `handleInvite` — before vs. after

```ts
// Before
async function handleInvite() {
  const email = inviteEmail.trim()
  if (!email) return
  setError(null)
  setIsLoading(true)
  const res = await fetch(`/api/projects/${projectId}/collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (res.ok) {
    const newCollab: CollaboratorItem = await res.json()
    setCollaborators((prev) => [...prev, newCollab])
    setInviteEmail("")
  } else {
    const data = await res.json().catch(() => ({}))
    setError((data as { error?: string }).error ?? "Failed to invite collaborator")
  }
  setIsLoading(false)   // ← can be skipped on throw
}

// After
async function handleInvite() {
  const email = inviteEmail.trim()
  if (!email) return
  setError(null)
  setIsLoading(true)
  try {
    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const newCollab: CollaboratorItem = await res.json()
      setCollaborators((prev) => [...prev, newCollab])
      setInviteEmail("")
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? "Failed to invite collaborator")
    }
  } catch {
    setError("Failed to invite collaborator")   // ← network/parse errors surfaced
  } finally {
    setIsLoading(false)                         // ← guaranteed to run
  }
}
```

The logic inside the try block is identical to before. The only structural change is
wrapping it in `try/catch/finally` and moving `setIsLoading(false)` into `finally`.

### `handleRemove` — before vs. after

```ts
// Before
async function handleRemove(collaboratorId: string) {
  const res = await fetch(
    `/api/projects/${projectId}/collaborators/${collaboratorId}`,
    { method: "DELETE" }
  )
  if (res.ok) {
    setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
  }
  // non-ok: silent
  // throw: unhandled rejection
}

// After
async function handleRemove(collaboratorId: string) {
  try {
    const res = await fetch(
      `/api/projects/${projectId}/collaborators/${collaboratorId}`,
      { method: "DELETE" }
    )
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
    } else {
      setError("Failed to remove collaborator")   // ← non-ok surfaced
    }
  } catch {
    setError("Failed to remove collaborator")     // ← network throw surfaced
  }
}
```

No `isLoading` added — `handleRemove` never set `isLoading(true)` before and adding it
now would be scope creep beyond what the report asked for. The fix is minimal:
try/catch + setError for both failure paths.

---

## What Did Not Change

- `reloadCollaborators` and the open/projectId `useEffect` — already had full
  `AbortController` cancellation from the previous fix session; no changes needed.
- `handleCopy` — has its own `try/catch` pattern and no loading state; untouched.
- The public `ProjectShareValue` interface — unchanged.
- `fetchCollaborators` — unchanged.

---

## Beginner Mental Model: `try/catch/finally` and async functions

### The three blocks

```ts
try {
  // code that might throw
} catch (err) {
  // runs only if try throws
  // err is the thrown value
} finally {
  // ALWAYS runs: after try succeeds, after catch runs, or even if catch re-throws
}
```

In synchronous code you can write cleanup at the bottom of a function:

```ts
function doThing() {
  start()
  doWork()   // if this throws, stop() is never called
  stop()
}
```

With async code this is even more dangerous because `await` adds more throw points.
Any `await` expression can throw — not just your own code but anything the runtime
does (network, JSON parse, timeout). `finally` is the only reliable way to say
"this must run no matter what."

### "Unhandled rejection" — what actually happens

In a browser, an unhandled rejection fires the global `unhandledrejection` event.
In Node.js, it logs a warning (and in older versions, crashes the process).
In React, it does NOT bubble to an error boundary — error boundaries only catch
synchronous render errors and lifecycle throws, not async event handlers.

The practical consequence: your component keeps running as if nothing happened. The
user clicks Remove, the button responds, but the collaborator list doesn't update and
no error message appears. The problem only shows up in the browser console, which
users never see.

Wrapping in `try/catch` converts the unhandled rejection into a handled one, and
calling `setError(...)` in the catch block makes the failure visible in the UI.

### The minimal async fetch pattern

Every async fetch in a React hook or event handler should follow this shape:

```ts
async function doSomething() {
  setIsLoading(true)          // only if this operation shows a spinner
  try {
    const res = await fetch(url, options)
    if (res.ok) {
      // handle success
    } else {
      setError("Something failed")
    }
  } catch {
    setError("Something failed")  // network/parse errors
  } finally {
    setIsLoading(false)           // always clear the spinner
  }
}
```

The catch and else branches often have the same message — that's fine. They handle
different failure modes (network vs. server) but from the user's perspective the
outcome is the same.

---

## Files Changed

| File | Function | Change |
|------|----------|--------|
| `hooks/use-project-share.ts` | `handleInvite` | Wrapped body in `try/catch/finally`; `setIsLoading(false)` moved to `finally`; `catch` calls `setError` |
| `hooks/use-project-share.ts` | `handleRemove` | Wrapped in `try/catch`; added `else { setError(...) }` for non-ok responses; `catch` calls `setError` |
