# Plan: Feature 12 — Shape Panel

## Why This Feature Exists

The canvas was built in Feature 11, but it was empty — users had no way to add nodes to it. Feature 12 fixes that by adding a floating toolbar at the bottom of the canvas. Users can drag a shape from the toolbar onto the canvas and a new node appears at the exact spot they dropped it.

---

## What We Need to Build

Three things:

1. **A shape toolbar component** (`shape-panel.tsx`) — the floating pill at the bottom of the screen.
2. **A custom node renderer** (`canvas-node.tsx`) — so React Flow knows how to draw our `canvasNode` type visually.
3. **Drag-and-drop wiring** (inside `canvas-flow.tsx`) — listens for drops on the canvas and creates new nodes.

---

## How HTML Drag-and-Drop Works (Quick Primer)

The browser has a built-in drag-and-drop system. Here's the flow:

1. You add `draggable` to an element (the shape button).
2. When the user starts dragging, the `onDragStart` event fires. You use it to stash a **payload** in `event.dataTransfer` — think of it as a tiny clipboard for the drag operation.
3. As the dragged item moves over a drop target, `onDragOver` fires. You must call `e.preventDefault()` here or the browser will refuse to allow a drop.
4. When the user releases the mouse, `onDrop` fires on the drop target. You read the payload back from `event.dataTransfer` and do whatever you need to do.

We use a custom MIME type `application/ghost-shape` for our payload so other elements can't accidentally intercept it.

---

## File-by-File Plan

### 1. `components/editor/shape-panel.tsx` (new file)

**What it does:** Renders a row of six icon buttons, each representing a shape. Each button is `draggable`.

**The payload:** When drag starts, we pack `{ shape, width, height }` into `dataTransfer`. Width and height are default sizes for that shape (e.g., rectangles are wider than tall; circles are square).

**Positioning:** The toolbar sits at `bottom-6` of the canvas wrapper, horizontally centered with `left-1/2 -translate-x-1/2`. This is a CSS trick — move the element to the 50% mark and then pull it back by half its own width so it's perfectly centered.

Default sizes chosen:
| Shape | Width | Height | Why |
|-------|-------|--------|-----|
| rectangle | 160 | 80 | Wider than tall — classic box |
| diamond | 120 | 120 | Square so the diamond is symmetric |
| circle | 80 | 80 | Must be square to look like a circle |
| pill | 140 | 60 | Wide and short — pill shape |
| cylinder | 100 | 100 | Square canvas area |
| hexagon | 110 | 110 | Slightly bigger for label room |

### 2. `components/editor/canvas-node.tsx` (new file)

**What it does:** A React component that React Flow calls to render each `canvasNode` type. For now, every shape is drawn as a simple bordered rectangle — shape-specific visuals (actual diamond/hexagon SVGs etc.) come in a later feature.

**Key details:**
- Uses `NodeProps` from `@xyflow/react` as its props type.
- Reads `data.color` (stored as a hex fill string) and looks it up in `NODE_COLORS` to get both fill and text color. This keeps the color logic centralized.
- Includes four `Handle` components (top, right, bottom, left). Handles are the connection points users drag between to create edges. Placing all four gives maximum flexibility.
- The wrapper `div` uses `w-full h-full` so React Flow can control the node dimensions via the `width`/`height` properties on the node object.

### 3. `components/editor/canvas-flow.tsx` (modified)

**The problem we're solving:** We need to call `useReactFlow()` to access `screenToFlowPosition` — a helper that converts browser pixel coordinates (where the user dropped) into canvas coordinates (accounting for zoom and pan). But `useReactFlow()` only works *inside* a `ReactFlowProvider` context. The component that renders `<ReactFlow>` is also a context provider for its children, but not for itself.

**Solution — split into two components:**

```
CanvasFlow (outer)
  └─ ReactFlowProvider   ← creates the context
       └─ CanvasFlowInner  ← can now call useReactFlow()
            └─ <ReactFlow>
```

`CanvasFlowInner` now has access to both:
- `useLiveblocksFlow` — gives us Liveblocks-synced `nodes`/`edges`/`onNodesChange`
- `useReactFlow` — gives us `screenToFlowPosition`

**On drop:**
1. Parse the JSON payload from `dataTransfer`.
2. Call `screenToFlowPosition({ x: e.clientX, y: e.clientY })` to convert mouse position → canvas position.
3. Build a `CanvasNode` object with `type: 'canvasNode'`, empty label, the default fill color, the dragged shape name, and the default dimensions.
4. Call `onNodesChange([{ type: 'add', item: newNode }])` — this is the React Flow API to add a node programmatically. Because `onNodesChange` is from `useLiveblocksFlow`, the change is automatically synced to all connected collaborators via Liveblocks.

**Node ID format:** `${shape}-${Date.now()}-${counter}` — shape name makes it readable, timestamp makes it sortable, counter prevents collisions if two nodes are created in the same millisecond.

---

## What We're NOT Doing Yet

- Shape-specific visuals (real diamond SVG, hexagon SVG, etc.) — placeholder rectangle only.
- Node labels — users can't type into nodes yet.
- Node color picker — all nodes start with the default neutral dark color.
- Connection handles — handles are rendered but have no custom styling.

---

## Verification Steps

1. `npm run build` — must pass with zero TypeScript errors.
2. Open the editor in a browser.
3. Confirm the pill toolbar appears at the bottom-center of the canvas.
4. Drag any shape button and drop it onto the canvas — a bordered rectangle should appear at the drop position.
5. Drag multiple shapes — each lands where you drop it with a unique node ID.
6. Open two tabs for the same room — nodes added in one tab should appear in the other (Liveblocks sync).
