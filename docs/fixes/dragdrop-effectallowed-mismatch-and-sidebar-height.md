# Fix: Drag-Drop effectAllowed Mismatch + AI Sidebar Height

**Date:** 2026-05-29  
**Files changed:** `canvas-flow.tsx`, `workspace-shell.tsx`, `ai-copilot-sidebar.tsx`  
**Reported as:** Shapes from the shape panel still couldn't be dropped onto the canvas; AI sidebar appeared shorter than full height.

---

## Bug 1 — Drag-and-drop never fires the `drop` event

### What was broken

Dragging a shape from the shape panel onto the canvas showed a "not allowed" cursor (🚫) and nothing happened when you released the mouse.

### Why it happened — the `effectAllowed` / `dropEffect` mismatch

The HTML5 drag-and-drop API has two properties that must be **compatible** for a drop to be allowed:

| Property | Set by | Set in | What it means |
|---|---|---|---|
| `effectAllowed` | drag **source** | `dragstart` event | "What operations does the thing being dragged support?" |
| `dropEffect` | drop **target** | `dragover` event | "What operation does this drop zone want to perform?" |

In **`shape-panel.tsx`** (`onDragStart`):
```js
e.dataTransfer.effectAllowed = 'copy'  // ← source says "copy only"
```

In **`canvas-flow.tsx`** (`onDragOver`):
```js
e.dataTransfer.dropEffect = 'move'     // ← target says "I want to move"
```

These two are **incompatible**. `'copy'` says the only allowed operation is to copy the data. `'move'` says the target wants to physically move the data. Since 'move' is not within what `effectAllowed = 'copy'` permits, the browser silently sets `dropEffect` to `'none'` (meaning "no drop allowed"). When `dropEffect` is `'none'`:

- The drag cursor shows the "not allowed" symbol (🚫)
- The `drop` event **never fires** on the target element
- The `onDrop` callback is never called

So every `onDrop` attempt was dead on arrival — not because the handler was on the wrong element or the data was wrong, but because the browser was blocking the entire drop operation before it started.

### The fix

Change `dropEffect` from `'move'` to `'copy'` in the `onDragOver` callback in `canvas-flow.tsx`:

```js
// BEFORE (broken)
const onDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'  // ← incompatible with 'copy' effectAllowed
}, [])

// AFTER (fixed)
const onDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'  // ← matches effectAllowed='copy' from drag source
}, [])
```

Now `effectAllowed = 'copy'` and `dropEffect = 'copy'` are compatible, the browser allows the drop, and the `drop` event fires.

### Compatibility table (browser rules)

```
effectAllowed   │  Valid dropEffect values
────────────────┼─────────────────────────────
copy            │  'copy', 'none'
move            │  'move', 'none'
link            │  'link', 'none'
copyMove        │  'copy', 'move', 'none'
copyLink        │  'copy', 'link', 'none'
linkMove        │  'link', 'move', 'none'
all             │  'copy', 'move', 'link', 'none'
```

**Reusable lesson:** When implementing HTML5 drag-and-drop, always make sure the `dropEffect` you set in `dragover` is one of the values permitted by the `effectAllowed` the drag source set in `dragstart`. The most common mistake is setting them independently without checking compatibility. When in doubt, use `effectAllowed = 'all'` on the source and set whatever `dropEffect` makes sense on the target.

---

## Bug 2 — Belt-and-suspenders: handlers on both the wrapper div and `<ReactFlow>`

### What was happening

Even after fixing `dropEffect`, there's a subtle reliability issue with where `onDragOver` and `onDrop` are attached.

The shape panel (ShapePanel component) is rendered **outside** the `<ReactFlow>` component in the DOM:

```
div.w-full.h-full.relative  (wrapper div)
  ├── <ReactFlow>            ← handles its own drag events internally
  └── <ShapePanel>          ← rendered OUTSIDE ReactFlow, at z-index above it
```

When dragging from a ShapePanel button:
- While the cursor is over the **ShapePanel area**, drag events fire on ShapePanel elements
- While the cursor is over the **canvas area**, drag events fire on ReactFlow's internal elements

For the `onDragOver` to signal "drop is allowed here", it needs to fire (and call `preventDefault()`) wherever the cursor is. If only ReactFlow has `onDragOver`, it won't fire while the cursor is over the ShapePanel.

### The fix: handlers on both elements

We now put `onDragOver` and `onDrop` on **both** the wrapper div (catches all events via bubbling) and `<ReactFlow>` (catches events directly on the canvas):

```jsx
<div
  className="w-full h-full relative"
  onDragOver={onDragOver}   ← catches events anywhere in the wrapper (incl. ShapePanel)
  onDrop={onDrop}
>
  <ReactFlow
    onDragOver={onDragOver} ← catches events directly on ReactFlow elements
    onDrop={onDrop}
    ...
  >
```

To prevent the `onDrop` from firing **twice** (once on ReactFlow's root, then again as the event bubbles to the wrapper div), we added `e.stopPropagation()` inside `onDrop`:

```js
const onDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()  // ← prevents double-firing when both elements have onDrop
  ...
}, [...])
```

**How `stopPropagation` works here:**

React's synthetic events bubble up the component tree, just like native DOM events bubble up the DOM tree. When you drop on a ReactFlow element:
1. `drop` fires on the target element inside ReactFlow
2. It bubbles up to ReactFlow's root div → `onDrop` fires → `e.stopPropagation()` is called
3. The event stops bubbling → the wrapper div's `onDrop` is **not** called

When you drop somewhere else (like a ShapePanel button during an unusual drag):
1. `drop` fires on the ShapePanel button
2. Bubbles to wrapper div → `onDrop` fires → `e.stopPropagation()` is called
3. Handler checks for `ghost-shape` data; if missing, it returns early

**Reusable lesson:** When you need drag-drop to work reliably across a complex component that also renders overlay elements, put `onDragOver` on the OUTER wrapper so `preventDefault()` is always called no matter where the cursor is. Use `stopPropagation()` in `onDrop` to prevent the same handler from running twice (once on the child, once on the parent) when both have the handler attached.

---

## Bug 3 — AI sidebar appeared shorter than full height

### What was broken

After the layout restructuring (workspace-shell changed from flex-column to absolute overlay), the AI Copilot sidebar appeared shorter than it should be. Before the restructure, it filled the full height of the content area. After the restructure, it only showed as tall as its content (a few cards).

### Why it happened

Two separate issues combined:

**Issue A — Sidebar started at `top: 0`, not below the toolbar**

The workspace toolbar is `absolute top-0 h-12 z-20`. The AI sidebar wrapper was `absolute right-0 inset-y-0 z-10` — `inset-y-0` means `top: 0; bottom: 0`. So the sidebar started at the SAME vertical position as the toolbar (top of the workspace area).

The toolbar (z-20) sat visually ABOVE the sidebar (z-10), hiding the top 48px of the sidebar. The sidebar was actually full height, but its top 48px were hidden. Visually it looked shorter.

**Issue B — The `<aside>` element had no height**

The wrapper div `absolute right-0 inset-y-0` has a defined height because `position: absolute` with `top: 0; bottom: 0` stretches it to fill its positioned parent. But the `<aside>` element INSIDE the wrapper has no explicit height — it defaults to `height: auto` (as tall as its content).

Without `h-full`, the aside expands only to fit its content (two small cards and a footer). It doesn't fill the absolute container.

### The fix

Two changes:

**1. In `workspace-shell.tsx` — start sidebar below the toolbar:**
```jsx
// BEFORE: inset-y-0 starts at top:0 (behind toolbar)
<div className="absolute right-0 inset-y-0 z-10 w-80">

// AFTER: top-12 starts at 48px (below toolbar), bottom-0 extends to bottom
<div className="absolute right-0 top-12 bottom-0 z-10 w-80">
```

The toolbar is `h-12` (48px). Starting the sidebar at `top-12` means it begins exactly where the toolbar ends.

**2. In `ai-copilot-sidebar.tsx` — make the `<aside>` fill its container:**
```jsx
// BEFORE: height auto, only as tall as content
<aside className="w-80 flex-none border-l border-surface-border bg-surface flex flex-col">

// AFTER: h-full fills the absolute wrapper
<aside className="w-80 h-full flex-none border-l border-surface-border bg-surface flex flex-col">
```

With `h-full`, the aside fills the `top-12 bottom-0` container, which means it fills from below the toolbar to the bottom of the screen.

**Reusable lesson:** When you move from a flex layout (where children are automatically stretched to fill the cross-axis) to an absolute layout (where children are measured by their own content by default), you must explicitly add `h-full` to elements that should fill their container. Also, always think about the offset needed when floating panels near other floating panels — if toolbar is `h-12`, sidebar should start at `top-12`, not `top-0`.

---

## Summary

| Bug | Root cause | Fix |
|---|---|---|
| Drop event never fires | `effectAllowed='copy'` + `dropEffect='move'` mismatch | Change `dropEffect` to `'copy'` |
| Inconsistent event handling | `onDragOver`/`onDrop` on only one of two relevant layers | Add handlers to both wrapper div and `<ReactFlow>`, use `stopPropagation` |
| AI sidebar too short | `<aside>` has no `h-full`; sidebar starts at `top-0` behind toolbar | Add `h-full` to aside; change wrapper from `inset-y-0` to `top-12 bottom-0` |
