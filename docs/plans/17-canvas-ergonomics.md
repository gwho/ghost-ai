# Plan: Feature 17 — Canvas Ergonomics

## What We're Building

Add ergonomic controls to the canvas:
- A floating pill-shaped control bar at the bottom-left with zoom and history buttons
- Keyboard shortcuts for zoom and undo/redo
- Liveblocks-backed undo/redo that reverses any collaborative canvas mutation

---

## Files Changed

| File | What changed |
|---|---|
| `hooks/useKeyboardShortcuts.ts` | New — keyboard shortcut hook |
| `components/editor/canvas-controls.tsx` | New — floating control bar component |
| `components/editor/canvas-flow.tsx` | Wires Liveblocks history, keyboard hook, and control bar |
| `context/progress-tracker.md` | Marked Feature 17 complete |

---

## Step-by-Step

### 1. Create `hooks/useKeyboardShortcuts.ts`

The hook receives the `ReactFlowInstance` plus `undo` and `redo` handlers.
It attaches a single `keydown` listener to `window` on mount and removes it on unmount.

**Editable-field guard** — skip all shortcuts while the user is typing:

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

Checking `isContentEditable` catches the inline node and edge label editors (which use
`contentEditable` divs and `<textarea>` elements respectively).

**Shortcut dispatch:**

```ts
const meta = e.metaKey || e.ctrlKey

if (!meta && (e.key === '+' || e.key === '=')) flow?.zoomIn({ duration: 200 })
if (!meta && e.key === '-')                    flow?.zoomOut({ duration: 200 })
if (meta && !e.shiftKey && e.key === 'z')      { e.preventDefault(); undo() }
if (meta && e.shiftKey  && e.key === 'z')      { e.preventDefault(); redo() }
if (meta && e.key === 'y')                     { e.preventDefault(); redo() }
```

`e.preventDefault()` on undo/redo prevents the browser's built-in undo (e.g. in address
bars) from firing at the same time. It is not needed for zoom keys because `+`/`-` have
no default browser action in this context.

Both `=` and `+` are mapped to zoom in because on US keyboards the `+` character requires
Shift, meaning the unshifted key that produces `+` is `=`. Supporting both keys ensures
the shortcut works with or without Shift.

**Dependency array:** `[flow, undo, redo]` — the effect re-registers the listener whenever
any of these references change, so the handler always closes over the latest values.

---

### 2. Create `components/editor/canvas-controls.tsx`

**Props:**
```ts
interface CanvasControlsProps {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}
```

**Zoom calls:** The component calls `useReactFlow()` directly. This is valid because
`CanvasControls` is rendered inside `CanvasFlowInner`, which is a descendant of
`<ReactFlowProvider>`.

**Layout:** `absolute bottom-6 left-6` — bottom-left corner, clear of the shape panel
which anchors at `bottom-6 left-1/2` (bottom-center).

**Button order (left → right):**

```
[ − ]  [ ⊞ ]  [ + ]  |  [ ↩ ]  [ ↪ ]
zoom out  fit  zoom in    undo   redo
```

**Disabled state:** `disabled:opacity-40 disabled:cursor-not-allowed` on undo/redo.
The undo and redo buttons receive the `disabled` prop directly from `canUndo`/`canRedo`,
so they dim automatically when the history stack is empty.

**Local `ControlButton` helper:** defined in the same file, not exported. Keeps the
JSX clean while reusing the same button styling across all five controls.

---

### 3. Update `canvas-flow.tsx`

Three additions inside `CanvasFlowInner`:

**Liveblocks history hooks** (imported from `@liveblocks/react`):
```ts
const { undo, redo } = useHistory()
const canUndo = useCanUndo()
const canRedo = useCanRedo()
```

`useHistory` returns the undo/redo functions. `useCanUndo` and `useCanRedo` return live
booleans — they re-render the component whenever the history stack changes, keeping the
button disabled states up to date.

**ReactFlow instance — refactored from destructure to variable:**
```ts
// before
const { screenToFlowPosition } = useReactFlow()

// after
const reactFlow = useReactFlow()
const { screenToFlowPosition } = reactFlow
```

This lets us pass `reactFlow` to `useKeyboardShortcuts` without calling `useReactFlow`
a second time.

**Keyboard hook:**
```ts
useKeyboardShortcuts(reactFlow, undo, redo)
```

**Control bar in JSX** (above `<ShapePanel>`):
```tsx
<CanvasControls undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
```

---

## Verification Checklist

- [ ] Control bar appears at bottom-left — 5 buttons with a divider between zoom and history groups
- [ ] Zoom out (`−`) smoothly shrinks the viewport
- [ ] Fit view (`⊞`) animates the canvas to fit all nodes
- [ ] Zoom in (`+`) smoothly enlarges the viewport
- [ ] Undo and redo buttons are dimmed on a fresh canvas
- [ ] Dropping a node enables Undo; pressing Undo removes it; pressing Redo re-adds it
- [ ] `+`/`=` zooms in from the keyboard; `-` zooms out
- [ ] `Cmd/Ctrl + Z` undoes; `Cmd/Ctrl + Shift + Z` and `Cmd/Ctrl + Y` redo
- [ ] Keyboard shortcuts are suppressed while typing inside a node or edge label
- [ ] `npm run build` passes (Google Fonts fetch failure is a known env constraint, not a code error)
