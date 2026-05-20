# Feature 04 — Project Dialogs & Editor Home Implementation Plan & Learning Guide

This document records how the editor home screen, project dialogs, and sidebar actions were implemented in Ghost AI. It explains every architectural decision in beginner-friendly terms so you can understand not just *what* the code does, but *why* it was written that way.

---

## What We Built

Feature 03 left the editor at `/editor` showing "Canvas goes here." Feature 04 turns that into a real home screen and adds the ability to manage projects through dialogs. Specifically:

1. The `/editor` home screen — heading, description, New Project button
2. A **Create Project** dialog with a live slug preview
3. A **Rename Project** dialog (prefilled, Enter to submit)
4. A **Delete Project** dialog (destructive confirm, no input)
5. Sidebar project items with Rename / Delete actions (owned projects only)
6. A mobile backdrop scrim that closes the sidebar when tapped
7. A dedicated `useProjectDialogs` hook for all dialog/form/loading state
8. A React Context provider so both the home page and sidebar can trigger the same dialogs

No API calls or database writes — mock data only at this stage.

---

## Files Changed

| File | Status | What Changed |
|---|---|---|
| `hooks/use-project-dialogs.ts` | New | Hook managing all dialog, form, and loading state. Also defines mock project data and the `MockProject` type. |
| `components/editor/project-dialogs-context.tsx` | New | React Context provider. Uses the hook and shares its return value with every component in the editor layout tree. |
| `components/editor/project-dialogs.tsx` | New | The three dialog components (Create, Rename, Delete). Each reads state from the context. |
| `app/editor/layout.tsx` | Modified | Wrapped with `ProjectDialogsProvider`. Added mobile backdrop scrim. |
| `app/editor/page.tsx` | Modified | Replaced "Canvas goes here" placeholder with the real home screen. |
| `components/editor/project-sidebar.tsx` | Modified | Added project item list with hover-revealed rename/delete actions. Sidebar New Project button now opens the Create dialog. |
| `context/progress-tracker.md` | Modified | Marked Feature 04 complete. |

---

## The Architecture Problem: How Do Two Different Components Share a Dialog?

This is the core design challenge of this feature. Here's the situation:

- The **editor home page** (`app/editor/page.tsx`) has a "New Project" button.
- The **sidebar** (`components/editor/project-sidebar.tsx`) also has a "New Project" button, plus per-project Rename and Delete buttons.
- Both need to open the **same dialogs**.

The dialogs need to appear over the entire screen, so they have to be rendered high up in the component tree. And their state — is the dialog open? which project is being renamed? — needs to be shared across components that don't have a direct parent-child relationship.

### Why props don't work here

In Next.js, the layout renders `{children}` — the current page. You can't pass props *into* `{children}`. If the layout tried to do this:

```tsx
// ❌ This doesn't work
<main>{React.cloneElement(children, { openCreate })}</main>
```

TypeScript would reject it, and it would break server components anyway.

### The solution: React Context

React Context is a mechanism for sharing data across the component tree without manually passing it down as props at every level. Think of it as a global variable that any component can opt into reading, as long as it lives inside the provider.

We used three layers:

1. **`useProjectDialogs` hook** — pure state logic, no React Context involved
2. **`ProjectDialogsProvider`** — calls the hook, puts its return value into a context, renders the dialogs
3. **`useProjectDialogsContext()`** — any component calls this to get access to `openCreate`, `openRename`, etc.

```
EditorLayout
└── ProjectDialogsProvider          ← provides the context
    ├── EditorNavbar
    ├── ProjectSidebar               ← calls useProjectDialogsContext()
    ├── <main>
    │   └── EditorPage               ← calls useProjectDialogsContext()
    └── ProjectDialogs               ← rendered inside the provider, reads context
        ├── CreateProjectDialog
        ├── RenameProjectDialog
        └── DeleteProjectDialog
```

---

## Concept Explanations (For Beginners)

### What is a React hook?

A hook is a function whose name starts with `use` that lets you "hook into" React's features — specifically state and lifecycle effects — from inside a function component.

```typescript
// hooks/use-project-dialogs.ts
export function useProjectDialogs() {
  const [open, setOpen] = useState<DialogType>(null)
  const [createName, setCreateNameState] = useState("")
  // ...
  return { open, createName, openCreate, handleCreate, /* ... */ }
}
```

The hook is just a function. It doesn't render anything. It doesn't know who calls it. It returns state values and functions for updating them. This makes it reusable and testable in isolation.

**Why put state in a hook instead of directly in a component?**

Because the state needs to be used in multiple places. If you put `useState` directly in `ProjectSidebar`, only `ProjectSidebar` can read or update it. By extracting it into a hook (and then a context provider), any component in the tree can participate.

---

### What is React Context?

Context solves the "prop drilling" problem. Prop drilling is when you pass a value through many layers of components just to get it to a deeply nested one — even if the middle layers don't care about it.

```
// Without context — prop drilling
Layout → ProjectSidebar (has openCreate) → ... many layers ... → DeepButton (needs openCreate)

// With context
Layout → ProjectDialogsProvider (provides openCreate)
                                     ↓ any component anywhere below can call:
                            useProjectDialogsContext() to get openCreate
```

The three parts of our context system:

```typescript
// 1. Create the context bucket
const ProjectDialogsContext = createContext<ProjectDialogsContextValue | null>(null)

// 2. The Provider — fills the bucket with data
export function ProjectDialogsProvider({ children }) {
  const dialogs = useProjectDialogs()    // call the hook
  return (
    <ProjectDialogsContext.Provider value={dialogs}>
      {children}
      <ProjectDialogs />
    </ProjectDialogsContext.Provider>
  )
}

// 3. The consumer hook — reads from the bucket
export function useProjectDialogsContext() {
  const ctx = useContext(ProjectDialogsContext)
  if (!ctx) throw new Error("Must be inside ProjectDialogsProvider")
  return ctx
}
```

The `throw` in the consumer is a defensive guard. If someone calls `useProjectDialogsContext()` outside the provider tree (easy mistake during refactoring), they get a clear error message instead of a cryptic `undefined is not a function` crash.

---

### Why are the dialogs rendered inside the provider?

```tsx
export function ProjectDialogsProvider({ children }) {
  const dialogs = useProjectDialogs()
  return (
    <ProjectDialogsContext.Provider value={dialogs}>
      {children}
      <ProjectDialogs />   {/* ← here */}
    </ProjectDialogsContext.Provider>
  )
}
```

`ProjectDialogs` uses `useProjectDialogsContext()`. It can only do that if it's *inside* the provider. By rendering it as a sibling to `{children}` (but still inside the provider), it has access to the context while sitting high up in the DOM — which is exactly what Radix UI's Dialog portals need to render the overlay correctly over the whole page.

---

### How does the slug preview work?

The Create Project dialog shows a live URL preview as you type:

```
ghost.ai/my-project-name
```

We derive the slug from the name whenever the input changes:

```typescript
function toSlug(name: string): string {
  return name
    .toLowerCase()           // "My Project" → "my project"
    .replace(/\s+/g, "-")   // "my project" → "my-project"
    .replace(/[^a-z0-9-]/g, "")  // strip special chars
    .replace(/^-+|-+$/g, "")     // trim leading/trailing hyphens
}

const setCreateName = (name: string) => {
  setCreateNameState(name)
  setCreateSlug(toSlug(name))
}
```

We do both state updates synchronously in the same callback instead of using `useEffect`. This avoids the one-render delay you'd get with an effect, and there's no async work involved — it's just a string transform.

---

### Controlled vs uncontrolled dialogs

The Radix `Dialog` component can work in two modes:

**Uncontrolled** — the dialog manages its own open/close state internally:
```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

**Controlled** — *you* manage the state and pass it in:
```tsx
<Dialog open={open === "create"} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
  <DialogContent>...</DialogContent>
</Dialog>
```

We use **controlled mode** because multiple separate buttons (the home page button *and* the sidebar button) need to open the same dialog. There's no single `DialogTrigger` button to attach to — the trigger comes from state changes in the context.

The `onOpenChange` pattern `(isOpen) => !isOpen && closeDialog()` means: "when the dialog asks to close (e.g., user pressed Escape or clicked the backdrop), call our `closeDialog` function." We only act on `isOpen === false` because we don't need to do anything special when it opens — that already happened via `openCreate()`.

---

### How does "Enter submits" work in the Rename dialog?

```tsx
<Input
  autoFocus
  value={renameName}
  onChange={(e) => setRenameName(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && renameName.trim() && !isLoading) {
      e.preventDefault()
      handleRename()
    }
  }}
/>
```

`onKeyDown` fires for every keypress. We check three conditions before submitting:
- `e.key === "Enter"` — it was the Enter key
- `renameName.trim()` — the input isn't empty
- `!isLoading` — a submission isn't already in flight

`e.preventDefault()` stops the browser's default behavior for Enter inside a form (which would be to submit the closest `<form>` element, potentially causing a page reload).

---

### Why `group` and `group-hover` for the sidebar action buttons?

The rename and delete buttons should only appear when you hover over a project item. Tailwind's `group` utility handles this without JavaScript:

```tsx
<div className="group flex items-center justify-between ...">
  <span>{project.name}</span>
  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
    {/* action buttons */}
  </div>
</div>
```

`group` marks the outer container. `group-hover:opacity-100` means "when the *group* (the outer div) is hovered, set opacity to 100 on *this* element." The transition makes it fade in/out smoothly.

Without `group`, you'd need JavaScript `onMouseEnter`/`onMouseLeave` state to achieve the same effect.

---

### Why owned-only actions?

The spec says: "Show actions only for owned projects. Hide actions for shared/collaborator projects."

In the current mock data, `isOwned` is a boolean on `MockProject`. We filter in the `ProjectItem` component:

```tsx
{project.isOwned && (
  <div className="opacity-0 group-hover:opacity-100 ...">
    <button onClick={() => openRename(project)}>...</button>
    <button onClick={() => openDelete(project)}>...</button>
  </div>
)}
```

When the real database is wired up, `isOwned` will be derived from checking `project.ownerId === currentUserId`. The UI logic stays identical — only the data source changes.

---

### The mobile backdrop scrim

```tsx
{isSidebarOpen && (
  <div
    className="fixed inset-0 z-30 bg-overlay md:hidden"
    onClick={() => setIsSidebarOpen(false)}
    aria-hidden="true"
  />
)}
```

A few things happening here:

- `fixed inset-0` — covers the entire viewport from edge to edge
- `z-30` — sits above the main content (`z-0`) but below the sidebar (`z-40`) and navbar (`z-50`)
- `bg-overlay` — the `--overlay: rgba(0, 0, 0, 0.6)` token; semi-transparent dark scrim
- `md:hidden` — only rendered on small screens (below Tailwind's `md` breakpoint, 768px)
- `onClick` — tapping the scrim closes the sidebar
- `aria-hidden="true"` — tells screen readers to ignore this decorative element; the close button in the sidebar header is the accessible way to close it

---

### Why `"use client"` on the hook file?

```typescript
"use client"
// hooks/use-project-dialogs.ts
import { useState } from "react"
```

`useState` is a client-side React API — it doesn't exist on the server. Without `"use client"`, Next.js might try to run this file during server-side rendering and throw an error.

Any file that imports browser APIs (`useState`, `useEffect`, event handlers, `window`, etc.) needs `"use client"` at the top. It tells the bundler: "this module is part of the client bundle."

---

## Testing Phase

No bugs were encountered during implementation. The build compiled cleanly on the first run:

```
✓ Compiled successfully in 4.3s
✓ TypeScript clean
✓ 0 lint errors, 0 warnings (after removing an unused `useRef` import)
```

The one lint warning (`useRef` imported but unused) was a leftover from a draft. Removed before the final build.

---

## Verification Steps

1. `npm run dev` — dev server starts
2. Navigate to `/editor` — home screen shows heading, description, and New Project button
3. Click **New Project** → Create dialog opens; type a name → slug updates live below the input
4. Open sidebar → **My Projects** tab shows 2 owned projects with rename/delete icons on hover
5. **Shared** tab shows 2 projects with no action icons
6. Click **Pencil** on an owned project → Rename dialog opens, prefilled with the project name; pressing Enter submits
7. Click **Trash** on an owned project → Delete dialog opens with destructive (red) Delete button
8. Sidebar footer **New Project** → opens Create dialog (same as home page button)
9. On a mobile viewport (< 768px): open sidebar → dark scrim appears; tap scrim → sidebar closes
10. `npm run lint` — 0 errors
11. `npm run build` — clean TypeScript, clean build output

---

## Design Token Cheat Sheet

| Usage | Token |
|---|---|
| Page background | `bg-base` |
| Sidebar/navbar surface | `bg-surface` |
| Hover highlight on project items | `bg-elevated` |
| Primary text | `text-copy-primary` |
| Muted/helper text | `text-copy-muted` |
| Borders | `border-surface-border` |
| Mobile scrim | `bg-overlay` |
| Error/destructive | `text-error` (hover), `variant="destructive"` (button) |
| Slug preview | `font-mono text-xs text-copy-muted` |

---

## Further Reading

- [React Context docs](https://react.dev/learn/passing-data-deeply-with-context) — the official guide to what we built with `ProjectDialogsProvider`
- [React custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) — why we extracted state into `useProjectDialogs`
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) — the underlying primitive behind `components/ui/dialog.tsx`
- [Tailwind group-hover](https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state) — how the action button hover reveal works
- [TypeScript interfaces](https://www.typescriptlang.org/docs/handbook/2/objects.html) — the `MockProject` and `ProjectDialogsContextValue` shapes
