# Fix: Workspace Header Height Utility

## Finding

`components/editor/workspace-shell.tsx` used `h-13` on the workspace header:

```tsx
<div className="h-13 flex-none flex items-center justify-between px-4 border-b border-surface-border bg-surface">
```

There was no project-specific `--header-height` token or custom header class
that explained why the header needed an exact custom height.

## Decision

Use `h-14` and keep the rest of the class list unchanged.

## What Changed

Only the height utility changed:

```tsx
h-13 -> h-14
```

## Why

`h-14` is a conventional Tailwind height utility for a 3.5rem header. It keeps
the layout intent clear without introducing a one-off CSS variable for a value
that does not appear to be reused elsewhere.

## How To Fix This Bug

1. Locate the header `div` in `WorkspaceShell`.
2. Replace only the questionable height utility.
3. Leave spacing, border, background, and flex classes unchanged to avoid
   unrelated visual changes.

For future bug fixes, record the finding, decision, what changed, why it changed,
and how the fix was applied in `docs/fixes/`.
