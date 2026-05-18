# Fix: Close Button Radius Token + Spec Prop Documentation

## Findings Batch Summary

Eight issues were reported across six files. Two were valid and fixed. Six were skipped after verifying against current code. Full breakdown below.

---

## Valid Fix 1: `rounded-lg` → `rounded-xl` on Close Button (`project-sidebar.tsx`)

### What Was Wrong

The close button inside `ProjectSidebar` used `rounded-lg` for its border radius:

```tsx
className="flex items-center justify-center h-6 w-6 rounded-lg text-copy-muted ..."
```

The project's design system defines a strict radius scale:

| Context | Class |
| --- | --- |
| Inline / small UI elements | `rounded-xl` |
| Cards / panels | `rounded-2xl` |
| Modals / overlays | `rounded-3xl` |

`rounded-lg` is not part of this scale. Using it creates an inconsistency — the navbar's toggle button correctly uses `rounded-xl`, but the sidebar's close button used a different value. Two buttons serving the same role (icon-only toggle actions) should feel visually identical.

### How It Was Caught

The report flagged line 24 of `project-sidebar.tsx`. Verified with `sed -n '22,26p'` — `rounded-lg` was present.

### The Fix

```tsx
// Before
className="flex items-center justify-center h-6 w-6 rounded-lg text-copy-muted hover:text-copy-primary transition-colors"

// After
className="flex items-center justify-center h-6 w-6 rounded-xl text-copy-muted hover:text-copy-primary transition-colors"
```

One word changed. Everything else untouched.

### The Rule to Remember

When in doubt about which radius to use: **small interactive elements (icon buttons, badges, tags) always get `rounded-xl`**. Save `rounded-2xl` for container-level surfaces like cards and panels, and `rounded-3xl` for full modal overlays. Do not use any other Tailwind radius classes (`rounded-lg`, `rounded-md`, etc.) in this project — they bypass the design token system.

---

## Valid Fix 2: Prop API Documentation in `context/feature-specs/02-editor.md`

### What Was Wrong

The spec listed the sidebar's props like this:

```text
- accepts `isOpen` and `onClose`prop
```

Two problems:

1. **Formatting error** — the backtick closed after `onClose` but the word "prop" was joined directly without a space: `` `onClose`prop `` instead of `` `onClose` prop ``
2. **Missing contract detail** — the spec stated *what* props exist but not *what they do* or *who controls them*. A good spec defines the full API contract: types, ownership of state, and which internal element triggers the callback

### The Fix

```text
// Before
- accepts `isOpen` and `onClose`prop

// After
- accepts `isOpen: boolean` and `onClose: () => void` props — `onClose` is invoked
  by the header close button; callers control open state via `isOpen`
```

This makes the contract explicit:
- `isOpen` is a `boolean` — the parent owns and passes it down
- `onClose` is a callback with no return value — the sidebar calls it when the user clicks the X; it does not manage the state itself

### Why This Pattern Matters

This is called a **controlled component** pattern. The sidebar doesn't decide whether it's open — it just reports "the user wants to close" and lets the parent act on it. This is the same pattern used by shadcn's own components (like `<Dialog open={open} onOpenChange={setOpen}>`).

Keeping state in the parent (here, `app/editor/layout.tsx`) means:
- One source of truth for sidebar visibility
- Any part of the app can open or close the sidebar by updating that one state
- The sidebar component stays simple and reusable

---

## Skipped Findings and Why

### `globals.css` — Font Keyword Case (`value-keyword-case`)

**Reported:** Generic family names (`sans-serif`, `monospace`) should be lowercase.

**Verified:** Already lowercase.

```css
--font-sans: Arial, Helvetica, sans-serif;     /* ✓ lowercase */
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;  /* ✓ lowercase */
--font-heading: Arial, Helvetica, sans-serif;  /* ✓ lowercase */
```

No change needed.

### `globals.css` — Stylelint `scss/at-rule-no-unknown`

**Reported:** Flagging `@custom-variant` and `@theme` as unknown at-rules.

**Verified:** No `.stylelintrc.json` exists. Stylelint is not installed. This is a VS Code extension false positive — not a project lint rule. Investigated and skipped three times previously.

### `dialog.tsx` — `bg-black/60`

**Reported:** Hardcoded color class should use a design token.

**Verified:** Already fixed to `bg-overlay` in a prior commit.

### `tabs.tsx` — `rounded-lg`

**Reported:** Should be `rounded-xl`.

**Verified:** Already reads `rounded-xl`. The remote applied this fix before this batch arrived.

### `01-design-system.md` — Spelling and Path Errors

**Reported:** "resuable" typo, "appers" typo, path "global.css" should be "app/globals.css".

**Verified:**
- Line 19: "reusable" — already spelled correctly
- Line 27: "appears" — already spelled correctly
- Line 21: `app/globals.css` — already the correct path

No change needed.

### `project-overview.md` — Filesystem Wording

**Reported:** "Canvas snapshots persisted to the filesystem." should reference Vercel Blob.

**Verified:** The line around the reported area already reads:

```text
Canvas snapshots stored as JSON in Vercel Blob at path canvas/{projectId}.json.
```

No filesystem reference found anywhere in the file. Already correct.

---

## Files Changed

| File | What changed |
| --- | --- |
| `components/editor/project-sidebar.tsx` | `rounded-lg` → `rounded-xl` on close button |
| `context/feature-specs/02-editor.md` | Prop line rewritten with types and callback contract |
