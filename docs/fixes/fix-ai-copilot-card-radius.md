# Fix: AI Copilot Card Radius Tokens

## What Was Wrong

The AI Copilot sidebar has two card-like panels:

- `ChatPendingCard`
- `FutureHooksCard`

Both are visual containers. In this project, card and panel containers should use
`rounded-2xl`, while smaller inline controls can use smaller radius tokens.

Before this fix, both card containers used `rounded-xl`:

```tsx
<div className="rounded-xl border border-surface-border bg-elevated p-4">
```

That made the panels slightly sharper than the rest of the project card system.
The issue was small visually, but it mattered because radius tokens are part of
the design language. When similar surfaces use different corner sizes, the UI
starts to feel inconsistent.

| File | Finding | Status |
| --- | --- | --- |
| `components/editor/ai-copilot-sidebar.tsx` | `ChatPendingCard` outer card used `rounded-xl` | Fixed |
| `components/editor/ai-copilot-sidebar.tsx` | `FutureHooksCard` outer card used `rounded-xl` | Fixed |
| `components/editor/ai-copilot-sidebar.tsx` | Other `rounded-xl` / `rounded-lg` usages inside controls | Skipped: those are smaller controls, not card containers |

---

## The Fix

Only the two outer card containers changed.

### Fix 1: `ChatPendingCard`

```tsx
// Before
<div className="rounded-xl border border-surface-border bg-elevated p-4">

// After
<div className="rounded-2xl border border-surface-border bg-elevated p-4">
```

### Fix 2: `FutureHooksCard`

```tsx
// Before
<div className="rounded-xl border border-surface-border bg-elevated p-4">

// After
<div className="rounded-2xl border border-surface-border bg-elevated p-4">
```

Everything else in the class lists stayed the same:

- `border border-surface-border` keeps the same border treatment.
- `bg-elevated` keeps the same surface color.
- `p-4` keeps the same spacing.

This is intentionally a tiny change. The bug was about the radius token only, so
the fix should not reshape the layout, spacing, color, or behavior.

---

## Why This Approach

### Why use `rounded-2xl` here?

The project follows a simple radius scale:

| UI element type | Radius token |
| --- | --- |
| Small controls, icon buttons, compact inputs | `rounded-xl` |
| Cards and panels | `rounded-2xl` |
| Larger overlays and dialogs | `rounded-3xl` |

`ChatPendingCard` and `FutureHooksCard` are cards because they are self-contained
content blocks inside the sidebar. They have their own background, border, and
padding. That combination makes them container-level surfaces, not inline
controls.

### Why not change every `rounded-xl` in the file?

There is another `rounded-xl` around the disabled chat input area:

```tsx
<div className="flex items-center gap-2 rounded-xl border border-surface-border bg-elevated px-3 py-2">
```

That wrapper behaves more like a compact input/control group than a large card.
Changing it in this fix would go beyond the reported issue and could create a
different design inconsistency. The safest fix is to change only the two
reported card containers.

There are also `rounded-lg` icon buttons in the same file. Those were not part
of this report, and changing them would be a separate design-system decision.

---

## Validation Cleanup

During validation, the file had non-code issue text above the `"use client"`
directive. That made TypeScript and ESLint parse normal English as JavaScript,
which produced many syntax errors before the real component code was even
reached.

The non-code preamble was removed so the file starts correctly:

```tsx
"use client"
```

This was necessary to validate the actual fix. A client component must keep
`"use client"` as the first statement in the file, before imports and JSX.

---

## Beginner Mental Model: Radius Tokens Are UI Vocabulary

Think of radius tokens like a small vocabulary for shapes:

- `rounded-xl` says "small, clickable, compact."
- `rounded-2xl` says "card or panel."
- `rounded-3xl` says "large overlay."

The browser does not care which one you choose. All of them compile to
`border-radius`. The reason we care is consistency. If every card uses the same
corner shape, users learn the interface faster because similar things look
similar.

This is why design-system fixes often look tiny in code but still matter:

```diff
- rounded-xl
+ rounded-2xl
```

One class changed, but the component now speaks the same visual language as the
rest of the app.

---

## Beginner Mental Model: Fix the Smallest Valid Surface

When a report says "these card containers should use `rounded-2xl`," there are
two tempting mistakes:

1. Change every radius class in the file.
2. Ignore the report because the visual difference is small.

The better approach is:

1. Verify the report against current code.
2. Identify the exact elements that match the report.
3. Change only those elements.
4. Leave nearby but unrelated classes alone.

That keeps the fix easy to review and reduces the chance of introducing a new
visual regression.

---

## Validation

- IDE diagnostics for `components/editor/ai-copilot-sidebar.tsx`: no linter
  errors.
- File-scoped ESLint passed:

```sh
npm --prefix "/Users/jessejames/Desktop/ghost-ai/my-app-ghost" run lint -- components/editor/ai-copilot-sidebar.tsx
```

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/ai-copilot-sidebar.tsx` | Changed the two AI Copilot card containers from `rounded-xl` to `rounded-2xl`; removed non-code preamble so the file parses correctly |
| `docs/fixes/fix-ai-copilot-card-radius.md` | Added this beginner-friendly fix log |
