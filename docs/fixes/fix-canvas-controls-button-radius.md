# Fix: Canvas Controls Button Radius Token

## What Was Wrong

`components/editor/canvas-controls.tsx` defines a shared `ControlButton` component
used by all five canvas control buttons (zoom out, fit view, zoom in, undo, redo).

The button's `className` used `rounded-lg`:

```tsx
className="rounded-lg p-1.5 text-copy-primary hover:bg-surface-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
```

The project's radius scale maps UI element types to specific tokens:

| UI element type | Token |
| --- | --- |
| Small controls, icon buttons | `rounded-xl` |
| Cards and panels | `rounded-2xl` |
| Large overlays and dialogs | `rounded-3xl` |

`rounded-lg` is not part of this scale. Using it creates an inconsistency: these
buttons are small interactive icon controls, so they should use `rounded-xl` like
every other icon button in the project.

| File | Finding | Status |
| --- | --- | --- |
| `components/editor/canvas-controls.tsx` | `ControlButton` used `rounded-lg` | Fixed |

---

## The Fix

One word changed on line 29:

```tsx
// Before
className="rounded-lg p-1.5 ..."

// After
className="rounded-xl p-1.5 ..."
```

All five canvas controls (zoom out, fit view, zoom in, undo, redo) share the
same `ControlButton` component, so this single change applies the correct radius
to all of them.

---

## Why This Matters

Radius tokens are part of the project's design vocabulary. When a small button
uses `rounded-lg` instead of `rounded-xl`, the corners are slightly less rounded
than expected. Over many components this inconsistency accumulates and the UI
starts to feel subtly unpolished even though each individual change looks minor.

Keeping all icon buttons on `rounded-xl` ensures they look visually identical
to controls in other parts of the editor (the toolbar in `shape-panel.tsx`, the
close button in `project-sidebar.tsx`, and so on).

---

## Validation

- IDE diagnostics: no linter errors.
- Project ESLint passed for `components/editor/canvas-controls.tsx`.

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/canvas-controls.tsx` | `rounded-lg` → `rounded-xl` on `ControlButton` |
| `docs/fixes/fix-canvas-controls-button-radius.md` | Added this fix log |
