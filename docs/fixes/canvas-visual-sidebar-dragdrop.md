# Fix: Canvas Visual, Sidebar Floating, Drag-and-Drop, and Rounded Edges

**Date:** 2026-05-29  
**Files changed:** `workspace-shell.tsx`, `canvas-flow.tsx`, `project-sidebar.tsx`, `app/globals.css`

---

## What Was Broken

The editor canvas had four distinct problems all rooted in the same misunderstanding: **layout was fighting visual intent**.

1. The canvas looked like a floating "card" — boxed in, with borders and a second toolbar above it.
2. The AI Copilot sidebar was pushing the canvas sideways instead of floating over it.
3. The left Projects sidebar was partially visible ("peeking") after being toggled off.
4. Dragging shapes from the shape panel onto the canvas didn't work.
5. *(New request)* Canvas edges between nodes had no soft rounded corners.

---

## Fix 1 — Canvas visual: from flex-column "card" to infinite canvas

### The problem

`workspace-shell.tsx` was using a **flex column layout**:

```
┌─────────────────────────────────┐
│  Project toolbar (h-14)         │  ← second header, creates "box" feel
├────────────────────────┬────────┤
│  Canvas (flex-1)       │ AI     │  ← AI sidebar squishes the canvas
│                        │ Panel  │
└────────────────────────┴────────┘
```

This made the canvas look like a UI card — it had visible top and right edges where the toolbar and sidebar ended. This is the opposite of an infinite canvas where content should feel like it extends forever in all directions.

### The fix

We changed to **absolute (overlay) positioning**:

```
┌─────────────────────────────────┐
│  Canvas (fills entire area)     │  ← canvas is the base layer
│  ─────────────────────────────  │
│  Toolbar (absolute, top-0, z-20)│  ← toolbar floats OVER the canvas
│  ─────────────────────────────  │
│                    ┌──────────┐ │
│                    │ AI Panel │ │  ← sidebar floats OVER the canvas
│                    │(absolute)│ │
│                    └──────────┘ │
└─────────────────────────────────┘
```

**Key code change in `workspace-shell.tsx`:**

```jsx
// BEFORE: flex column — toolbar takes up space, canvas is shrunk
<div className="h-full flex flex-col">
  <div className="h-14 ...">toolbar</div>
  <div className="flex-1 flex overflow-hidden">
    <div className="flex-1"><CanvasWrapper /></div>
    {isAISidebarOpen && <AICopilotSidebar />}
  </div>
</div>

// AFTER: canvas fills everything, other UI floats over it
<div className="relative h-full">
  <div className="absolute inset-0">          {/* canvas fills 100% */}
    <CanvasWrapper />
  </div>
  <div className="absolute top-0 left-0 right-0 z-20 h-12">  {/* toolbar layer */}
    ...
  </div>
  {isAISidebarOpen && (
    <div className="absolute right-0 inset-y-0 z-10 w-80">   {/* sidebar layer */}
      <AICopilotSidebar />
    </div>
  )}
</div>
```

**Reusable lesson:** When you want a "canvas" or "stage" that other panels float over, use `position: relative` on the outer container and `position: absolute` on both the canvas AND the UI panels. The canvas gets `inset-0` (all four sides at 0) to fill the entire container. UI panels get explicit position values (`top-0 right-0` etc.) and a higher `z-index` so they appear on top. This is how Figma, VS Code, and Excalidraw are built.

---

## Fix 2 — Left sidebar peeking when closed

### The problem

The Projects sidebar uses `position: fixed` and slides off-screen with `translateX(-100%)`. Two subtle issues caused it to "peek":

1. The `border-r` (right border of the sidebar) lands at exactly `left: 0px` after a `-100%` translation. Some browsers render a 1px line right at the viewport edge.
2. Without `overflow: hidden` on the sidebar itself, inner children can technically stick out beyond the sidebar's own width.

### The fix

Two changes in `project-sidebar.tsx`:

```jsx
// BEFORE
className={`fixed ... transition-transform ${
  isOpen ? "translate-x-0" : "-translate-x-full"
}`}

// AFTER
className={`fixed ... overflow-hidden transition-transform ${
  isOpen ? "translate-x-0" : "-translate-x-[calc(100%+2px)]"
}`}
```

- **`overflow-hidden`** clips any children that might overflow the sidebar's bounding box.
- **`-translate-x-[calc(100%+2px)]`** pushes the sidebar 2 pixels further than its full width, guaranteeing the border is fully off-screen instead of sitting at pixel 0.

**Reusable lesson:** When animating elements off-screen with CSS transforms, `-100%` puts the rightmost edge exactly at the viewport boundary — which can cause sub-pixel rendering artifacts. Using `-calc(100% + Npx)` gives you a safe buffer. Always add `overflow: hidden` to sidebars to contain any children that might overflow.

---

## Fix 3 — Drag-and-drop: handlers on the wrong element

### The problem

In `canvas-flow.tsx`, the `onDragOver` and `onDrop` handlers were placed on the **wrapper `<div>`** that contains `<ReactFlow>`:

```jsx
// BROKEN — handlers on the parent div
<div onDragOver={onDragOver} onDrop={onDrop}>
  <ReactFlow ...>
    ...
  </ReactFlow>
</div>
```

ReactFlow has its own internal drag-event handling (for moving nodes around on the canvas). When you drag a shape from the panel over the canvas, ReactFlow intercepts the drag events to check if you're dragging a node. This internal handling can prevent the events from bubbling up to the parent `<div>`. So `onDrop` on the div never fires.

### The fix

Move `onDragOver` and `onDrop` directly onto `<ReactFlow>` as props. ReactFlow accepts and supports these props specifically to enable external drag-and-drop.

```jsx
// FIXED — handlers on ReactFlow directly
<div className="w-full h-full relative">
  <ReactFlow
    onDragOver={onDragOver}
    onDrop={onDrop}
    ...
  >
    ...
  </ReactFlow>
</div>
```

**How drag-and-drop works end-to-end:**

1. **`ShapePanel` button** — has `draggable` and `onDragStart` which calls `e.dataTransfer.setData('application/ghost-shape', JSON.stringify({ shape, width, height }))`. This encodes the shape info into the drag event.
2. **`ReactFlow` onDragOver** — calls `e.preventDefault()` which tells the browser "this element accepts drops". Without `preventDefault()`, the drop is blocked.
3. **`ReactFlow` onDrop** — reads `e.dataTransfer.getData('application/ghost-shape')`, converts the screen pixel position to canvas coordinates with `screenToFlowPosition()`, then creates a new node.

**Reusable lesson:** Always read the documentation for third-party components before wiring up event handlers on parent wrappers. Library components often handle events internally before they bubble. The safe pattern is to use the library's own event props whenever possible. For ReactFlow specifically, drag-and-drop handlers belong on `<ReactFlow>`, not on its container.

---

## Fix 4 — ReactFlow default background color

### The problem

`@xyflow/react/dist/style.css` (imported at the top of `canvas-flow.tsx`) ships with a default background color on `.react-flow`. Without overriding this, ReactFlow renders its own background that can differ from the app's `--bg-base` color, creating a visual mismatch.

### The fix

Two-part:

1. In `canvas-flow.tsx`, pass `style={{ background: 'transparent' }}` to `<ReactFlow>` so the component itself doesn't paint a background:

```jsx
<ReactFlow
  style={{ background: 'transparent' }}
  ...
>
```

2. In `globals.css`, add a CSS override as a safety net for any ReactFlow background classes:

```css
.react-flow,
.react-flow__renderer,
.react-flow__background {
  background: transparent !important;
}
```

**Reusable lesson:** Third-party UI libraries often ship their own CSS that overrides your theme. When you import a library's stylesheet (`import 'lib/dist/style.css'`), check what it sets. The reliable fix is either passing a `style` prop to the component, or writing a targeted CSS override in your own stylesheet. Setting `background: transparent` lets the parent's background show through naturally.

---

## Fix 5 — Rounded edges (smoothstep)

### The problem

No edge style was configured, so ReactFlow used its default `'default'` edge type (bezier curves). The user wanted **soft rounded-corner edges** — orthogonal lines that turn at right angles with rounded corners, similar to Notion/Figma flowcharts.

### The fix

Add `defaultEdgeOptions` to `<ReactFlow>`:

```jsx
<ReactFlow
  defaultEdgeOptions={{
    type: 'smoothstep',
    style: { strokeWidth: 1.5, stroke: 'var(--border-subtle)' },
  }}
  ...
>
```

Also add a CSS rule in `globals.css`:

```css
.react-flow__edge-path {
  stroke: var(--border-subtle);
  stroke-width: 1.5;
}
```

**ReactFlow edge types explained:**

| Type | Appearance | Best for |
|---|---|---|
| `default` | Smooth bezier curves | Organic-looking flow diagrams |
| `straight` | Direct lines between nodes | Simple connections |
| `step` | Right-angle turns, sharp corners | Technical diagrams |
| `smoothstep` | Right-angle turns, **rounded corners** | Modern design tools |
| `simplebezier` | Simplified bezier curves | Lightweight diagrams |

`smoothstep` is what Figma's and Notion's diagram tools use — it's the most readable for architecture diagrams.

`defaultEdgeOptions` applies to all **new** edges created going forward. Existing edges in Liveblocks that don't have an explicit `type` property will also pick this up since `defaultEdgeOptions` fills in the gap.

**Reusable lesson:** ReactFlow's `defaultEdgeOptions` is the single place to configure how all newly created connections look. You can still override individual edges by setting a `type` property in the edge data object.

---

## Summary of all changes

| File | What changed | Why |
|---|---|---|
| `workspace-shell.tsx` | Replaced flex-col layout with `relative` + `absolute` positioning | Canvas must fill viewport; toolbar/sidebars must float over it |
| `canvas-flow.tsx` | Moved `onDragOver`/`onDrop` to `<ReactFlow>`; added `defaultEdgeOptions`; set transparent bg | ReactFlow intercepts drag events; needed rounded edges; default bg conflicts with theme |
| `project-sidebar.tsx` | Added `overflow-hidden`; changed translate to `calc(100%+2px)` | Prevents border from peeking at viewport edge when sidebar is closed |
| `app/globals.css` | Added `overflow-x: hidden` on `html`; ReactFlow bg overrides; edge path style | Belt-and-suspenders for sidebar hiding; ensure clean canvas background |
