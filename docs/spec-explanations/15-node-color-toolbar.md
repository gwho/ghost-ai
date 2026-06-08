# Feature 15 — Node Color Toolbar

## What This Feature Does

Before this feature, every node you dropped on the canvas used the same default colour — a near-black background with light grey text. You had no way to change it.

This feature adds a small floating toolbar that appears above a node when you click it. The toolbar shows 8 circular colour swatches. Clicking a swatch instantly changes the node's background to that colour and its text to a matching readable colour — both update live, on every collaborator's screen, with no page reload or server round-trip required.

---

## How the Colour Palette Works

### Predefined pairs, not free colour choice

The spec deliberately limits the palette to 8 fixed pairs. Each pair is a dark background colour and a vivid text colour chosen to be readable on top of it. For example: a deep navy background with bright blue text, or a dark plum background with soft purple text.

These pairs are defined in `types/canvas.ts` as a constant called `NODE_COLORS`:

```ts
export const NODE_COLORS = [
  { fill: '#1F1F1F', text: '#EDEDED' },  // neutral dark (default)
  { fill: '#10233D', text: '#52A8FF' },  // blue
  { fill: '#2E1938', text: '#BF7AF0' },  // purple
  // ...and so on
] as const
```

The `fill` is the background hex colour. The `text` is the hex colour for the label. When you select a swatch, the app stores only the `fill` value on the node. When the node renders, it looks up the full pair by matching that fill value — so the text colour is always derived from the fill, never stored separately.

This is already how the node was rendering colours before this feature — Feature 15 just adds the UI to change them.

### Why predefined pairs?

A full colour picker would let users pick any background they wanted, but then the text colour might be unreadable (imagine white text on a pale yellow background). By pairing each background with a curated text colour, the app guarantees every node is always readable without the user needing to think about contrast.

---

## How the Floating Toolbar Works

### `NodeToolbar` — React Flow's built-in solution

The toolbar is built using React Flow's `NodeToolbar` component. You drop it inside a custom node component and React Flow handles all the positioning and z-index management automatically — it lifts the toolbar out of the node's DOM element and renders it as an overlay above the canvas.

```tsx
<NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
  {/* swatches go here */}
</NodeToolbar>
```

- `isVisible={!!selected}` — the toolbar only appears when the node is selected. `selected` is a boolean prop React Flow automatically passes to every custom node.
- `position={Position.Top}` — anchors the toolbar to the top edge of the node.
- `offset={8}` — adds 8 pixels of gap so the toolbar floats just above the node without overlapping it.

### Swatch appearance

Each swatch is a small circle rendered as a `<button>`:

- Its background colour is the `fill` from the palette pair.
- The **active swatch** (the colour the node is currently using) shows a coloured outline ring matching the palette's text colour — a clear visual signal of which colour is selected.
- **Hovering** a swatch adds a soft glow around it. The glow is the text colour at 35% opacity — tight and controlled, based on each swatch's own accent colour.
- The glow and ring use inline styles rather than CSS classes because the colours are runtime values (different for each swatch) that can't be written as static utility classes.

### Keeping it from interfering with drag

A toolbar inside a draggable node is tricky: clicks on the toolbar buttons might be interpreted as "start dragging this node." Two defences prevent that:

1. `nodrag nopan` class names on the container and each button — React Flow watches for these and skips its drag/pan logic for any element that has them.
2. `onMouseDown={(e) => e.stopPropagation()}` on the toolbar container — stops the mouse-down event from bubbling up to the node's drag handler.

---

## How the Colour Update Works

When you click a swatch, one line of code runs:

```tsx
updateNodeData(id, { color: c.fill })
```

`updateNodeData` is a function from React Flow's `useReactFlow` hook. It updates the `data` object of the node with the given `id`. Because Liveblocks patches React Flow's state management, this change is automatically broadcast to every collaborator in real time — no server calls, no extra wiring needed.

The node re-renders immediately with the new fill, and looks up the matching text colour from `NODE_COLORS` — so both colours update in one step from a single stored value.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| Predefined colour pairs | Guarantees readable contrast on every node without the user needing to think about it |
| Store only `fill`, derive `text` | The text colour is always the "correct" partner for the fill — storing them separately would allow them to get out of sync |
| `NodeToolbar` from `@xyflow/react` | The canonical way to render floating per-node UI in React Flow — handles positioning, z-index, and portalling automatically |
| `isVisible={!!selected}` | Shows the toolbar only on the selected node — uncluttered canvas when nothing is selected |
| `offset={8}` | Small gap so the toolbar doesn't overlap the node's top edge or resize handles |
| Hover glow via `onMouseEnter`/`onMouseLeave` | The glow colour is per-swatch and comes from `NODE_COLORS` at runtime — it can't be expressed as a Tailwind class, so direct DOM style manipulation is used |
| Active swatch uses `outline` not `border` | `outline` sits outside the element box and doesn't affect the swatch's size or layout |
| `updateNodeData` + no server call | Canvas state lives in Liveblocks, not the database — colour is a canvas property, not a persisted project property |
| `nodrag nopan` + `stopPropagation` | Belt-and-suspenders defence: the class check is React Flow's primary guard; `stopPropagation` catches any edge cases |

---

## Topics to Explore with an AI

### Coding & JavaScript

- "What is a hex colour code and how does the `parseInt(hex.slice(1, 3), 16)` technique convert it to an RGB number? Walk me through the maths."
- "What does `as const` do to a TypeScript array? How does it change the inferred type compared to a plain array declaration?"
- "What is `e.stopPropagation()` and how is it different from `e.preventDefault()`? When would you use each one?"
- "Explain the `??` (nullish coalescing) operator. How is `color ?? NODE_COLORS[0].fill` different from `color || NODE_COLORS[0].fill`?"
- "Why can't you write a CSS class like `hover:shadow-[...]` when the colour value comes from a JavaScript variable at runtime? What's the boundary between compile-time and runtime in Tailwind?"

### React & Framework Specifics

- "What is `useReactFlow()` and why must it be called inside a component that is a descendant of `<ReactFlowProvider>`?"
- "How does React Flow pass `selected`, `id`, and `data` to a custom node component? Where does that wiring happen inside the library?"
- "What does `NodeToolbar` actually render in the DOM? How does React Flow move it outside the node's container element and above the canvas?"
- "What is the difference between manipulating `element.style.boxShadow` directly versus using a `useState` to re-render with a new className? When would you choose one over the other?"
- "How does `onMouseEnter`/`onMouseLeave` differ from the CSS `:hover` pseudo-class? When does the JavaScript version give you more control?"

### System Design & Architecture

- "How does Liveblocks intercept React Flow's `updateNodeData` call to broadcast the change to other clients? At what layer does the integration work?"
- "This feature stores only the `fill` hex on the node and derives `text` at render time. What are the trade-offs of this approach versus storing both? What would break if a colour pair changed in `NODE_COLORS`?"
- "How would you design a system that lets users define their own colour pairs, not just use the predefined ones? What would need to change in the data model, the UI, and the storage layer?"
- "What is a CRDT (conflict-free replicated data type) and why does it matter for collaborative real-time apps? How does Liveblocks use CRDTs under the hood?"
- "If you wanted to add undo/redo for colour changes, how would you approach it? What state would you need to track, and where would it live?"

### TypeScript & Data Structures

- "What does `as const` do to `NODE_COLORS`? What is the difference between `{ fill: string, text: string }[]` and the type TypeScript infers with `as const`?"
- "How does `NODE_COLORS.find(c => c.fill === color)` work? What does `.find()` return if no match is found, and how does `?? NODE_COLORS[0]` handle that case?"
- "What is a discriminated union in TypeScript? Could `NODE_COLORS` be replaced with an enum or a map? What would be the trade-offs?"
- "Why is `NodeProps` used as the component's prop type rather than a hand-written interface? What does it provide that a custom `{ id: string; data: NodeData; selected: boolean }` would not?"

### CSS & Visual Design

- "What is `outline` in CSS and how is it different from `border`? Why does adding an `outline` not affect layout while `border` does?"
- "What is `box-shadow` with a zero blur radius (`0 0 0 3px rgba(...)`) — and why does this produce a solid ring rather than a soft shadow?"
- "What is colour contrast and why does it matter for accessibility? How would you check if a text colour is readable on a given background?"
- "What is `outlineOffset` in CSS and what does setting it to `2px` do to the active swatch ring?"
- "What does CSS `transition-all` do on a button? What properties does it animate, and are there any performance concerns with using `all`?"
