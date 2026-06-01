# Feature 17 — Canvas Ergonomics

## What This Feature Does

Before this feature, the canvas had no visible zoom or history controls.
Users could scroll to zoom and drag to pan, but there was no button to fit all nodes
into view, no undo/redo, and no keyboard shortcuts for any of these actions.

This feature adds:

- **A floating control bar** at the bottom-left of the canvas — 5 buttons in a pill
  shape: zoom out, fit view, zoom in, undo, redo.
- **Liveblocks-backed undo/redo** — the undo stack tracks every canvas mutation
  (node added, moved, resized, deleted; edge created or deleted; label changed) and
  reverses or replays it collaboratively.
- **Keyboard shortcuts** — `+`/`=` / `-` for zoom, `Cmd+Z` for undo,
  `Cmd+Shift+Z` / `Cmd+Y` for redo. All shortcuts are suppressed while the user is
  typing inside a node or edge label editor.

---

## How the Control Bar Works

### Component structure

`CanvasControls` is a `"use client"` component defined in
`components/editor/canvas-controls.tsx`. It renders an absolutely positioned `<div>`
anchored at `bottom-6 left-6` — the bottom-left corner of the canvas wrapper.

The shape panel (`ShapePanel`) sits at `bottom-6` centred horizontally, so the two
panels never overlap.

Inside the bar there are five buttons separated into two groups by a thin vertical
divider:

```
[ zoom out ]  [ fit view ]  [ zoom in ]  |  [ undo ]  [ redo ]
```

A small private `ControlButton` component (defined in the same file, not exported)
applies shared button styles: `rounded-lg p-1.5 text-copy-primary hover:bg-surface-border
transition-colors`. The undo and redo buttons add `disabled:opacity-40
disabled:cursor-not-allowed` — they dim automatically when the disabled prop is true.

### Why `useReactFlow` lives inside the component

`CanvasControls` calls `useReactFlow()` itself to get `zoomIn`, `zoomOut`, and
`fitView`. This is valid because `CanvasControls` is rendered inside `CanvasFlowInner`,
which is a descendant of `<ReactFlowProvider>`. Any component in that subtree can
call `useReactFlow()`.

An alternative would be to receive the zoom functions as props from the parent, but
that would push React Flow plumbing into `CanvasFlowInner` unnecessarily. Calling the
hook inside the component is the idiomatic React Flow pattern.

### Animated zoom

Every zoom call passes `{ duration: 200 }`:

```ts
zoomIn({ duration: 200 })
zoomOut({ duration: 200 })
fitView({ duration: 200 })
```

React Flow animates the viewport transition over 200 milliseconds using its built-in
easing. Without the duration argument the viewport jumps instantly, which feels abrupt.

### Disabled state for undo/redo

`canUndo` and `canRedo` are live boolean values from Liveblocks. The component re-renders
every time the history stack changes, so the button disabled state is always current
without any extra state management.

---

## How Liveblocks Undo/Redo Works

### The history stack

Liveblocks maintains an undo stack that records every mutation made to the
**Liveblocks Storage** layer. Because `useLiveblocksFlow` stores nodes and edges in
Liveblocks Storage (not local React state), every operation routed through
`onNodesChange`, `onEdgesChange`, `updateNodeData`, or `updateEdgeData` is automatically
tracked.

The three hooks are imported from `@liveblocks/react` and called inside
`CanvasFlowInner`:

```ts
const { undo, redo } = useHistory()
const canUndo = useCanUndo()
const canRedo = useCanRedo()
```

`useHistory()` returns the `undo` and `redo` functions. Calling `undo()` reverses the
most recent Storage mutation; calling `redo()` replays the most recently undone mutation.

`useCanUndo()` and `useCanRedo()` each return a boolean that updates live whenever the
stack changes, keeping the UI disabled states accurate.

### What gets tracked

The undo stack covers anything that modifies Liveblocks Storage:
- Adding a node (drag/drop from shape panel)
- Moving a node
- Resizing a node
- Deleting a node or edge
- Changing a node's colour or label
- Changing an edge's label
- Creating a new edge

Presence changes (cursor positions) are **not** tracked — Liveblocks treats Presence
and Storage as separate concerns, and undo only applies to Storage.

### Collaborative undo

If two collaborators both make changes, each collaborator's undo stack is independent.
Pressing Undo on one client reverses that client's last action, not any action made by
another collaborator. This matches the behaviour of collaborative tools like Figma and
Google Docs.

---

## How the Keyboard Shortcut Hook Works

`useKeyboardShortcuts` is defined in `hooks/useKeyboardShortcuts.ts`. It receives:
- `flow` — the `ReactFlowInstance` from `useReactFlow()` (typed as `ReactFlowInstance | null`)
- `undo` — function from `useHistory()`
- `redo` — function from `useHistory()`

### Event registration

The hook registers a `keydown` listener on `window` inside a `useEffect`:

```ts
useEffect(() => {
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [flow, undo, redo])
```

`window` (not a canvas `<div>`) is the right target because keyboard events bubble to
the window regardless of which element has focus, and there is no React ref required.

The cleanup function removes the listener when the component unmounts or when any
dependency changes. Without the cleanup, old handlers would pile up and fire multiple
times per keystroke.

### The editable-field guard

Before dispatching any shortcut, the handler checks whether the event originated from
a text input:

```ts
function isEditableTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}
```

This catches three cases:
1. `INPUT` — the inline edge label editor (an `<input>` element in `canvas-edge.tsx`)
2. `TEXTAREA` — the inline node label editor (a `<textarea>` in `canvas-node.tsx`)
3. `isContentEditable` — any future `contentEditable` elements

If the user is typing in one of these, the handler returns early and the shortcut is
ignored. This means `Cmd+Z` inside a label editor undoes text typing (the browser's
default), not a canvas action.

### Meta key detection

```ts
const meta = e.metaKey || e.ctrlKey
```

`metaKey` is the Cmd key on macOS; `ctrlKey` is Ctrl on Windows/Linux. Combining both
into one variable means the same shortcut works on any platform without branching.

### Why `e.preventDefault()` on undo/redo but not zoom

`e.preventDefault()` stops the browser's default action for that key combination.

- `Cmd+Z` has a browser default: undo text in focused inputs. Calling `preventDefault`
  here ensures the browser doesn't also try to undo text editing at the same moment.
- `+` and `-` have no meaningful browser default when focus is on the canvas, so
  `preventDefault` is not needed and would only suppress unrelated behaviour elsewhere.

### Why `=` is also mapped to zoom in

On a standard US keyboard, `=` and `+` share a key. Pressing `+` requires Shift. Most
users expect `+` to zoom in without holding Shift (as in browsers, Figma, Miro). By
mapping both `e.key === '+'` and `e.key === '='`, the shortcut works whether or not the
user presses Shift.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| `useReactFlow()` inside `CanvasControls`, not passed as props | Idiomatic React Flow pattern; avoids threading ReactFlow plumbing through parent component |
| `{ duration: 200 }` on every zoom call | Smooth animation makes the viewport transition feel intentional rather than a jarring jump |
| Disabled buttons via `disabled` prop, not conditional render | Keeps the bar layout stable — buttons don't shift position when undo/redo becomes unavailable |
| `useHistory` + `useCanUndo` + `useCanRedo` from `@liveblocks/react` | These are the canonical Liveblocks Storage history hooks; they track everything stored in the Liveblocks room automatically |
| Keyboard listener on `window` | Events bubble to window regardless of focus; no ref needed |
| Editable-field guard using `INPUT`, `TEXTAREA`, `isContentEditable` | Covers all three label editing surfaces in the current codebase without coupling to specific component implementation details |
| `e.preventDefault()` only on undo/redo | Prevents double-undo (browser + app); zoom keys have no browser default that would conflict |
| Mapping both `=` and `+` to zoom in | `+` requires Shift on US keyboards; mapping `=` (the unshifted key) ensures the shortcut works without Shift, matching the convention in major design tools |
| Per-dependency `useEffect` cleanup | Guarantees the handler always closes over the latest `undo`/`redo` references; avoids stale closures that would call old function versions |

---

## Topics to Explore with an AI

### Coding & JavaScript

- "What is `e.metaKey` in a browser keyboard event? How does it differ from `e.ctrlKey`? Why combine both into one variable for cross-platform shortcuts?"
- "What is `e.preventDefault()` in a DOM event? Give three examples: one where you need it, one where it's harmless but unnecessary, and one where calling it accidentally breaks something."
- "What does `e.key` return for keyboard events? How is it different from `e.keyCode` or `e.which`? Why is `e.key` preferred in modern code?"
- "What is `isContentEditable` on a DOM element? What HTML attribute makes an element content-editable, and when would you use it instead of an `<input>` or `<textarea>`?"
- "What is `window.addEventListener('keydown', handler)` doing, and why must we also call `window.removeEventListener('keydown', handler)` in a cleanup function? What happens if we skip the cleanup?"

### React & Framework Specifics

- "Why does `useEffect` return a cleanup function, and when exactly does that cleanup run? Walk through the lifecycle when the `[flow, undo, redo]` dependency array changes."
- "Why can `CanvasControls` call `useReactFlow()` even though it doesn't receive the React Flow instance as a prop? What is React context, and how does `ReactFlowProvider` use it?"
- "What is a stale closure in React? How could skipping the dependency array on `useEffect` cause the keyboard handler to call an old `undo` function? Give a concrete example."
- "What does `disabled` do on an HTML `<button>` element? What events does it suppress? How does React handle the `disabled` prop on controlled components?"
- "How do `useCanUndo` and `useCanRedo` cause a re-render when the Liveblocks history stack changes? What mechanism does Liveblocks use to notify React components of external state changes?"

### System Design & Architecture

- "What is an undo stack? Describe a simple command pattern implementation — what data would each entry on the stack contain, and how would push/pop work for undo and redo?"
- "Liveblocks tracks undo/redo per-client in a collaborative session. What are the trade-offs of per-client undo versus shared global undo? Which approach do tools like Figma, Google Docs, and Miro use?"
- "What is the difference between undoing a Liveblocks Storage mutation and undoing a Liveblocks Presence change? Why does Liveblocks only track one of these in its history?"
- "If two collaborators are on the canvas and both press Cmd+Z at the same time, what happens? Are the operations independent or do they interact? What does Liveblocks guarantee about the resulting state?"
- "Keyboard shortcuts are attached to `window`. What if a future feature opens a modal dialog — should the canvas shortcuts fire while the modal is open? How would you implement a 'shortcut scope' system to prevent this?"

### TypeScript & Data Structures

- "Why is the `flow` parameter typed as `ReactFlowInstance | null` rather than just `ReactFlowInstance`? What does the optional chaining operator `?.` do when `flow` is null?"
- "What does `React.ReactNode` mean as a TypeScript type? What values does it accept, and how is it different from `JSX.Element` or `React.ReactElement`?"
- "In the line `const { zoomIn, zoomOut, fitView } = useReactFlow()`, what type does TypeScript infer for each destructured variable? How can you find out using IDE tooling?"
- "What is a function type in TypeScript? Write the type signature for an `undo` function that takes no arguments and returns nothing. How would you make a function prop optional in an interface?"
- "What is the difference between `interface` and `type` in TypeScript for defining the `CanvasControlsProps` shape? When would the distinction matter?"

### CSS & Visual Design

- "What is `opacity: 0.4` vs `visibility: hidden` vs `pointer-events: none`? For a disabled button that should look dimmed but occupy space, which is the right choice and why?"
- "What does `transition-colors` do in Tailwind? What CSS property does it generate, and what triggers the transition? Why is a transition useful on hover states for buttons?"
- "What is `absolute` positioning in CSS? What does an absolutely-positioned element position itself relative to? Why does `CanvasControls` position correctly relative to the canvas wrapper?"
- "What is `cursor-not-allowed` as a CSS cursor value? What visual feedback does it give users, and when is it appropriate to use it versus hiding the element entirely?"
- "The divider between zoom and history groups uses `w-px h-4 bg-surface-border`. What does `w-px` mean in Tailwind? What CSS value does it generate?"
