# Fix: Radius Token on Small Controls in `ai-copilot-sidebar`

## Summary

Three small inline control wrappers in `components/editor/ai-copilot-sidebar.tsx` used
`rounded-lg` instead of `rounded-xl`. Per the project's radius scale, `rounded-xl` is
the correct token for inline/small elements. `rounded-lg` is not part of the defined
scale and produces a visually inconsistent corner radius on icon buttons and icon chips.

| File | Element | Was | Now | Status |
|------|---------|-----|-----|--------|
| `components/editor/ai-copilot-sidebar.tsx` line 54 | Hook icon chip (`FutureHooksCard`) | `rounded-lg` | `rounded-xl` | Fixed |
| `components/editor/ai-copilot-sidebar.tsx` line 80 | Settings icon button | `rounded-lg` | `rounded-xl` | Fixed |
| `components/editor/ai-copilot-sidebar.tsx` line 105 | Send icon button | `rounded-lg` | `rounded-xl` | Fixed |
| `components/editor/ai-copilot-sidebar.tsx` line 93 | Input bar wrapper | `rounded-xl` | — | Skipped — already correct |

---

## Step 1 — Verification

Checked all four locations named in the report against the current file:

```tsx
// Line 54 — hook icon chip
<div className="flex-none h-7 w-7 rounded-lg ...">   ← rounded-lg ✗

// Line 80 — settings button
<button className="h-7 w-7 rounded-lg ...">          ← rounded-lg ✗

// Line 93 — input bar
<div className="... rounded-xl ...">                 ← rounded-xl ✓ already correct

// Line 105 — send button
<button className="... rounded-lg ...">              ← rounded-lg ✗
```

Three of four needed fixing. Line 93 was already on the correct token.

---

## The Project Radius Scale

From `CLAUDE.md`:

| Token | Use |
|-------|-----|
| `rounded-xl` | Inline / small elements (icon buttons, chips, badges, inputs) |
| `rounded-2xl` | Cards and panels |
| `rounded-3xl` | Modals and dialogs |

`rounded-lg` sits outside this defined set. Using it introduces a subtly smaller corner
radius that doesn't match any intentional tier of the scale — it just looks slightly off
compared to other inline controls across the app.

---

## The Fix

All three `rounded-lg` occurrences in the file were small inline controls. A single
`replace_all` swap was safe because no `rounded-lg` in this file was intentional or
belonged to a different tier.

### Before (all three locations)

```tsx
// Line 54
<div className="flex-none h-7 w-7 rounded-lg bg-surface ...">

// Line 80
<button className="h-7 w-7 rounded-lg flex items-center ...">

// Line 105
<button className="flex-none h-7 w-7 rounded-lg flex items-center ...">
```

### After

```tsx
// Line 54
<div className="flex-none h-7 w-7 rounded-xl bg-surface ...">

// Line 80
<button className="h-7 w-7 rounded-xl flex items-center ...">

// Line 105
<button className="flex-none h-7 w-7 rounded-xl flex items-center ...">
```

---

## What Did Not Change

- Line 93's `rounded-xl` on the input bar wrapper was already correct — untouched.
- `rounded-full` on the avatar/icon circle (line 10) is intentional — not part of the
  scale and not changed.
- All panel-level `rounded-2xl` classes are untouched.
- No layout, colour, or spacing classes were modified.

---

## Beginner Mental Model: Design Tokens and Radius Scales

### Why a radius scale exists

A design system defines a small set of corner-radius values and assigns each one a
semantic tier. Instead of every developer picking an arbitrary `rounded-*` class,
everyone picks from the same small menu:

```
small controls → rounded-xl
cards/panels   → rounded-2xl
modals         → rounded-3xl
```

When every element in each tier uses the same value, the UI has visual rhythm — things
"feel" like they belong together. When a single element slips one tier down
(`rounded-lg` instead of `rounded-xl`), it usually isn't dramatic enough for anyone
to name, but it creates a low-grade sense that something is slightly off.

### Why `rounded-lg` isn't just "a bit smaller"

Tailwind's radius scale is:

| Class | Value |
|-------|-------|
| `rounded-lg` | 0.5rem (8px) |
| `rounded-xl` | 0.75rem (12px) |
| `rounded-2xl` | 1rem (16px) |
| `rounded-3xl` | 1.5rem (24px) |

The gap between `rounded-lg` and `rounded-xl` is 4px. On a 28px icon button that's a
visible difference — the button looks notably squarer than its neighbours. Multiply
that across dozens of controls and the UI develops an inconsistent texture.

### The enforcement pattern

Projects that care about radius consistency often:
1. Document the scale in `CLAUDE.md` / a design doc (this project does this).
2. Grep for disallowed classes in CI or code review.
3. Create Tailwind safelist aliases so only the permitted tokens compile.

For now, the scale is convention-enforced: whenever you add a new element, check the
tier (inline, card, modal) and pick the matching token from the three above.

---

## Files Changed

| File | Change |
|------|--------|
| `components/editor/ai-copilot-sidebar.tsx` | Three `rounded-lg` → `rounded-xl` on small inline control wrappers (lines 54, 80, 105) |
