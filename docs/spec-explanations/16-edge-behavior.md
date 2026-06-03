# Feature 16 — Edge Behavior

## What This Feature Does

Before this feature, connections between nodes used React Flow's default smoothstep
renderer. There was no custom styling, no arrowhead, and no way to add a label to an
edge. Connection handles (the small dots you drag from to create a connection) were
visible at all times using React Flow's default appearance.

This feature replaces all of that with:

- **Subtle connection handles** on every node — small white dots that are hidden by
  default and fade in only when you hover a node, keeping the canvas clean.
- **A custom edge renderer** with right-angle routing, a dynamic arrowhead, and a wide
  invisible click area so edges are easy to select without increasing their visible thickness.
- **Inline edge label editing** — double-click anywhere on an edge to open a text input
  at the edge's midpoint; the label syncs to all collaborators in real time.

---

## How Connection Handles Work

### What handles are

A **handle** is the small dot on the edge of a node that you drag from (or drop onto)
to create a connection. React Flow renders handles as HTML `<div>` elements inside each
custom node component.

In `canvas-node.tsx`, four handles are declared:

```tsx
const HANDLES = (
  <>
    <Handle type="target" position={Position.Top} />
    <Handle type="target" position={Position.Left} />
    <Handle type="source" position={Position.Bottom} />
    <Handle type="source" position={Position.Right} />
  </>
)
```

`type="source"` means this handle starts a connection; `type="target"` means it receives one.
However, the canvas uses `ConnectionMode.Loose` (set in `canvas-flow.tsx`), which means
React Flow ignores these type designations and allows any handle to connect to any other
handle. The type values only affect the default visual indicator — the actual routing is
determined by the handle positions.

### Why handles are hidden by default

Having 4 handles visible on every node at all times clutters the canvas.
CSS in `globals.css` hides them until needed:

```css
.react-flow__handle {
  opacity: 0;
  transition: opacity 0.15s;
}
.react-flow__node:hover .react-flow__handle,
.react-flow--connecting .react-flow__handle {
  opacity: 1;
}
```

Two triggers show the handles:

1. **Hovering a node** (`.react-flow__node:hover`) — the user is interacting with this
   node, so showing the handles makes sense.
2. **A connection is being dragged** (`.react-flow--connecting`) — React Flow adds this
   class to the root element when you are actively dragging a new edge. All nodes reveal
   their handles so you can see where to drop the connection.

### Why `!important` is needed

React Flow ships its own CSS stylesheet (imported in `canvas-flow.tsx` via
`import '@xyflow/react/dist/style.css'`). That stylesheet sets the handle background,
border, size, and border-radius. Without `!important`, the project's styles would
be overridden by the library's defaults because stylesheet load order is
non-deterministic in Next.js.

---

## How the Custom Edge Renderer Works

### What an edge renderer is

React Flow calls a registered edge component for every edge it needs to draw.
The component receives the source and target coordinates plus the edge's stored data,
and it returns SVG (for the path) plus any HTML overlays (for labels).

The component is registered in `canvas-flow.tsx`:

```ts
const edgeTypes: EdgeTypes = { canvasEdge: CanvasEdgeComponent }
```

And linked to new edges via:

```ts
defaultEdgeOptions={{ type: 'canvasEdge' }}
```

### The two-path technique

Every edge renders two `<path>` elements on top of each other:

```tsx
{/* 1. invisible wide path for hit detection */}
<path
  d={edgePath}
  strokeOpacity={0}
  strokeWidth={16}
  style={{ pointerEvents: 'all' }}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
/>

{/* 2. visible thin path */}
<path
  d={edgePath}
  stroke={strokeColor}
  strokeWidth={1.5}
  markerEnd={`url(#${markerId})`}
  style={{ pointerEvents: 'none' }}
/>
```

The invisible path is 16px wide, making the edge easy to hover and click even when
the cursor is far from the 1.5px visible line. The visible path has `pointerEvents: none`
so all mouse events go to the invisible path beneath it.

### Why `strokeOpacity={0}` and not `stroke="transparent"`

In SVG, elements with `stroke="transparent"` do not receive pointer events in some
browsers because the browser treats `transparent` as "no paint, therefore no target."
`strokeOpacity={0}` keeps the stroke present as an invisible painted area, which means
`pointerEvents: all` works reliably across browsers.

### Dynamic arrowhead colour

React Flow's built-in `MarkerType.ArrowClosed` creates a shared SVG `<marker>` element.
Its `fill` is set once as a static attribute — it can't change when the edge brightens
on hover. To make the arrowhead colour match the path on hover and select, the component
defines its own marker inline using `<defs>`:

```tsx
<defs>
  <marker id={`canvas-arrow-${id}`} viewBox="0 0 10 6" refX="9" refY="3"
    markerWidth="8" markerHeight="6" orient="auto">
    <path d="M 0 0 L 10 3 L 0 6 z" fill={strokeColor} />
  </marker>
</defs>
```

`strokeColor` is a JavaScript variable — it re-renders whenever hover or select state
changes, so the arrowhead is always the same colour as the path. Each edge gets a unique
marker ID (`canvas-arrow-${id}`) so edges don't share a single marker and conflict.

### Hover and select state

```ts
const isActive = hovered || !!selected
const strokeColor = isActive ? 'var(--text-secondary)' : 'var(--border-subtle)'
```

`selected` is a boolean prop React Flow passes automatically to every edge component
(the same way it passes `selected` to node components). `hovered` is local React state
tracked by the invisible path's mouse events. When either is true, the edge brightens.

---

## How `getSmoothStepPath` and `EdgeLabelRenderer` Work

### Right-angle routing

`getSmoothStepPath` is a utility function from `@xyflow/react`. You give it the source
and target coordinates and handle positions; it returns an SVG path string that routes
at right angles with rounded corners:

```ts
const [edgePath, labelX, labelY] = getSmoothStepPath({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
})
```

The return value is a 5-element tuple: `[path, labelX, labelY, offsetX, offsetY]`.
We destructure only the first three. `path` is the SVG `d` attribute string. `labelX`
and `labelY` are **canvas coordinates** at the exact midpoint of the path — React Flow
calculates them for us so we never need to do the midpoint maths manually.

The spec is explicit about this: *"use React Flow's `EdgeLabelRenderer` and the path
midpoint coordinates from `getSmoothStepPath` to position the label — do not calculate
midpoint position manually."*

### The problem with SVG text

Edge paths are drawn inside an SVG element. SVG supports `<text>` elements, but they
can't render `<input>` fields, buttons, or HTML-styled badges. To overlay HTML on top
of a canvas SVG, React Flow provides `EdgeLabelRenderer`.

`EdgeLabelRenderer` is a React component that renders its children into a special
React portal that sits above the SVG in the DOM but is positioned within the same
coordinate space. This means you can place a normal HTML `<div>` at exact canvas
coordinates without needing `<foreignObject>` (which has poor browser support and
layout quirks).

### Label positioning

```tsx
<EdgeLabelRenderer>
  <div
    style={{
      position: 'absolute',
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: 'all',
    }}
    className="nodrag nopan"
  >
    {/* label content */}
  </div>
</EdgeLabelRenderer>
```

The `transform` has two parts:
1. `translate(-50%, -50%)` — centres the div on its own anchor point (so the anchor
   point is the div's centre, not its top-left corner).
2. `translate(${labelX}px, ${labelY}px)` — moves the anchor point to the path midpoint
   in canvas coordinates.

`pointerEvents: all` is required because `EdgeLabelRenderer`'s container has
`pointer-events: none` by default (so clicks pass through to the canvas). We override
this only for the label div so click/double-click on the label work correctly.

---

## How Inline Edge Label Editing Works

This follows the same pattern as the node label editing introduced in Feature 14.
The three states are controlled by two pieces of React state — `editing` (boolean) and
`draft` (string):

| State | What renders |
|---|---|
| `editing = true` | `<input>` with auto-sized width |
| `editing = false` and `label` has content | Pill badge displaying the label |
| `editing = false`, no label, edge is active | Faint "label" hint text |
| `editing = false`, no label, edge is idle | Nothing |

### Opening and closing the editor

Double-clicking the label area opens the editor:

```tsx
onDoubleClick={(e) => {
  e.stopPropagation()
  setDraft(label)
  setEditing(true)
}}
```

`e.stopPropagation()` prevents the double-click from bubbling up to the canvas
(which would deselect the edge or trigger other canvas interactions).
`setDraft(label)` seeds the input with the current saved label.

Closing on blur, Enter, or Escape:

```tsx
onBlur={() => setEditing(false)}
onKeyDown={(e) => {
  e.stopPropagation()
  if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
}}
```

### Live sync while typing

Every keystroke calls:

```tsx
onChange={(e) => {
  setDraft(e.target.value)
  updateEdgeData(id, { label: e.target.value })
}}
```

`updateEdgeData` is from `useReactFlow()`. It patches the `data` object of the given
edge — exactly like `updateNodeData` for nodes. Because Liveblocks wraps React Flow's
state layer, this change is automatically broadcast to all collaborators with no extra
wiring. The spec calls this "the existing collaborative edge data flow."

### Auto-sized input width

```tsx
style={{ width: `${Math.max((draft.length || 4) * 9, 60)}px` }}
```

The width grows as the user types: 9px per character, with a minimum of 60px so the
input isn't a single character wide when empty. This is a simple heuristic — for a
proportional font, character widths vary, but 9px per character is a reasonable
average for the `text-xs` size used here.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| Hide handles with CSS, not React state | CSS selector cascade (`:hover`, `.react-flow--connecting`) handles multiple conditions cleanly with no JS overhead — no event listeners, no re-renders |
| `!important` on handle styles | React Flow's own stylesheet overrides project styles without it; this is a deliberate library escape hatch, not an anti-pattern |
| Wide invisible path for hit testing | Makes 1.5px edges practical to click — the visible line stays thin while the interactive target is generous |
| `strokeOpacity={0}` not `stroke="transparent"` | Guarantees pointer events fire in all browsers; `transparent` is treated as "no paint" by some SVG renderers |
| Per-edge inline `<marker>` with `<defs>` | Lets the arrowhead colour update with hover/select state; a shared global marker can't do this |
| `getSmoothStepPath` for midpoint | Library-provided, always accurate even when the edge routes around corners; manual midpoint maths would be wrong for non-straight paths |
| `EdgeLabelRenderer` not `<foreignObject>` | EdgeLabelRenderer is the canonical React Flow pattern — it avoids `foreignObject` layout bugs and places HTML in the same coordinate space without custom z-index management |
| `updateEdgeData` (live, on every keystroke) | Consistent with the node label pattern from Feature 14; collaborators see typing as it happens, not just after blur |
| `nodrag nopan` + `stopPropagation` | Belt-and-suspenders (same as Features 14 and 15) — class check is React Flow's primary guard; `stopPropagation` catches edge cases where the class alone isn't enough |
| Three-state label UI | Clean: editing input → pill badge → faint hint. The hint gives users the affordance "this is editable" without showing a persistent UI element on every edge |

---

## Topics to Explore with an AI

### Coding & JavaScript

- "What is an SVG `<path>` element? What does the `d` attribute contain, and how do commands like `M`, `L`, and `Z` describe a shape? Walk me through the arrowhead path `M 0 0 L 10 3 L 0 6 z`."
- "What does `strokeOpacity={0}` do in SVG? How is it different from `stroke='transparent'` or `opacity={0}`? Why does each behave differently for pointer events?"
- "What is a SVG `<marker>` element? What do `refX`, `refY`, `markerWidth`, `markerHeight`, and `orient='auto'` each control? How does `url(#markerId)` link the marker to a path?"
- "What does `e.stopPropagation()` do in a DOM event? Why is it called on both `onDoubleClick` and `onKeyDown` in the label editor — what specific bubbling would happen if it were omitted?"
- "What is a React portal? How does `ReactDOM.createPortal` work under the hood, and why does `EdgeLabelRenderer` use one to place HTML labels above an SVG canvas?"

### React & Framework Specifics

- "What does `useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])` do? Why can't you call `.focus()` inside the `onDoubleClick` handler instead of in a `useEffect`?"
- "Why is `edgeTypes` defined outside the `CanvasFlowInner` component? What would happen to React Flow if `edgeTypes` were defined inside the component and re-created on every render?"
- "How does React Flow's `EdgeLabelRenderer` move HTML elements into a portal? What does the resulting DOM tree look like, and why is it positioned in the same coordinate space as the SVG?"
- "How does React Flow pass `selected`, `id`, `data`, `sourceX`, `sourceY`, etc. to a custom edge component? Where is this wiring set up inside the library?"
- "What is the `useReactFlow` hook and why must it be called inside a component that is a descendant of `<ReactFlowProvider>`? What would happen if you called it in a component at the same level as `<ReactFlow>`?"

### System Design & Architecture

- "How does Liveblocks intercept `updateEdgeData` to broadcast changes to other clients? At what layer does the `@liveblocks/react-flow` integration patch React Flow's state management?"
- "Feature 16 stores the edge label in the edge's `data` object. What other storage options exist in a real-time collaborative app (server database, client-only state, shared presence)? What are the trade-offs?"
- "If two collaborators double-click the same edge label at the same moment and start typing, what happens? Does Liveblocks guarantee a consistent result, and if so, how?"
- "The invisible wide hitbox path duplicates the edge path string. If the same path is used twice in SVG, is there a DOM cost? How would you refactor this if you needed to eliminate the duplicate?"
- "How would you add undo/redo for edge label changes? What state would you need to track, where would it live, and how would you integrate it with Liveblocks?"

### TypeScript & Data Structures

- "Why does `EdgeData` extend `Record<string, unknown>`? What TypeScript constraint requires this, and what would happen if you omitted the extension?"
- "In the line `const { label = '' } = (data as EdgeData) ?? {}`, what does `?? {}` guard against? Why is `data as EdgeData` a type assertion rather than a type check?"
- "What does TypeScript infer as the type of the `getSmoothStepPath(...)` return value? How does array destructuring `const [edgePath, labelX, labelY] = ...` interact with a tuple type versus a plain array type?"
- "What is `EdgeProps` in React Flow's type system? What properties does it include, and how does TypeScript enforce that a custom edge component receives the right props?"
- "What is the difference between `type EdgeData = { label?: string }` and `interface EdgeData { label?: string }`? When does the distinction matter in TypeScript?"

### CSS & Visual Design

- "What does `opacity: 0` plus `transition: opacity 0.15s` do? How is this different from `visibility: hidden` or `display: none` for the fade-in effect?"
- "Why does CSS `!important` override the React Flow stylesheet, and when is using `!important` appropriate versus a code smell? What alternative approaches exist for overriding third-party library styles?"
- "What is the CSS `.react-flow__node:hover .react-flow__handle` selector doing? How does the descendant selector work, and why does hovering the parent reveal a child element?"
- "What is `pointer-events: none` in CSS? Give three real-world examples where you would apply it — one where it helps UX, one where it prevents an interaction bug, one where it enables a layering technique."
- "What is `strokeLinecap='round'` in SVG? How does it differ from `square` and `butt`? What does it change visually at the ends and joints of a path?"
