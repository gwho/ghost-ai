# Feature 15 — Node Color Toolbar: Implementation Plan

## Spec Summary

Add a small floating toolbar that appears above a selected node. The toolbar shows 8 colour swatches — one per predefined background/text pair. Clicking a swatch updates both the node's background and text colour immediately, synced to all collaborators in real time. No server calls. No custom colour picker.

---

## Files Modified

| File | What changed |
|---|---|
| `components/editor/canvas-node.tsx` | Added `NodeToolbar` import, `hexToRgba` helper, `colorToolbar` JSX, and rendered it in all 4 shape branches |
| `context/progress-tracker.md` | Marked Feature 15 complete, updated current phase and next-up |

No new files. No type changes. No other files touched.

---

## Pre-existing Infrastructure

Before writing a line of code, everything needed was already in place:

- **`NODE_COLORS`** in `types/canvas.ts` — 8 `{ fill, text }` pairs, `as const`.
- **`NodeData.color`** field — already stored the fill hex on every node.
- **`pair` lookup** — `canvas-node.tsx` already called `NODE_COLORS.find(c => c.fill === color)` and applied both `pair.fill` and `pair.text` to the node's style.
- **`selected` prop** — React Flow already passed this boolean to every `CanvasNodeComponent`.
- **`updateNodeData`** from `useReactFlow()` — already imported and used for label edits; Liveblocks intercepts it for collaborative sync.

The entire feature was a UI layer on top of infrastructure that was fully operational.

---

## Implementation Plan

### Step 1 — Import `NodeToolbar`

```tsx
// Before
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'

// After
import { Handle, Position, NodeResizer, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react'
```

`NodeToolbar` is React Flow's built-in floating-UI component. It attaches to the node's coordinate system, handles z-index, positions itself relative to the node, and does not interfere with dragging — all without any custom positioning logic.

### Step 2 — Add `hexToRgba` helper

```ts
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
```

The hover glow on each swatch uses the palette's text colour at reduced opacity. The text colour is a hex string from `NODE_COLORS`; CSS `box-shadow` needs an `rgba()` value. This helper converts one to the other at runtime. It lives at module scope since it has no React dependencies.

### Step 3 — Compute `activeColor` and build `colorToolbar`

```tsx
const activeColor = color ?? NODE_COLORS[0].fill

const colorToolbar = (
  <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
    <div
      className="flex gap-1.5 px-2 py-1.5 bg-surface border border-surface-border rounded-full shadow-lg nodrag nopan"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {NODE_COLORS.map((c, i) => {
        const isActive = c.fill === activeColor
        return (
          <button
            key={c.fill}
            type="button"
            aria-label={`Color option ${i + 1}`}
            className="nodrag nopan w-5 h-5 rounded-full cursor-pointer transition-all"
            style={{
              backgroundColor: c.fill,
              outline: isActive ? `2px solid ${c.text}` : '2px solid transparent',
              outlineOffset: '2px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(c.text, 0.35)}`
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = ''
            }}
            onClick={(e) => {
              e.stopPropagation()
              updateNodeData(id, { color: c.fill })
            }}
          />
        )
      })}
    </div>
  </NodeToolbar>
)
```

Key decisions in this block:

- `isVisible={!!selected}` — toolbar only renders when the node is selected. `!!` converts `selected` (which React Flow types as `boolean | undefined`) to a plain `boolean`.
- `position={Position.Top}` + `offset={8}` — positions the toolbar 8 pixels above the node's top edge.
- `nodrag nopan` on the container and each button — React Flow's class-based check skips drag/pan for elements with these classes.
- `onMouseDown stopPropagation` on the container — belt-and-suspenders defence so mousedown on the toolbar never reaches the node drag handler.
- Active swatch uses `outline` (not `border`) so the ring sits outside the swatch circle without affecting its size.
- Hover glow uses `onMouseEnter`/`onMouseLeave` with direct style manipulation — not a CSS class — because the glow colour is a per-swatch runtime value that can't be expressed as a static utility class.
- `updateNodeData(id, { color: c.fill })` — the only mutation needed. Liveblocks intercepts this and broadcasts the change to all collaborators in real time.

### Step 4 — Wire into all four shape branches

`colorToolbar` is placed as the first child inside every shape's returned element:

```tsx
// CSS shapes (rectangle, pill, circle)
return (
  <div ...>
    {colorToolbar}   {/* ← added */}
    {resizer}
    {HANDLES}
    ...
  </div>
)

// Diamond, hexagon, cylinder — same pattern
return (
  <div ...>
    {colorToolbar}   {/* ← added */}
    {resizer}
    <svg ...>...</svg>
    ...
  </div>
)
```

`NodeToolbar` renders outside the node's DOM container (React Flow portals it into the canvas overlay), so placing it inside any shape branch has the same visual result — it always floats above the node.

---

## Testing Phase

### Build verification

```bash
npm run build
```

Expected output: `✓ Compiled successfully` and `Finished TypeScript in ...` with no type errors. Confirmed passing.

### No issues were caught during this feature

The implementation was straightforward: all infrastructure existed, the API (`NodeToolbar`, `updateNodeData`) behaved as documented, and the build passed first try. No bugs were introduced or found during this feature.

---

## Conventions Checklist

- Toolbar container uses `bg-surface`, `border-surface-border` — project CSS tokens, no hardcoded hex.
- Dynamic swatch colours (fill, glow) use inline styles because they are runtime values from `NODE_COLORS` that cannot be expressed as static Tailwind utilities.
- All interactive elements inside the node have `nodrag nopan` + `stopPropagation` to prevent canvas interference — consistent with the pattern established for the label textarea in Feature 14.
- Accessibility: `type="button"` and `aria-label` added to every swatch button.
