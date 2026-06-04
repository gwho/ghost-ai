# Fix: Issue 1b — isMounted Breaks Save in Strict Mode

## What Was Broken

After the initial Issue 1 implementation, clicking the Save button did nothing.
The button label never changed. Autosave also silently did nothing. No data ever
appeared in the Vercel dashboard.

---

## Root Cause — Step by Step

### 1. The `isMounted` pattern

The `useCanvasAutosave` hook contained this code:

```ts
const isMounted = useRef(true)

useEffect(() => {
  return () => {
    isMounted.current = false   // cleanup runs on unmount
  }
}, [])

const save = useCallback(async () => {
  if (!isMounted.current) return   // ← always returned here
  setSaveStatus('saving')
  // ...fetch...
}, [projectId])
```

The intent was: if the component unmounts while a save is in-flight, don't try to
call `setSaveStatus` afterwards (which would cause a "setState on unmounted
component" warning in older React).

### 2. React Strict Mode's double-invocation

In development, Next.js enables **React Strict Mode**. Strict Mode intentionally
runs every effect TWICE to help find bugs:

```
1. Component mounts
2. Effects run (first time)
   → cleanup registered: () => { isMounted.current = false }
3. Strict Mode: simulated unmount — cleanup runs
   → isMounted.current = false
4. Strict Mode: effects re-run (second time)
   → cleanup registered again, but nothing sets isMounted back to true
5. Now: isMounted.current = false ... forever
```

### 3. Why the ref never resets

`useRef` creates ONE object for the component's lifetime. Even during the Strict
Mode simulated unmount/remount, it is the SAME ref object. The only code that ever
touches `isMounted` is the cleanup function (`= false`) — nothing sets it back to
`true` after the Strict Mode cycle.

### 4. Why every call to `save()` was a silent no-op

After Strict Mode completes its cycle, `isMounted.current` is permanently `false`.
Every time `save()` runs — whether from the debounce or from the Save button —
it hits the guard and returns immediately:

```ts
if (!isMounted.current) return  // always true → always exits
setSaveStatus('saving')         // never reached
// fetch never called
// Vercel Blob never updated
```

This is why:
- The button label never changed from "Save"
- The status indicator never moved
- Nothing appeared in the Vercel dashboard

---

## The Fix

**Remove `isMounted` entirely.**

In React 18, calling `setState` on an unmounted component is a silent no-op. React
handles it internally and does not throw a warning or error. The `isMounted` pattern
was a workaround for React 16 behavior that no longer exists.

```ts
// REMOVED: const isMounted = useRef(true)
// REMOVED: useEffect(() => { return () => { isMounted.current = false } }, [])

const save = useCallback(async () => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  setSaveStatus('saving')   // now always reachable
  try {
    const res = await fetch(...)
    setSaveStatus(res.ok ? 'saved' : 'error')
  } catch {
    setSaveStatus('error')
  }
}, [projectId])
```

Three lines of `if (!isMounted.current) return` were deleted. The hook is simpler,
correct in Strict Mode, and correct in production.

---

## Secondary Fix — Canvas GET Route

The GET handler for loading canvases used the Vercel Blob SDK's `get()` function
with `access: 'private'`. Any canvas saved *before* the `access: 'private'` change
(stored as a public blob) would cause `get()` to throw. Without a try/catch, the
route would return a 500 error on page load, breaking the canvas load.

The fix: wrap the `get()` call in a try/catch and fall back to an empty canvas.
The next time the user saves, the new private blob is written and the canvas
recovers seamlessly.

```ts
try {
  const result = await get(canvasJsonPath, { access: 'private' })
  if (!result) return NextResponse.json({ nodes: [], edges: [] })
  const data = await new Response(result.stream).json()
  return NextResponse.json(data)
} catch {
  return NextResponse.json({ nodes: [], edges: [] })
}
```

---

## The Reusable Lesson

**The `isMounted` pattern is a React 16 antipattern. Don't use it in React 18.**

React 18 made a deliberate change: `setState` on an unmounted component is
quietly ignored. No error, no warning. The old `isMounted` guard is now not just
unnecessary — it actively causes bugs when combined with Strict Mode because the
simulated cleanup permanently poisons the ref.

If you need to cancel async work when a component unmounts (e.g., cancel a fetch),
use `AbortController` instead:

```ts
useEffect(() => {
  const controller = new AbortController()
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setSomeState)
    .catch(err => {
      if (err.name !== 'AbortError') setSomeState(null)
    })
  return () => controller.abort()
}, [])
```

`AbortController` cancels the in-flight request itself (no wasted network), and the
abort error is easily distinguished from real failures. This is the correct pattern
for async cleanup.

---

## AI Discussion Topics

**1. Why does Strict Mode run effects twice?**
The goal is to help you find components or effects with "side effects in unexpected
places" (impure renders) or "missing cleanup." If your code breaks when effects run
twice, that's usually a signal your code has a bug. In what ways does the `isMounted`
pattern violate the rule that effects should be resumable after cleanup?

**2. Why did React 18 change the unmounted setState behavior?**
In React 18's concurrent mode, components can be unmounted and remounted
(e.g., as part of offscreen rendering or layout transitions). The old "warning on
unmounted setState" was both noisy and factually outdated. What other assumptions
from the React 16 era might be wrong in React 18's concurrent model?

**3. Ref vs. state across Strict Mode cycles**
Both refs and state are preserved across the Strict Mode simulated unmount/remount.
But state is "reset" by Strict Mode in React 19's upcoming behavior. Why do refs
pose more risk than state in this pattern? (Hint: state setters are always safe to
call; ref mutations are irreversible without explicit reset logic.)

**4. AbortController vs. isMounted**
Compare the two approaches for cancelling async work on unmount. `AbortController`
cancels the network request itself and doesn't depend on ref state. What are the
trade-offs? Are there cases where `AbortController` alone isn't enough and you need
additional logic?

**5. Should `useCanvasAutosave` save when nodes/edges are empty?**
Without the `isMounted` guard, the autosave debounce fires 2 seconds after the
Strict Mode re-run, potentially saving an empty canvas before the canvas load
completes. Currently this is guarded by the `isFirstRender` check (which also has
Strict Mode quirks — the second run fires the debounce). Is saving an empty canvas
harmful? How would you design this hook to guarantee it never saves data it didn't
"own" (i.e., data that was loaded from storage rather than created by the user)?
