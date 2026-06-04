# Fix: Issue 5 — Auto Zoom on First Node Drop

## What Was Broken

Dropping the first shape onto an empty canvas caused an automatic zoom-in. The
canvas viewport would jump to a zoomed-in view of the dropped node. This did not
happen when dropping shapes onto a canvas that already had other nodes.

---

## Root Cause

The `<ReactFlow>` component had the `fitView` prop set:

```tsx
<ReactFlow
  ...
  fitView
>
```

React Flow's `fitView` prop is a **lazy initializer**. When the canvas mounts with
zero nodes, there is nothing to fit to, so the fitView calculation is deferred. When
nodes become non-empty for the first time (the first drop), React Flow fires the
deferred `fitView` — zooming in to frame the newly added node.

When other nodes already exist (canvas already non-empty), the `fitView` initializer
had already fired on mount. It does not re-fire on subsequent additions, which is
why the auto-zoom only happened on the FIRST drop.

---

## The Fix

Remove `fitView` from the ReactFlow component. Replace it with explicit
`reactFlow.fitView()` calls only where the fit behavior is actually desired:

**1. Remove the prop:**
```tsx
// Before:
<ReactFlow ... fitView>

// After:
<ReactFlow ...>
```

**2. Add fitView to the canvas load effect:**
```ts
// Case A: Liveblocks already has nodes (collaborative session in progress)
if (nodes.length > 0 || edges.length > 0) {
  requestAnimationFrame(() => reactFlow.fitView())
  return
}

// Case B: No Liveblocks data — fetch from API storage
fetch(...)
  .then(data => {
    onNodesChange(...)
    onEdgesChange(...)
    requestAnimationFrame(() => reactFlow.fitView())  // ← added
  })
```

Template loading already called `reactFlow.fitView({ duration: 200 })` explicitly
and was not changed.

**Why `requestAnimationFrame`?** React Flow must finish rendering the newly added
nodes before `fitView` can calculate bounds. Wrapping in `rAF` lets React flush the
DOM update first.

**Result:** `fitView` only fires after loading existing nodes, never after a user
drop. The viewport stays exactly where it was.

---

## The Reusable Lesson

**The `fitView` prop on ReactFlow is a lazy initializer — it fires when nodes become
non-empty for the first time, not just on initial mount.**

If you need `fitView` to run at specific points (load, template import) but NOT at
others (user drops, collaborative updates), remove the prop and call
`reactFlow.fitView()` explicitly from the right places.

The React Flow instance exposes:
```ts
const reactFlow = useReactFlow()
reactFlow.fitView()              // immediate
reactFlow.fitView({ duration: 200 })   // animated
reactFlow.fitView({ padding: 0.2 })    // with padding around bounds
```

Always wrap explicit `fitView` calls in `requestAnimationFrame` when called right
after a state change, so React has time to render the new nodes before bounds are
calculated.

---

## AI Discussion Topics

**1. Why is `fitView` a lazy initializer, not a one-time mount prop?**
React Flow can't compute bounds until nodes have rendered dimensions. On initial
mount with zero nodes there are no bounds. The design defers `fitView` to the next
opportunity where nodes exist. Is this behavior documented clearly enough? What
alternative API design would be less surprising?

**2. Collaborative canvas viewport**
Currently the viewport (pan + zoom) is local per client. If two users open the same
canvas, they each see a different view. How would you design shared viewport state —
where one user's pan/zoom is synced to others? Would you always want this behavior,
or only in certain "follow mode" scenarios?

**3. `requestAnimationFrame` vs `useEffect` for post-render callbacks**
Both `rAF` and `useEffect` schedule work after rendering. When should you prefer
`rAF` over a `useEffect`? Consider: timing relative to browser paint, access to DOM
layout, interaction with React's batching.

**4. The empty canvas problem**
The load effect early-returns if there is nothing in API storage. This means a
brand-new canvas stays empty and `fitView` doesn't run (nothing to fit). Is the
default zoom level reasonable for a blank canvas? How would you set an intentional
default viewport (e.g., centered at origin, zoom = 1)?
