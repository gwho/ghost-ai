# Feature 14 — Node Resizing + Inline Label Editing

## What This Feature Does

Before this feature, canvas nodes had a fixed size set when you dropped them, and their labels could only be set by other means. This feature adds two interactive behaviours directly on the canvas:

1. **Resizing** — when a node is selected, small handles appear at its corners and edges. You can drag them to make the node larger or smaller, with a minimum size enforced so the node never collapses.

2. **Inline label editing** — double-clicking a node opens a text field directly over the label. You can type, and the label updates live. Clicking away or pressing Escape closes the editor.

Both features update node state through the same path as all other canvas changes, so they sync to all collaborators in real time.

---

## How Resizing Works

### The `NodeResizer` Component

React Flow ships a built-in `NodeResizer` component. When you render it inside a custom node, React Flow does all the heavy lifting:

- It draws the resize handles at the corners and midpoints of the node's edges.
- When you drag a handle, it calculates the new width and height.
- It dispatches those changes through React Flow's standard `onNodesChange` mechanism — the same pipeline that Liveblocks listens to for collaborative sync.

Nothing extra needs to be configured. You just drop `<NodeResizer />` into your node component.

### Visibility and Minimum Size

Two props control the most important behaviour:

```tsx
<NodeResizer
  isVisible={!!selected}
  minWidth={80}
  minHeight={40}
/>
```

- `isVisible` — the handles are only shown when the node is selected. Showing them all the time would clutter the canvas. React Flow passes a `selected` boolean prop to every custom node; we use that here.
- `minWidth` / `minHeight` — React Flow enforces these automatically. If you try to drag a handle beyond the minimum, it stops. This prevents nodes from collapsing to an unusable size.

### Subtle Styling

The handles are styled to match the dark canvas theme:

```tsx
handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--accent-primary)' }}
lineStyle={{ borderColor: 'var(--accent-primary)', opacity: 0.5 }}
```

The line around the node (the resize border) is the accent colour at half opacity — visible enough to indicate you can resize, subtle enough not to distract. The handles are small square dots in the same accent colour.

`var(--accent-primary)` is a CSS custom property defined in `globals.css`. Using a token instead of a hardcoded colour means the handle colour will automatically update if the theme changes.

---

## How Inline Label Editing Works

### The Three States

The label area of each node is always in one of two states:

| State | What you see | What's rendered |
|---|---|---|
| Not editing | The label text (or faint "node" placeholder) | A `<span>` |
| Editing | A text field in the same position | A `<textarea>` |

The component tracks which state it's in using React's `useState`:

```tsx
const [editing, setEditing] = useState(false)
const [draft, setDraft] = useState('')
```

`editing` is the switch; `draft` holds the text currently in the textarea.

### Entering Edit Mode

Double-clicking the label area triggers `startEditing`:

```tsx
const startEditing = useCallback((e: React.MouseEvent) => {
  e.stopPropagation()
  setDraft(label ?? '')
  setEditing(true)
}, [label])
```

Two things happen:
1. The current label is copied into `draft` so the textarea starts with the existing text.
2. `editing` is set to `true`, which swaps the `<span>` for the `<textarea>`.

`e.stopPropagation()` prevents the double-click from reaching React Flow, which would otherwise interpret it as a canvas interaction (for example, zooming to fit).

### Focusing the Textarea

After `editing` becomes `true`, the textarea needs to receive keyboard focus automatically. We can't call `.focus()` the instant we set state — the textarea hasn't rendered yet. Instead we use `useEffect`:

```tsx
useEffect(() => {
  if (editing) textareaRef.current?.focus()
}, [editing])
```

`useEffect` runs *after* the render. By the time it runs, the textarea is in the DOM and `.focus()` works. `textareaRef` is a `useRef` attached to the textarea element.

### Updating as You Type

Every keystroke calls `handleChange`:

```tsx
const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setDraft(e.target.value)
  updateNodeData(id, { label: e.target.value })
}, [id, updateNodeData])
```

`updateNodeData` is a function from React Flow's `useReactFlow` hook. It updates the `data` of the node with the given `id`. Because Liveblocks patches React Flow's state management, this change is immediately broadcast to all collaborators — the label updates live on every keystroke.

`draft` is also updated locally so the textarea remains a controlled component (its value always matches React state).

### Closing the Editor

Two things close the editor:

1. **Blur** — clicking anywhere outside the textarea fires the `onBlur` event, which calls `commitEdit` and sets `editing` to `false`. The label is already persisted (updated on every keystroke), so there's nothing extra to save.
2. **Escape** — the `onKeyDown` handler checks for `Escape` and calls `setEditing(false)`. Since the label updates live as you type, pressing Escape closes the editor with the most recently typed text already saved.

### Preventing Canvas Interactions While Editing

A text field inside a draggable React Flow node is tricky: mouse events on the textarea might be interpreted as "drag the node" or "pan the canvas." Two defences are in place:

1. **React Flow's built-in class names** — the textarea has `className="nodrag nopan ..."`. React Flow watches for these class names and skips drag/pan logic for any element that has them.
2. **`onMouseDown` stop propagation** — as a belt-and-suspenders guard, `onMouseDown={(e) => e.stopPropagation()}` stops the mouse-down event from bubbling up to the node drag handler.

Together these mean clicking inside the textarea or typing always stays in the text field, never moves the node or pans the canvas.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| `NodeResizer` from `@xyflow/react` | It's the canonical way to add resizing in React Flow. It hooks into the same `onNodesChange` pipeline Liveblocks already intercepts, so resize events sync collaboratively for free. |
| `isVisible={!!selected}` | Showing handles only on the selected node keeps the canvas uncluttered. The double `!!` converts `selected` (which could be `undefined`) to a boolean. |
| `minWidth={80}` / `minHeight={40}` | Hard minimum prevents nodes from becoming invisible. React Flow enforces these in its resize logic without extra code. |
| `useReactFlow().updateNodeData` | The idiomatic React Flow v12 API for changing node data. Dispatches changes through the internal store that Liveblocks watches. |
| Update on every keystroke | Matches "update the label as users type" in the spec. More collaborative — other users see the label changing live, not just after blur. |
| `useEffect` for auto-focus | `useState` setters are asynchronous in React — the DOM isn't updated immediately. `useEffect` runs after the DOM update, guaranteeing the textarea exists before `.focus()` is called. |
| `nodrag nopan` + `stopPropagation` | Two independent defences for the same problem. React Flow's class-based check is the primary guard; `stopPropagation` is a fallback for edge cases. |
| Escape closes (doesn't revert) | Since we update on every keystroke, there's nothing to revert to — the label is already saved. Escape is just "close the editor." |
| `aria-label="Node label"` | Textareas without a visible `<label>` element need an ARIA attribute so screen readers know what the field is for. |

---

## Topics to Explore with an AI

### Coding & JavaScript

- "What is `e.stopPropagation()` and how is it different from `e.preventDefault()`? When would you use each one?"
- "What does `useRef` do in React, and why do we need it to call `.focus()` on a DOM element? Why can't we just use a regular variable?"
- "Why does `setState` not immediately update the DOM? What does React do between calling `setState` and the next render?"
- "Explain the `??` (nullish coalescing) operator. How is `label ?? ''` different from `label || ''`?"
- "What is a controlled component in React? How does keeping `draft` in sync with the textarea's `value` prop make it controlled?"

### React & Framework Specifics

- "When exactly does `useEffect` run relative to rendering? Why is that useful for focusing a DOM element after a state change?"
- "What is the `useCallback` hook for? Why does every handler in this component use it, and what would happen if we didn't?"
- "How does React Flow pass `id`, `data`, and `selected` to a custom node component? Where in the library does that wiring happen?"
- "What is `useReactFlow` and why must it be called inside a component that's a descendant of `<ReactFlowProvider>`?"
- "How does `updateNodeData` differ from calling `onNodesChange` with a `{ type: 'replace' }` change? What does it do internally?"

### System Design & Architecture

- "How does Liveblocks intercept React Flow's node change events to sync state to other clients? At what layer does the patching happen?"
- "What trade-offs come with updating node data on every keystroke vs. only on blur? How would you decide which to use in a production collaborative editor?"
- "If two users edited the same node's label at the same time, what would happen with this implementation? How do conflict-free replicated data types (CRDTs) address that problem?"
- "Why does the resize feature work 'for free' with Liveblocks, while a naive approach of storing width in local state would break collaboration?"
- "What would need to change to support undo/redo of label edits? What about undo/redo of resize operations?"

### TypeScript & Data Structures

- "Why does `isVisible={!!selected}` use double negation instead of just `isVisible={selected}`? What type does `selected` have in `NodeProps`?"
- "What is `useRef<HTMLTextAreaElement>(null)` doing at the type level? Why is the generic parameter important?"
- "How does TypeScript's type narrowing work in this file — specifically, how does the `if (nodeShape === 'diamond')` check narrow the type?"
- "What's the difference between `React.MouseEvent` and `MouseEvent`? When do you use each?"

### CSS, Accessibility & Browser APIs

- "What does `pointer-events: none` do, and why does the resize handle need careful pointer-event management?"
- "Why does a `<textarea>` without a visible label need `aria-label`? How do screen readers use ARIA attributes?"
- "What are CSS custom properties (`var(--name)`) and why are they preferred over hardcoded values in a design system? What happens when the property isn't defined?"
- "What does `nodrag` and `nopan` do in React Flow? How does React Flow detect these class names on elements during its event handling?"
- "Why does `onMouseDown` need to call `stopPropagation` inside the textarea, even though `nodrag`/`nopan` classes are also present?"
