# Fix: Issue 4 — Drag and Drop Position Offset

## What Was Broken

When dropping a shape from the shape panel onto the canvas, the placed node appeared
below and to the right of where the cursor was. The further the cursor was from the
canvas origin, the more noticeable the offset.

---

## Root Cause

The `onDrop` handler in `canvas-flow.tsx` computed the node position as:

```ts
const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
```

`screenToFlowPosition` correctly converts the screen-space cursor coordinate into
canvas (flow) space, accounting for pan and zoom. This returns the canvas coordinate
**directly under the cursor**.

But React Flow positions nodes by their **top-left corner**, not their center. The
new node was placed with its top-left at the cursor position, which means the node's
body extended downward and to the right from the cursor — visually appearing "below"
the drop point.

The ShapePanel drag ghost is already centered on the cursor (using
`left: x - width/2, top: y - height/2`), so users expected the real node to land
in the same centered position. The mismatch caused the jarring offset.

---

## The Fix

After converting the screen coordinate to canvas space, subtract half the node
dimensions to center the node at the cursor:

```ts
// Before:
const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

// After:
const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
const position = { x: canvasPos.x - width / 2, y: canvasPos.y - height / 2 }
```

`width` and `height` come from the drag data (`{ shape, width, height }` stored in
`dataTransfer` by ShapePanel's `handleDragStart`). They are in canvas units (the
same coordinate space as `position`), so no additional scaling is needed — React
Flow's `screenToFlowPosition` already handles the zoom correction.

---

## The Reusable Lesson

**React Flow nodes are positioned by top-left corner. Centering is your job.**

`screenToFlowPosition(x, y)` gives you the canvas coordinate AT the cursor. If you
want the node's visual center at the cursor, offset by half the node dimensions:

```ts
const cursor = screenToFlowPosition({ x: e.clientX, y: e.clientY })
const topLeft = { x: cursor.x - nodeWidth / 2, y: cursor.y - nodeHeight / 2 }
```

The same principle applies to any "place node at point" interaction. For a click-to-
place feature, use `screenToFlowPosition` on the click coordinates and center by
half-dimensions.

**Coordinate systems in canvas apps:**
- **Screen space** (`e.clientX/Y`): pixels from the browser viewport top-left
- **Canvas/flow space**: the infinite coordinate plane that React Flow manages
- `screenToFlowPosition` bridges them, applying the inverse of pan + zoom transforms
- Node `position` is always in canvas/flow space

---

## AI Discussion Topics

**1. Why does `screenToFlowPosition` exist at all?**
The canvas can be panned and zoomed, so the same screen pixel maps to different
canvas coordinates depending on viewport state. `screenToFlowPosition` applies the
inverse transform. When would you need the reverse (canvas to screen)?

**2. The drag ghost vs. the real node**
The ShapePanel renders a custom drag ghost centered on the cursor using a fixed-
position div tracked via `document.addEventListener('dragover')`. The real node is
placed in `onDrop`. If the user drags quickly and the ghost rendering lags, does
this create UX confusion? How would you design a "sticky" drag preview that always
stays exactly aligned?

**3. Should the node center or top-left be at the cursor?**
The current fix centers the node at the cursor. Some apps instead use the grab point
(where the user first clicked within the draggable element) as the reference. What
data would you need to track for that behavior, and how would you store it across
the drag event lifecycle?

**4. Storing drag offset in `dataTransfer`**
The `dataTransfer` object is the only communication channel between `dragstart` and
`drop` events. What are the constraints on what you can store there? How does
serialization (JSON.stringify) affect what types of data you can pass?
