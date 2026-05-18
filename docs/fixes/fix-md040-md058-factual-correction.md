# Fix: MD040 Unlanguaged Fences, MD058 Table Spacing, and Factual Correction in Docs

## What Was Wrong

Three categories of issues were reported across two documentation files:

1. **MD040** — fenced code blocks missing a language identifier
2. **MD058** — a table with no blank line separating it from the preceding paragraph
3. **Factual error** — an incorrect claim about how Next.js Server Components and Client Components interact

---

## Verification Step (Always Do This First)

Before fixing, each finding was confirmed against the current files using `cat -n` to see exact line numbers. All three categories were present and valid.

---

## Issue 1: MD040 — Unlanguaged Fenced Code Blocks

### What MD040 Is

Markdownlint rule MD040 requires every fenced code block (a block delimited by triple backticks) to declare what language it contains. A fence without a language tag looks like this:

````text
```
some content here
```
````

A fence with a language tag looks like this:

````text
```text
some content here
```
````

### Why It Matters

The language tag does two things:

1. **Syntax highlighting** — editors and rendered Markdown use it to color the code correctly. `tsx` gets React/TypeScript highlighting, `css` gets property highlighting, `bash` gets shell highlighting, etc.
2. **Lint compliance** — CI pipelines that run markdownlint will fail on MD040 violations, blocking merges.

For blocks that contain plain output or pseudo-code (not a real language), `text` is the correct tag. It tells readers and tools "this is literal text, not a programming language."

### Files and Blocks Fixed

**`docs/fixes/fix-dialog-overlay-token.md`:**

| Location | Content | Tag added |
| --- | --- | --- |
| Output of `grep` command | `20:        "fixed inset-0 z-50 bg-black/60...` | `text` |
| IDE warning output | `Unknown at rule @apply [unknownAtRules] (css)` | `text` |
| Token cheat sheet steps | `Step 1: ... Step 2: ... Step 3: ...` | `text` |

**`docs/plans/02-editor.md`:**

| Location | Content | Tag added |
| --- | --- | --- |
| Files Created — components tree | `components/└── editor/...` | `text` |
| Files Created — context tree | `context/└── progress-tracker.md` | `text` |
| Files Modified — app tree | `app/└── editor/...` | `text` |
| Issue 1 warning | `Button type attribute has not been set.` | `text` |
| Issue 2 error | `A tree hydrated but some attributes...` | `text` |
| Issue 3 token pattern | `1. :root → ... 2. @theme inline → ...` | `text` |

### Before / After Example

Before:
````text
```
Button type attribute has not been set.
```
````

After:
````text
```text
Button type attribute has not been set.
```
````

---

## Issue 2: MD058 — Missing Blank Line Before Table

### What MD058 Is

Markdownlint rule MD058 requires a blank line before and after every Markdown table. This prevents the table from visually merging with surrounding prose when rendered by strict parsers.

### Where It Was

In `docs/plans/02-editor.md`, the "Key styling decisions" table immediately followed a bold label with no blank line between them:

```text
**Key styling decisions:**
| Class | What it does |
|---|---|
...
```

### The Fix

Add a blank line between the label and the table:

```text
**Key styling decisions:**

| Class | What it does |
|---|---|
...
```

---

## Issue 3: Factual Error — Server Components and Client Components

### What Was Written

In `docs/plans/02-editor.md`, the explanation for why `project-sidebar.tsx` uses `"use client"` said:

> A Server Component cannot render a Client Component as a direct child without wrapping it — so the sidebar must also be a Client Component.

### Why This Is Wrong

This is incorrect. In the Next.js App Router, **a Server Component can directly import and render a Client Component** — no wrapper required. The `"use client"` directive marks a *boundary* in the component tree. Everything below that boundary (including children that don't declare `"use client"` themselves) becomes part of the client bundle. But from the Server Component's perspective, it simply imports and renders the Client Component like any other component.

The only real constraint is the reverse: a Client Component cannot import a Server Component (because Server Components run only on the server and can't be bundled for the browser). But that's not what was happening here.

### What Was Actually True

The sidebar needs `"use client"` for two legitimate reasons:
- The close button has an `onClick` handler — event handlers require a client context
- The shadcn `<Tabs>` component manages active-tab state internally — it's already a Client Component

Neither of these reasons involves any rule about rendering hierarchy. The sidebar is a Client Component **because it uses interactivity**, full stop.

### The Corrected Text

Before:
> Two reasons: the close button has an `onClick` handler, and the shadcn `<Tabs>` component itself is already a Client Component. A Server Component cannot render a Client Component as a direct child without wrapping it — so the sidebar must also be a Client Component.

After:
> The sidebar uses browser interactivity: the close button has an `onClick` handler, and the shadcn `<Tabs>` component manages its own active-tab state. Either of those is sufficient to require `"use client"`. Note: in Next.js App Router, Server Components *can* directly render Client Components — the client boundary is simply established at the import. The sidebar is a Client Component because it needs interactivity, not because of any rule about rendering hierarchy.

### The Rule to Remember

| Allowed? | Direction |
| --- | --- |
| Yes | Server Component renders a Client Component |
| No | Client Component imports a Server Component |

The `"use client"` directive is about **what the component does** (uses hooks, events, browser APIs), not about **who renders it**.

---

## What Was Skipped

The Stylelint finding (`scss/at-rule-no-unknown` on `@custom-variant` and `@theme`) was reported again in the same batch. Skipped for the same reason as before: no `.stylelintrc.json` exists and Stylelint is not installed. This is an IDE extension false positive, not a project lint rule.

---

## Files Changed

| File | What changed |
| --- | --- |
| `docs/fixes/fix-dialog-overlay-token.md` | Added `text` language tag to 3 unlanguaged fences |
| `docs/plans/02-editor.md` | Added `text` language tag to 6 unlanguaged fences; added blank line before Key styling decisions table; corrected factual claim about Server/Client Component rendering rules |
