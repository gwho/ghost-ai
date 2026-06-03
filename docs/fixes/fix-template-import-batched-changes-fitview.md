# Fix: Template Import — Batched Changes and Deferred Fit View

## What Was Wrong

`components/editor/canvas-flow.tsx` has a `loadTemplate` callback that imports a
starter template into the canvas. Before this fix, it did five things in a row:

```ts
onNodesChange(nodes.map((n) => ({ type: 'remove' as const, id: n.id })))
onEdgesChange(edges.map((e) => ({ type: 'remove' as const, id: e.id })))
onNodesChange(template.nodes.map((n) => ({ type: 'add' as const, item: n })))
onEdgesChange(template.edges.map((e) => ({ type: 'add' as const, item: e })))
reactFlow.fitView({ duration: 200 })
```

There were two problems.

### Problem 1: Template import became multiple change batches

The import removed nodes, removed edges, added nodes, and added edges in four
separate calls. Each call is a separate change batch from the canvas/history
system's point of view.

That means one user action — "import this template" — could be recorded as
multiple undo steps. The user would expect one undo to remove the imported
template, but the history stack could instead step through intermediate states.

### Problem 2: `fitView` ran before React Flow had rendered the new elements

`onNodesChange` and `onEdgesChange` schedule state changes. React still needs to
render the updated nodes and edges before React Flow can measure them. Calling
`reactFlow.fitView()` immediately after dispatching the changes can race with
that render work.

If `fitView` runs too early, React Flow may calculate the viewport from the old
canvas contents or from elements that have not been measured yet.

| File | Finding | Status |
| --- | --- | --- |
| `components/editor/canvas-flow.tsx` | `loadTemplate` dispatched four separate change batches | Fixed |
| `components/editor/canvas-flow.tsx` | `fitView` ran synchronously after dispatching changes | Fixed |

---

## The Fix

### Fix 1: Batch node removals and additions into one `onNodesChange`

```ts
onNodesChange([
  ...nodes.map((n) => ({ type: 'remove' as const, id: n.id })),
  ...template.nodes.map((n) => ({ type: 'add' as const, item: n })),
])
```

The node changes are now one array:

1. Remove all existing nodes.
2. Add all template nodes.

This keeps the node side of the import as one change batch.

### Fix 2: Batch edge removals and additions into one `onEdgesChange`

```ts
onEdgesChange([
  ...edges.map((e) => ({ type: 'remove' as const, id: e.id })),
  ...template.edges.map((e) => ({ type: 'add' as const, item: e })),
])
```

The edge changes are also one array:

1. Remove all existing edges.
2. Add all template edges.

This avoids separate "remove edges" and "add edges" batches.

### Fix 3: Defer `fitView` to the next animation frame

```ts
requestAnimationFrame(() => {
  reactFlow.fitView({ duration: 200 })
})
```

`requestAnimationFrame` waits until the browser is about to paint the next frame.
That gives React and React Flow a chance to apply the node/edge updates before
the viewport is recalculated.

---

## Why This Approach

### Why merge remove and add changes into one array?

React Flow's change handlers accept an array of changes. That means we do not
need to call the handler once per operation. We can send the full intent in one
batch:

```ts
[
  { type: 'remove', id: 'old-node' },
  { type: 'add', item: newNode },
]
```

This better matches the user's mental model. Importing a template is one user
action, so the canvas should treat it like one grouped operation rather than
four smaller operations.

### Why keep nodes and edges as separate calls?

Nodes and edges have different handlers:

- `onNodesChange` handles node changes.
- `onEdgesChange` handles edge changes.

So the fix uses one node batch and one edge batch. It does not try to force
nodes and edges into the same function, because that would fight the React Flow
API shape.

### Why `requestAnimationFrame` instead of `setTimeout`?

`setTimeout(..., 0)` says "run this later when the event loop gets to it."
`requestAnimationFrame` says "run this right before the next browser paint."

For UI measurement work like `fitView`, `requestAnimationFrame` is the better
match. It aligns the viewport calculation with the browser's render cycle, which
is exactly when layout measurements are most likely to be fresh.

---

## Beginner Mental Model: Dispatching Is Not Rendering

Calling `onNodesChange` does not instantly mean the DOM has changed. It means:

1. Tell React/Liveblocks/React Flow about a state change.
2. React schedules a render.
3. React Flow renders the updated nodes and edges.
4. The browser measures and paints them.

`fitView` needs step 3 and 4 to have happened, because it calculates how to pan
and zoom around the visible nodes. If you call it immediately after step 1, it
can run too early.

That is why this pattern is safer:

```ts
onNodesChange([...])
onEdgesChange([...])

requestAnimationFrame(() => {
  reactFlow.fitView({ duration: 200 })
})
```

The state update is dispatched first. The viewport adjustment waits until the
next frame.

---

## Beginner Mental Model: One User Action Should Usually Be One Undo Step

Undo feels natural when it reverses user intent, not implementation details.

If a user clicks "Import starter template," their intent is one action:

```text
Import this template.
```

But the implementation has several technical steps:

```text
Remove old nodes.
Remove old edges.
Add new nodes.
Add new edges.
Fit the viewport.
```

If each technical step becomes its own undo entry, undo feels broken. The user
has to press undo several times to reverse one visible action. Batching related
changes keeps the history stack closer to what the user actually did.

---

## Validation

- IDE diagnostics for `components/editor/canvas-flow.tsx`: no linter errors.
- File-scoped ESLint passed:

```sh
npm --prefix "/Users/jessejames/Desktop/ghost-ai/my-app-ghost" run lint -- components/editor/canvas-flow.tsx
```

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/canvas-flow.tsx` | Coalesced template node changes into one `onNodesChange` call, coalesced template edge changes into one `onEdgesChange` call, and deferred `fitView` with `requestAnimationFrame` |
| `docs/fixes/fix-template-import-batched-changes-fitview.md` | Added this beginner-friendly fix log |
