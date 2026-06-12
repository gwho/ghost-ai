# Fix: canvas snapshot emitted before saved canvas hydration

## Finding Verification

The finding was still valid in current code.

`components/editor/canvas-flow.tsx` had this effect:

```tsx
useEffect(() => {
  onCanvasSnapshot?.({ nodes, edges })
}, [nodes, edges, onCanvasSnapshot])
```

That effect runs immediately after render. In an empty Liveblocks room, the component then fetches the saved canvas from `/api/projects/{projectId}/canvas` and applies persisted nodes and edges. During that gap, the snapshot callback could receive `{ nodes: [], edges: [] }`.

The Specs tab uses this snapshot when generating a technical spec, so publishing an empty pre-hydration snapshot could make spec generation use the wrong canvas state.

## Fix

The effect now waits for the existing hydration-ready flag:

```tsx
useEffect(() => {
  if (!isAutosaveReady || !onCanvasSnapshot) return
  onCanvasSnapshot?.({ nodes, edges })
}, [isAutosaveReady, nodes, edges, onCanvasSnapshot])
```

`isAutosaveReady` was already used to prevent autosave from running before saved canvas hydration completes. Reusing it keeps snapshot readiness aligned with persistence readiness.

## Why This Is Minimal

No new state or data flow was added. The fix only gates the existing snapshot effect on an existing readiness flag and adds that flag to the dependency array.

Active collaborative rooms still emit snapshots immediately because `isAutosaveReady` initializes to true when Liveblocks already has nodes or edges. Empty rooms emit after the saved-canvas load attempt finishes.

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint components/editor/canvas-flow.tsx
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "Why do React effects run after the first render, and how can that create stale or premature callbacks?"
2. Ask: "How should hydration readiness be modeled when local UI state depends on async persisted data?"
3. Ask: "Why is it useful to reuse an existing readiness flag instead of adding a second one?"
4. Ask: "What bugs can happen when a parent stores child state snapshots in a ref before the child has finished loading?"
