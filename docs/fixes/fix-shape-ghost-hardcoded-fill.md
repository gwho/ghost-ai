# Fix: Replace Hardcoded Hex Fill in ShapeGhost with Design Token

## What Was Wrong

In `components/editor/shape-panel.tsx`, the `ShapeGhost` component (used for the
drag-preview that follows your cursor when dragging a shape from the toolbar)
hardcoded the shape fill color as a raw hex value:

```tsx
// BEFORE
function ShapeGhost({ shape }: { shape: NodeShape }) {
  const fill = '#1F1F1F'   // ← hardcoded hex literal
  const stroke = 'var(--border-subtle)'
  ...
}
```

Every shape branch — `<div style={{ backgroundColor: fill }} />`,
`<polygon fill={fill} />`, `<rect fill={fill} />`, `<ellipse fill={fill} />` —
consumed this one `fill` variable, so all five shape types used the same
hardcoded color.

## Why This Is a Problem

This project defines a central design token system in `app/globals.css`. All
colors are named and declared there as CSS custom properties (e.g. `--bg-subtle`,
`--border-default`, `--text-primary`). Tailwind utilities like `bg-surface`,
`text-copy-muted`, and `border-surface-border` are generated from these tokens.

When a hex literal like `#1F1F1F` is written directly in a component:

1. **Invisible to the theme system** — If the design team adjusts `--bg-subtle`
   globally, this component stays at the old value and visually drifts away from
   the rest of the UI.

2. **Hard to audit** — A grep for `--bg-subtle` across the codebase will miss the
   component entirely, making it impossible to find every place the color is used.

3. **Violates project conventions** — `CLAUDE.md` explicitly states: *"Use CSS
   custom property tokens defined in globals.css — never raw Tailwind color
   classes like zinc-* or hardcoded hex values."*

## How the Token System Works (Beginner Explanation)

```
globals.css defines the single source of truth:
  --bg-subtle: #1e1e23;          ← one place to change the color

@theme inline wires it to Tailwind:
  --color-subtle: var(--bg-subtle);   ← Tailwind utility: bg-subtle

Components reference the token by name:
  style={{ backgroundColor: 'var(--bg-subtle)' }}   ← always in sync
  OR
  className="bg-subtle"                              ← Tailwind class
```

Changing `--bg-subtle` in `globals.css` automatically propagates everywhere the
token is referenced — no component hunting required.

## Which Token Was Chosen and Why

The project's background scale lives in four steps:

| Token          | Hex value  | Meaning                          |
|----------------|------------|----------------------------------|
| `--bg-base`    | `#080809`  | Deepest background (page canvas) |
| `--bg-surface` | `#111114`  | Card / panel surface             |
| `--bg-elevated`| `#18181c`  | Floating elements, popovers      |
| `--bg-subtle`  | `#1e1e23`  | Slightly raised surface          |

The old hex `#1F1F1F` is `rgb(31, 31, 31)`. The closest token is
`--bg-subtle` at `#1e1e23` = `rgb(30, 30, 35)` — visually indistinguishable.

Semantically, `--bg-subtle` is the right choice for a drag ghost: it's a
temporary, "hint-level" shape floating above the canvas, which matches the
semantic meaning of "subtle" in the hierarchy.

> **Note on `--surface-1`**: The original finding referenced `var(--surface-1)`
> but that token does not exist in this project's `globals.css`. Always verify
> token names against the actual file before using them.

## The Fix

One line changed in `ShapeGhost`:

```tsx
// AFTER
function ShapeGhost({ shape }: { shape: NodeShape }) {
  const fill = 'var(--bg-subtle)'   // ← design token, always in sync
  const stroke = 'var(--border-subtle)'
  ...
}
```

Because all five shape branches (`rectangle`, `pill/circle`, `diamond`,
`hexagon`, `cylinder`) already read from the `fill` variable, this single
change fixes every occurrence. No other edits were needed.

## Diff Summary

```diff
- const fill = '#1F1F1F'
+ const fill = 'var(--bg-subtle)'
```

---

## Suggested Topics to Explore Further with an LLM

1. **CSS custom properties (CSS variables) deep dive** — How do `var()`,
   `:root`, `@property`, and cascading inheritance work? What happens when a
   CSS variable is not defined — what is the fallback syntax?

2. **Design token systems** — What are design tokens and why do large design
   systems (like Material Design, Atlassian's Atlaskit, or Shopify's Polaris)
   use them? How do tools like Style Dictionary or Tokens Studio generate
   tokens for multiple platforms from a single source?

3. **Tailwind v4 `@theme inline` vs `@theme`** — This project uses
   `@theme inline` to map CSS custom properties to Tailwind utilities. How does
   this differ from the `theme()` config function in Tailwind v3? Why is the
   inline approach preferred in v4?

4. **SVG `fill` attribute vs CSS `fill` property** — Both `<polygon fill="..." />`
   and `style={{ fill: '...' }}` work in SVG. Which takes precedence? When should
   you use an attribute vs a CSS property for SVG styling?

5. **`currentColor` keyword in SVG** — There's a special SVG fill value called
   `currentColor` that inherits the nearest CSS `color` property. When is this
   more useful than a design token? What are its limits?

6. **Hex color notation cheat sheet** — `#1F1F1F` is shorthand for
   `rgb(31, 31, 31)`. How do you convert between hex, RGB, HSL, and OKLCH
   (the color space Tailwind v4 prefers internally)?

7. **Why "one source of truth" matters in UI codebases** — Ask an LLM to walk
   through a real-world scenario where a hex value was duplicated across dozens of
   files, a rebrand happened, and the team had to hunt every occurrence manually.
   How do design tokens prevent this class of bug?
