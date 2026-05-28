# Fix: Clicking a project did nothing (no navigation to workspace)

## What broke

Clicking any project in the sidebar had no effect. The URL stayed at `/editor`
and the workspace shell never rendered.

## Root cause 1 — missing `onClick` on `ProjectListItem`

`ProjectListItem` in `components/editor/project-sidebar.tsx` was rendered as a
`<div>` with `cursor-pointer` styling but no click handler:

```tsx
<div
  className="group flex items-center justify-between px-2 py-1.5 rounded-xl
             hover:bg-elevated cursor-pointer ..."
>
  {/* name span and action buttons — no navigation */}
</div>
```

The rename and delete icon buttons inside it already called
`e.stopPropagation()`. That's the tell-tale sign: `stopPropagation` only makes
sense when a parent element has a handler to stop. The navigation click handler
was always intended but was never added.

**Fix:** imported `useRouter` from `next/navigation` and added:

```tsx
onClick={() => router.push(`/editor/${project.id}`)}
```

to the outer `<div>`. The rename/delete buttons continue to call
`e.stopPropagation()` so they open their dialogs without also triggering
navigation.

## Why `useRouter` instead of `<Link>`

Both are valid. `<Link>` is the idiomatic Next.js choice for anchor-style
navigation and adds prefetching for free. `useRouter().push()` is better when:

- The clickable element is not semantically an anchor (here it's a `<div>` with
  icon buttons nested inside)
- Wrapping in `<Link>` would create invalid HTML (`<a>` containing `<button>`)

Wrapping the whole item in `<Link>` would produce `<a><button>...</button></a>`,
which is invalid HTML and causes accessibility issues. Keeping the `<div>` and
using `useRouter` avoids that.

## Root cause 2 — AI sidebar closed by default

`WorkspaceShell` (`components/editor/workspace-shell.tsx`) initialised the AI
sidebar state as:

```ts
const [isAISidebarOpen, setIsAISidebarOpen] = useState(false)
```

The expected design shows the AI Copilot panel open when a workspace loads.
Changed to `useState(true)`.

## Beginner model — event bubbling and `stopPropagation`

When you click a button inside a div, the click event fires on the button first,
then "bubbles up" through its parent elements — the div, the section, the body,
all the way to the document. Each ancestor's `onClick` fires in turn unless
something stops the chain.

`e.stopPropagation()` breaks that chain at the element where it's called. In
this pattern:

```
<div onClick={navigateToProject}>       ← fires last (parent)
  <button onClick={(e) => {
    e.stopPropagation()                 ← stops the event here
    openRenameDialog()
  }}>Rename</button>
</div>
```

Clicking Rename → `openRenameDialog` runs, propagation stops, `navigateToProject`
never fires. Clicking anywhere else on the div → only `navigateToProject` runs.
This is a common pattern for list items that have both a primary action (navigate)
and secondary inline actions (rename, delete).
