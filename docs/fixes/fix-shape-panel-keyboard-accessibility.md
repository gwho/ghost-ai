# Fix: Shape Panel — Keyboard Accessibility and ARIA Labels

## What Was Wrong

The shape panel buttons in `components/editor/shape-panel.tsx` had two
accessibility problems.

### Problem 1: No `aria-label`

Each button had a `title` attribute:

```tsx
<button
  title={config.label}
  ...
>
```

`title` shows a browser tooltip on mouse hover, but it is not reliably
announced by screen readers. Many screen readers ignore `title` when
other accessible name sources are present, and some only announce it
inconsistently depending on focus mode. The correct attribute for
providing an accessible name to an icon-only button is `aria-label`.

### Problem 2: No click or keyboard activation

The buttons had `onDragStart` but no `onClick`. Clicking a button — with
a mouse, Enter key, or Space bar — did nothing:

```tsx
<button
  draggable
  onDragStart={(e) => handleDragStart(e, config)}
  // no onClick — keyboard and mouse users cannot create shapes
>
```

Drag-and-drop is inherently mouse-only. A user who cannot drag (keyboard
users, switch access users, some screen reader users) had no alternative
way to place a shape on the canvas.

| File | Finding | Status |
| --- | --- | --- |
| `components/editor/shape-panel.tsx` | `title` used instead of `aria-label` | Fixed |
| `components/editor/shape-panel.tsx` | No `onClick` / keyboard handler | Fixed |
| `components/editor/canvas-flow.tsx` | No handler to receive keyboard shape creation | Fixed |

---

## The Fix

### Fix 1: `aria-label` on every shape button (`shape-panel.tsx`)

```tsx
// Before
<button title={config.label} ...>

// After
<button aria-label={config.label} ...>
```

`title` is removed because `aria-label` takes over the same role (naming
the button) and is the attribute screen readers actually use.

### Fix 2: `onClick` calling a prop callback (`shape-panel.tsx`)

A new optional prop `onCreateShape` is added to `ShapePanel`. When the
button is clicked, it calls that prop with the shape name, width, and
height — the same data that would have been carried in the drag payload:

```tsx
// New prop interface
interface ShapePanelProps {
  onCreateShape?: (shape: NodeShape, width: number, height: number) => void
}

// onClick on every button
onClick={() => onCreateShape?.(config.shape, config.width, config.height)}
```

The `?.` (optional chaining) means calling `ShapePanel` without
`onCreateShape` is still valid — the prop is optional and the button
simply does nothing on click if the parent does not provide it.

### Fix 3: `onCreateShape` callback in `CanvasFlowInner` (`canvas-flow.tsx`)

The callback receives the shape data and places a new node at the centre
of the current viewport. This mirrors exactly what the drop handler does,
except the position comes from the screen centre rather than the drop
coordinates:

```ts
const onCreateShape = useCallback(
  (shape: NodeShape, width: number, height: number) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    counter.current += 1
    const id = `${shape}-${Date.now()}-${counter.current}`
    const newNode: CanvasNode = {
      id,
      type: 'canvasNode',
      position,
      data: { label: '', color: NODE_COLORS[0].fill, shape },
      width,
      height,
    }
    onNodesChange([{ type: 'add', item: newNode }])
  },
  [screenToFlowPosition, onNodesChange],
)
```

`NodeShape` is added to the existing `@/types/canvas` import to type the
first parameter.

The callback is passed to `ShapePanel`:

```tsx
<ShapePanel onCreateShape={onCreateShape} />
```

---

## Why This Approach

### Why `onClick` instead of `onKeyDown`?

The finding suggested an explicit `onKeyDown` handler that checks for
`'Enter'` and `' '` (Space). That works, but it is the wrong pattern for
a `<button>` element.

HTML `<button type="button">` already fires a `click` event when the user
presses Enter or Space. This is the browser's built-in keyboard contract
for buttons — it also covers touch taps, assistive technology activation,
and any future input method that triggers the `click` event. Implementing
`onKeyDown` to re-do what `click` does for free creates duplicated code
and risks drift if the keys change.

The correct approach is always: add one `onClick` to a `<button>` and let
the browser deliver it from keyboard, mouse, or touch.

```
onKeyDown (checking 'Enter' / ' ')  →  duplicates browser behaviour, fragile
onClick                              →  works for keyboard, mouse, touch, all AT
```

### Why place keyboard-created nodes at the viewport centre?

When a user drags, the node appears exactly where they released it —
`e.clientX / e.clientY` gives the drop position. For keyboard activation
there is no cursor position. The conventional fallback in design tools
(Figma, Excalidraw) is the centre of the visible canvas area.

`screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })`
converts the screen-centre pixel into the canvas coordinate system,
accounting for current pan and zoom. The result is always visible in the
current view regardless of how far the user has scrolled or zoomed.

### Why `onCreateShape` is optional (`?:`)

The prop is typed as optional so that `ShapePanel` can be used in
contexts that do not need keyboard creation (e.g. a preview or
storybook) without providing the callback. The existing drag-only
behaviour is fully preserved if the prop is not passed.

---

## Beginner Mental Model: `title` vs `aria-label`

`title` and `aria-label` both attach a text label to an element, but they
serve different audiences:

| Attribute | Who sees it | How |
| --- | --- | --- |
| `title` | Mouse users | Browser tooltip on hover after a delay |
| `aria-label` | Screen reader users | Announced when the element receives focus |

An icon-only button needs `aria-label` so that someone using a screen
reader hears "Rectangle" or "Diamond" instead of just "button". Without
it, a screen reader user would navigate to the button and hear only
"button" with no indication of what it does.

`title` is not a substitute. Many screen readers do not announce `title`
at all unless there is no other accessible name. When you have an
icon-only control, always reach for `aria-label`.

---

## Beginner Mental Model: Drag-and-Drop Is Mouse-Only

The HTML5 drag-and-drop API fires events like `dragstart`, `dragover`,
and `drop`. These events only occur during a physical drag gesture. There
is no keyboard equivalent — pressing Enter does not fire `dragstart`, and
there is no way to trigger `drop` without a pointer device.

This means any feature that is exclusively implemented as drag-and-drop
is inaccessible to keyboard users. The fix is to provide an alternative
path — in this case, `onClick` — that does the same thing without
requiring drag.

Both paths share the same underlying logic: take a shape config and add a
node. They only differ in where the node is positioned. This is the
right pattern: one shared action, two ways to invoke it.

---

## Validation

- IDE diagnostics for both changed files: no linter errors.
- `shape-panel.tsx` — every button now has `aria-label`, `onDragStart`,
  and `onClick`; `ShapePanel` accepts an optional `onCreateShape` prop.
- `canvas-flow.tsx` — `onCreateShape` is a memoised `useCallback` that
  places a node at the viewport centre; it is passed to `<ShapePanel>`.

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/shape-panel.tsx` | Added `ShapePanelProps` interface with `onCreateShape`; replaced `title` with `aria-label`; added `onClick` to each shape button |
| `components/editor/canvas-flow.tsx` | Added `NodeShape` to type import; added `onCreateShape` callback; passed it to `<ShapePanel>` |
| `docs/fixes/fix-shape-panel-keyboard-accessibility.md` | Added this fix log |
