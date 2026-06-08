# Tutorial: React Strict Mode and the isMounted Antipattern

## What You'll Learn

- What React Strict Mode does and why it exists
- How the simulated unmount/remount cycle works
- How ref values survive the cycle in a way that breaks common patterns
- Why the `isMounted` pattern is an antipattern in React 18
- The correct modern replacement

---

## Part 1: What Is React Strict Mode?

React Strict Mode is a development-only tool. You enable it by wrapping your app
in `<React.StrictMode>`. In Next.js, this is on by default in all development builds.

**It does nothing in production.** There is zero runtime cost in production builds.
It is purely a development helper.

Its goal: find bugs that are hard to see by looking at the code alone — specifically
bugs that only appear when components mount, unmount, and remount in ways that
production traffic patterns make likely.

---

## Part 2: The Double-Invocation of Effects

In React 18 with Strict Mode, every `useEffect` runs twice on mount — not because
your component renders twice, but because React simulates a full mount → cleanup →
remount cycle:

```
Component mounts for real
  ↓
Effects run (first time)
  ↓
React simulates unmount: all effect cleanup functions run
  ↓
React simulates remount: effects run again (second time)
  ↓
Component is now "settled" — normal lifecycle from here
```

This is intentional. If your code survives this cycle without breaking, it's a
strong signal that your cleanup functions work correctly.

**A simple example of a CORRECT effect:**

```ts
useEffect(() => {
  const subscription = subscribe(projectId)

  return () => {
    subscription.unsubscribe()   // cleanup
  }
}, [projectId])
```

If this runs twice:
1. Subscribe → unsubscribe (simulated cleanup) → subscribe again (simulated remount)
2. On actual unmount: unsubscribe ✓

No bugs, because the effect is "resumable." It can be torn down and restarted safely.

---

## Part 3: How Refs Survive the Cycle

`useRef` creates a single mutable object for the component's entire lifetime:

```ts
const countRef = useRef(0)
```

This creates `{ current: 0 }` once. The SAME object persists across every render,
every re-render, AND across Strict Mode's simulated unmount/remount.

Unlike state, refs are NOT reset between the first and second effect runs in Strict
Mode. State setters are idempotent (calling `setState(x)` is always safe). Ref
mutations are not — they leave behind whatever value was written.

This matters enormously for any pattern that uses a ref to track lifecycle state.

---

## Part 4: The `isMounted` Pattern (React 16 Era)

In React 16, calling `setState` on an unmounted component logged a warning:

```
Warning: Can't perform a React state update on an unmounted component.
This is a no-op, but it indicates a memory leak in your application.
```

Developers responded by tracking whether the component was still mounted:

```ts
const isMounted = useRef(true)

useEffect(() => {
  return () => {
    isMounted.current = false   // cleanup: mark as unmounted
  }
}, [])

async function fetchData() {
  const data = await fetch('/api/...')
  if (!isMounted.current) return   // don't setState if unmounted
  setData(data)
}
```

This worked in React 16 because there was no Strict Mode double-invocation.

---

## Part 5: Why This Breaks in React Strict Mode

Let's trace through what actually happens with Strict Mode enabled:

```
Step 1 — Component mounts
  isMounted = useRef(true)   → creates { current: true }

Step 2 — Effects run (first time)
  useEffect(() => () => { isMounted.current = false }, [])
  → registers cleanup function

Step 3 — Strict Mode: simulated unmount — cleanup runs
  isMounted.current = false   ← mutation to the SAME object

Step 4 — Strict Mode: effects re-run (second time)
  useEffect(() => () => { isMounted.current = false }, [])
  → registers cleanup again
  → BUT: nothing in the effect BODY resets isMounted back to true!

Step 5 — isMounted.current is now permanently false
```

From this point on, any code that checks `if (!isMounted.current) return` will
ALWAYS return early. Even though the component is actively mounted and working,
the ref says it's not.

**This is a silent bug.** The code compiles. No errors are thrown. Effects appear
to register. But any function gated by `isMounted.current` is a permanent no-op.

---

## Part 6: React 18 Fixed the Root Problem

In React 18, the team made a deliberate decision: calling `setState` on an unmounted
component is now a **silent no-op**. No warning. No error. No crash. React simply
discards the update.

The warning that the `isMounted` pattern was designed to suppress no longer exists.

React 18 also introduced Concurrent Mode features (transitions, Suspense with
offscreen, etc.) where components may be "unmounted" temporarily and then remounted.
In that world, the old warning was not just noisy — it was factually wrong. A
component being temporarily hidden is not a "memory leak."

**The `isMounted` pattern is now:**
1. Unnecessary — React 18 handles it
2. Actively harmful — breaks under Strict Mode

---

## Part 7: The Correct Modern Replacement

If you need to cancel in-flight async work when a component unmounts, use
`AbortController`. This cancels the actual network request — more efficient than
just ignoring its result.

```ts
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(data => {
      setData(data)   // safe in React 18 — no-op if unmounted
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        setError(err)   // also safe
      }
    })

  return () => {
    controller.abort()   // cancels the in-flight request
  }
}, [])
```

Why this is better:
- The fetch is actually cancelled — no wasted bandwidth or server processing
- Works correctly under Strict Mode (abort → re-fetch cycle is clean)
- `AbortError` is distinguishable from real failures — you can handle them differently
- `setState` calls are safe without any manual guard

---

## Part 8: The Pattern That Actually Broke Ghost AI

In `hooks/use-canvas-autosave.ts`, the canvas save function was wrapped in an
`isMounted` guard:

```ts
const save = useCallback(async () => {
  if (!isMounted.current) return   // ← always true after Strict Mode cycle
  setSaveStatus('saving')          // ← never reached
  await fetch('/api/projects/...')  // ← never called
}, [projectId])
```

After the Strict Mode simulated cleanup ran (setting `isMounted.current = false`),
every call to `save()` — whether from the autosave debounce or from the Save button
click — exited immediately. The button label never changed. Nothing was saved to
Vercel Blob. The feature was completely broken in development.

The fix was one conceptual change: remove `isMounted` entirely. Three guard lines
deleted. The hook became simpler and correct.

---

## Summary

| | React 16 | React 18 |
|---|---|---|
| `setState` on unmounted | Warning logged | Silent no-op |
| `isMounted` pattern | Works around the warning | Breaks under Strict Mode |
| Strict Mode effects | Not in React 16 | Double-invoked to find bugs |
| Correct approach | `isMounted` guard | No guard needed; use AbortController for fetch cancel |

**Rule:** If you see `isMounted = useRef(true)` in a React 18 codebase, delete it.
The ref is a React 16 relic. If the code under the guard does network requests and
you want to cancel them on unmount, replace with `AbortController`.
