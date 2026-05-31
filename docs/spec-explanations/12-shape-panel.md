# Feature 12: Shape Panel — Spec Explanation

## What This Feature Does

Feature 12 adds a floating pill-shaped toolbar at the bottom-center of the canvas. It contains six draggable shape buttons. When you drag a shape from the toolbar and drop it onto the canvas, a new node is created at exactly the position you dropped it.

Before this feature, the canvas existed but had no way to add anything to it. This was the first step toward letting users manually build system diagrams.

---

## The Three Files We Wrote

### 1. `components/editor/shape-panel.tsx`

This component renders the toolbar. The shapes supported are: rectangle, diamond, circle, pill, cylinder, and hexagon — matching the six shapes defined in `types/canvas.ts`.

Each button is a standard HTML element with the `draggable` attribute set to `true`. That one attribute tells the browser "this element can be picked up and dragged."

When dragging begins, `onDragStart` fires. Inside that handler we call:

```typescript
e.dataTransfer.setData('application/ghost-shape', JSON.stringify({ shape, width, height }))
```

`dataTransfer` is like a mini clipboard that lives for the duration of one drag operation. We serialize the shape name and its default dimensions (width × height) as JSON. The MIME type `application/ghost-shape` is a custom key we made up — it helps us distinguish our payloads from anything else the browser might have in the drag state.

**Why include width and height in the payload?**  
Different shapes have different natural proportions. A circle should always be square (equal width and height), while a rectangle should be wider than tall. Baking the defaults into the drag payload means the drop handler doesn't need to know about shapes — it just uses whatever dimensions came with the drag.

---

### 2. `components/editor/canvas-node.tsx`

React Flow is flexible: it lets you define custom components to render any node type. When we create nodes with `type: 'canvasNode'`, React Flow looks up that string in a `nodeTypes` map and calls whatever component is registered there.

This component is that renderer. It receives a `NodeProps` object from React Flow. Inside `data` we find the `label`, `color` (fill hex), and `shape` string.

To get the correct text color, we look up the fill in `NODE_COLORS`:

```typescript
const pair = NODE_COLORS.find((c) => c.fill === color) ?? NODE_COLORS[0]
```

This returns both the fill and the paired text color. The project stores only the fill in node data — the text color is always derived on the fly by looking up its pair.

**What are Handles?**  
`<Handle>` components from `@xyflow/react` are the small dots on node edges that users drag between to create connections (edges). We add four handles — top, right, bottom, left — so users can connect from any side.

**Why does `w-full h-full` matter?**  
When we create a node we set `width: 160` and `height: 80` on the node object. React Flow uses those values to size the DOM element that wraps our component. Our component just needs to fill that container — hence `w-full h-full`.

**Shape rendering:**  
For this feature, every shape is drawn as the same simple bordered rectangle. The `data.shape` value is stored for future use (diamond outlines, SVG hexagons, etc.) but doesn't change the visual yet.

---

### 3. `components/editor/canvas-flow.tsx` (refactored)

This is where most of the logic lives. The file was split into two components to solve a specific React Flow constraint:

**The constraint:** `useReactFlow()` is a hook that reads from a React context called `ReactFlowProvider`. You can only call it from a component that is *inside* that context. A component that *renders* `<ReactFlow>` is not inside it — it's above it. So calling `useReactFlow()` in the same component that renders `<ReactFlow>` would throw an error.

**The fix — the outer/inner split:**

```
CanvasFlow            ← exported; renders ReactFlowProvider
  └─ ReactFlowProvider
       └─ CanvasFlowInner   ← internal; calls useReactFlow()
            ├─ useLiveblocksFlow()
            ├─ useReactFlow()
            └─ <div onDrop onDragOver>
                 <ReactFlow nodeTypes={...} ...>
                 <ShapePanel />
```

`CanvasFlowInner` can now safely call both `useLiveblocksFlow` (which gives us Liveblocks-synced nodes/edges) and `useReactFlow` (which gives us canvas utilities).

**`screenToFlowPosition` — why it matters:**  
When the user drops a shape, `e.clientX` and `e.clientY` give the mouse position in browser viewport pixels. But the canvas can be panned and zoomed. A drop at pixel (800, 400) might correspond to canvas coordinates (150, -50) if the user has panned right and zoomed in. `screenToFlowPosition` performs that conversion for us.

**Adding a node via `onNodesChange`:**  
React Flow exposes an `onNodesChange` callback that accepts an array of "change" objects. Changes can be moves, selections, deletions — or additions. To add a node:

```typescript
onNodesChange([{ type: 'add', item: newNode }])
```

Because `onNodesChange` comes from `useLiveblocksFlow`, Liveblocks intercepts this call and writes the new node to its shared storage. All connected collaborators see the new node appear instantly.

**Node ID format:**  
```typescript
const id = `${shape}-${Date.now()}-${counter.current}`
```
- Shape name: makes logs and debugging readable (`rectangle-1716000000000-1`)
- Timestamp: ensures uniqueness across sessions
- Counter (a `useRef`): prevents collisions if two nodes are dropped in the same millisecond

---

## Concepts to Remember

### HTML Drag-and-Drop API
| Event | Where it fires | What you do |
|-------|---------------|-------------|
| `onDragStart` | On the draggable element | Store payload in `dataTransfer` |
| `onDragOver` | On the drop target | Call `e.preventDefault()` to allow drops |
| `onDrop` | On the drop target | Read payload, do the action |

### React Flow provider pattern
When you need a hook like `useReactFlow()` in the component that also renders `<ReactFlow>`, wrap everything in `<ReactFlowProvider>` one level above:

```tsx
function Outer() {
  return <ReactFlowProvider><Inner /></ReactFlowProvider>
}
function Inner() {
  const rf = useReactFlow()   // ✅ works — Inner is inside the provider
  return <ReactFlow ... />
}
```

### NodeTypes map
React Flow looks up `node.type` in the `nodeTypes` object you pass to `<ReactFlow>`. Always define this outside the component (not inline) to avoid React re-registering it on every render, which would cause all nodes to remount.

```typescript
const nodeTypes: NodeTypes = {
  canvasNode: CanvasNodeComponent,  // 'canvasNode' → our renderer
}
```

---

## What's Not Done Yet

- Shape-specific visuals (diamond, hexagon, circle outlines using SVG/CSS)
- Typing labels into nodes
- Changing node colors from the UI
- Handle styling

These are scoped to future features.
