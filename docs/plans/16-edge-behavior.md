# Plan: Feature 16 — Edge Behavior

## What We're Building

Replace React Flow's default smoothstep edges with custom edges that:
- use right-angle (smooth-step) routing
- have an arrowhead that changes colour with hover/select state
- are easy to click with a wide invisible hitbox
- support double-click inline label editing synced through Liveblocks
- expose subtle connection handles on every node that fade in on hover

---

## Files Changed

| File | What changed |
|---|---|
| `types/canvas.ts` | Added `EdgeData` interface; updated `CanvasEdge` generic |
| `app/globals.css` | Added handle fade-in CSS rules |
| `components/editor/canvas-edge.tsx` | New — custom edge renderer |
| `components/editor/canvas-flow.tsx` | Registered `edgeTypes`; updated `defaultEdgeOptions` |
| `context/progress-tracker.md` | Marked Feature 16 complete |

---

## Step-by-Step

### 1. Add `EdgeData` to `types/canvas.ts`

```ts
export interface EdgeData extends Record<string, unknown> {
  label?: string
}
export type CanvasEdge = Edge<EdgeData, 'canvasEdge'>
```

`EdgeData` mirrors `NodeData` — a typed shape for the data stored on each edge.
`Record<string, unknown>` is required by React Flow's generic constraint.

### 2. Handle fade-in CSS in `globals.css`

```css
.react-flow__handle {
  width: 8px !important;
  height: 8px !important;
  background: var(--text-primary) !important;
  border: 2px solid var(--bg-surface) !important;
  border-radius: 50% !important;
  opacity: 0;
  transition: opacity 0.15s;
}
.react-flow__node:hover .react-flow__handle,
.react-flow--connecting .react-flow__handle {
  opacity: 1;
}
```

`!important` is needed because React Flow's own stylesheet sets handle sizes and colours.
`.react-flow--connecting` is a class React Flow adds to the root while a connection is
being dragged, so handles on all nodes become visible as drop targets.

### 3. Create `canvas-edge.tsx`

**SVG structure inside the component:**

```
<defs>
  <marker id="canvas-arrow-{id}"> ... arrowhead path using strokeColor ... </marker>
</defs>

{/* hit detection — wide, invisible */}
<path strokeOpacity={0} strokeWidth={16} style={{ pointerEvents: 'all' }}
  onMouseEnter/onMouseLeave to set hovered state />

{/* visible edge */}
<path stroke={strokeColor} strokeWidth={1.5} markerEnd="url(#canvas-arrow-{id})" />

<EdgeLabelRenderer>
  <div at (labelX, labelY) with nodrag nopan>
    editing ? <input> : label ? <pill> : isActive ? <hint>
  </div>
</EdgeLabelRenderer>
```

**Why a per-edge inline marker?**
React Flow's built-in `MarkerType.ArrowClosed` creates a single static SVG marker.
Its colour can't change at runtime because SVG markers use `fill` as an attribute, not
a CSS property that transitions. By defining a `<marker>` element inside each edge's
own `<defs>`, the fill reads from the `strokeColor` JS variable, so it updates on every
render when hover/select state changes.

**Why `strokeOpacity={0}` instead of `stroke="transparent"`?**
SVG elements with `stroke="transparent"` don't receive pointer events in all browsers
because `transparent` is treated as "no paint". `strokeOpacity={0}` keeps the stroke
present (just invisible) so `pointerEvents: all` works correctly.

**Label positioning:**
`getSmoothStepPath` returns `[path, labelX, labelY]`.
`labelX` and `labelY` are canvas coordinates at the midpoint of the path.
`EdgeLabelRenderer` renders into a special React Flow portal outside the SVG,
so the label can use HTML elements (inputs, buttons) instead of SVG foreignObject.
The positioning formula is:
```
transform: translate(-50%, -50%) translate(${labelX}px, ${labelY}px)
```
`translate(-50%, -50%)` centres the div on the point; `translate(labelX, labelY)` moves it to the midpoint.

**Label sync:**
`updateEdgeData(id, { label: e.target.value })` — same pattern as
`updateNodeData` in Feature 14. Liveblocks intercepts React Flow's state updates
and broadcasts them to all collaborators automatically.

### 4. Register `edgeTypes` in `canvas-flow.tsx`

```ts
const edgeTypes: EdgeTypes = { canvasEdge: CanvasEdgeComponent }
```

Defined outside the component so the object reference is stable across renders.
An unstable reference would cause React Flow to remount all edges on every render.

```tsx
<ReactFlow
  edgeTypes={edgeTypes}
  defaultEdgeOptions={{ type: 'canvasEdge' }}
  ...
/>
```

`defaultEdgeOptions` sets the `type` on every new edge created via `onConnect`.

---

## Verification Checklist

- [ ] Hover a node — handles appear (white dots with dark ring), fade out when mouse leaves
- [ ] Drag from one handle to another — edge appears with right-angle routing and arrowhead
- [ ] Hover the edge — path and arrowhead brighten; hover is triggered by a wide invisible area
- [ ] Select the edge — path and arrowhead stay bright
- [ ] Double-click the edge midpoint — input appears
- [ ] Type a label, then blur or press Enter — pill badge appears at midpoint
- [ ] Press Escape during editing — editing closes
- [ ] Open in a second browser tab — label update appears on both screens (Liveblocks sync)
- [ ] `npm run build` passes with zero errors
