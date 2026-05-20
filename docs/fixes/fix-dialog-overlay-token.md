# Fix: Replace `bg-black/60` with a Design Token in `dialog.tsx`

## What Was Wrong

`components/ui/dialog.tsx` line 20 had a hardcoded Tailwind color class:

```tsx
"fixed inset-0 z-50 bg-black/60 ..."
```

`bg-black/60` is a raw Tailwind utility that means "pure black (`#000000`) at 60% opacity." This works visually but breaks the project's design system rule: **all colors must come from CSS custom property tokens defined in `globals.css`** — never from raw Tailwind color names or hex values.

The problem with hardcoded values is consistency. If the design team ever decides the overlay should be slightly lighter, slightly more blue-tinted, or at 50% opacity instead of 60%, every file that uses `bg-black/60` would need to be hunted down and changed individually. With a token, you change one line in `globals.css` and every component updates automatically.

---

## Verification Step (Always Do This First)

Before touching anything, confirm the issue actually exists in the current code. Reported issues can be stale — the code may have already been fixed, or the report may describe a file that no longer exists.

```bash
grep -n "bg-black" components/ui/dialog.tsx
```

Output confirmed the issue was real:

```text
20:        "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in ...
```

Also checked `globals.css` to see if an overlay token already existed — it didn't. A new one needed to be created.

---

## The Fix: Three-Part Change

### Part 1 — Add the token to `:root` in `globals.css`

The `:root` block is where all raw color values live. This is the single source of truth for every color in the project.

```css
/* Before */
/* States */
--state-error: #ff4d4f;

/* After */
/* Overlay */
--overlay: rgba(0, 0, 0, 0.6);

/* States */
--state-error: #ff4d4f;
```

`rgba(0, 0, 0, 0.6)` is exactly what `bg-black/60` produced — pure black at 60% opacity. The behavior is identical, but now the value has a name and lives in one place.

### Part 2 — Expose it as a Tailwind utility in `@theme inline`

The `@theme inline` block in `globals.css` maps CSS custom properties to Tailwind utility classes. Without this step, you could only reference the token with `bg-[var(--overlay)]` (verbose and fragile). With this step, you get a clean `bg-overlay` class.

```css
/* Added inside @theme inline { } */
--color-overlay: var(--overlay);
```

**How this works:** Tailwind v4 reads everything in `@theme inline` and generates utility classes from it. The naming convention is: a variable named `--color-X` becomes the Tailwind class `bg-X` (for backgrounds), `text-X` (for text color), `border-X` (for borders), etc.

So `--color-overlay: var(--overlay)` → `bg-overlay` is now a valid Tailwind class.

### Part 3 — Use the token in `dialog.tsx`

```tsx
// Before
"fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in ..."

// After
"fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in ..."
```

Only the one class changed. Everything else — the positioning, z-index, and animation utilities — stayed exactly the same.

---

## Why the `@apply` Warnings in `globals.css` Were Ignored

During the fix, the IDE reported warnings like:

```text
Unknown at rule @apply [unknownAtRules] (css)
```

These are **false positives** from VS Code's built-in CSS language server, which does not understand Tailwind-specific directives like `@apply`, `@theme`, or `@custom-variant`. The warnings existed before this fix and are unrelated to it.

The real validators — `npm run lint` (ESLint) and `npm run build` (TypeScript + Next.js compiler) — both passed with zero errors. IDE extension warnings that don't surface in the actual build pipeline can safely be ignored. When in doubt, run the real tools, not just the IDE squiggles.

---

## What Was Skipped and Why

The original report also mentioned a Stylelint issue (`scss/at-rule-no-unknown` flagging `@custom-variant` and `@theme` in `globals.css`). That was investigated first and skipped because:

- No `.stylelintrc.json` file exists in the project
- Stylelint is not installed as a dependency
- There is no Stylelint step in the build or CI pipeline

The flag came from a VS Code Stylelint extension using its own bundled ruleset, not from a project-configured tool. Modifying a config file that doesn't exist would create unnecessary noise. If Stylelint is added to the project later, the `ignoreAtRules` entry for `custom-variant` and `theme` would be the correct fix at that time.

---

## Design Token Pattern Cheat Sheet

Here is the full flow for adding any new design token to this project:

```text
Step 1: Add the raw value to :root in globals.css
        --my-token: #value or rgba(...);

Step 2: Expose it via @theme inline in globals.css
        --color-my-token: var(--my-token);   → enables bg-my-token, text-my-token, etc.

Step 3: Use the Tailwind utility class in components
        className="bg-my-token"
```

Never skip Step 2 — without it, you'd have to write `bg-[var(--my-token)]` everywhere, which is harder to read and harder to refactor.

Never skip Step 1 — without it, the value is locked inside `@theme` with no named variable, which makes it impossible to reference from plain CSS or override in specific contexts.

---

## Files Changed

| File | What changed |
|---|---|
| `app/globals.css` | Added `--overlay` to `:root`; added `--color-overlay` to `@theme inline` |
| `components/ui/dialog.tsx` | Replaced `bg-black/60` with `bg-overlay` on line 20 |
