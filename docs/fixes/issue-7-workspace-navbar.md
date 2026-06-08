# Fix: Issue 7 — Remove UserButton from Workspace Navbar

## What Was Broken

The `UserButton` (Clerk's user account widget) appeared in the top-right navbar on
BOTH the editor home page and the workspace page. The workspace already has a
dedicated toolbar at the top of the canvas area; a second `UserButton` in the shared
navbar was redundant and visually cluttered.

---

## Root Cause: The Shared Layout Structure

The workspace page (`app/editor/[roomId]/page.tsx`) lives under the
`app/editor/layout.tsx` route segment. That layout wraps its children in
`EditorShell`, which always renders `EditorNavbar` (with `UserButton`):

```
app/editor/layout.tsx
  → EditorShell
      → EditorNavbar  ← always renders UserButton
      → <main>
          → (page content)
              → editor home: ProjectGrid
              → workspace:   WorkspaceShell
```

Both the editor home (`/editor`) and workspace (`/editor/[roomId]`) share this
layout. `EditorNavbar` had no way to know which page it was on.

---

## The Fix

**Step 1 — Add `isWorkspace` prop to `EditorNavbar`**

```tsx
interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  isWorkspace?: boolean          // ← new
}

export function EditorNavbar({ isSidebarOpen, onToggleSidebar, isWorkspace }: EditorNavbarProps) {
  return (
    <nav ...>
      ...
      {!isWorkspace && (           // ← conditional
        <div>
          <UserButton />
        </div>
      )}
    </nav>
  )
}
```

**Step 2 — Detect workspace context in `EditorShell` using `usePathname`**

`EditorShell` is already a client component (`"use client"`). `usePathname()` from
`next/navigation` returns the current URL path. Workspace paths are always
`/editor/[roomId]` — they start with `/editor/`. The editor home is exactly
`/editor`.

```tsx
import { usePathname } from "next/navigation"

export function EditorShell({ children, initialOwned, initialShared }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isWorkspace = pathname.startsWith('/editor/')  // ← detect workspace

  return (
    ...
    <EditorNavbar
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      isWorkspace={isWorkspace}    // ← pass down
    />
    ...
  )
}
```

---

## The Reusable Lesson

**Use `usePathname()` inside shared layout client components to branch on route
context without prop-drilling from pages.**

In Next.js App Router, layouts wrap multiple pages and don't receive per-page props.
The three ways to give a layout route-specific context:

| Approach | When to use |
|---|---|
| `usePathname()` | Simple path matching; no server data needed |
| React Context (provided by page) | Page needs to send structured data up to layout |
| Route Group layouts | Different layout subtrees for different route segments |

`usePathname()` is the lightest option for simple boolean flags like "am I on the
workspace?" It's synchronous, triggers a re-render when the path changes (e.g.,
navigating back to home), and requires no prop threading between page and layout.

---

## AI Discussion Topics

**1. Why can't a server layout receive per-page props?**
In the Next.js App Router, `layout.tsx` files wrap their `children` at build time
as a static slot. Layouts don't re-render when children change (only children do).
This is what makes layouts efficient — but also means a layout can't "see" what page
is currently rendering. What are the architectural trade-offs of this design compared
to React Router's nested routes?

**2. `usePathname` vs. a React Context approach**
Using `usePathname` in EditorShell is simple but couples the layout to URL
structure. If the workspace URL changed (e.g., to `/canvas/[id]`), the `startsWith`
check would need to change too. A Context approach would decouple the URL from the
behavior. When would you choose Context over `usePathname`?

**3. Route group layouts as an alternative**
Next.js route groups (`(group)` folders) let you apply different layouts to
different route segments without affecting the URL. Could you restructure the editor
routes so that workspace and home have separate layouts? What would you gain or lose
compared to the current shared layout + conditional rendering approach?

**4. The sidebar toggle on workspace pages**
`EditorNavbar` still renders the sidebar toggle on workspace pages, even though the
sidebar (project list) is hidden by the workspace canvas. Should the toggle be
hidden on workspace pages too? What is the UX cost of showing controls that have no
visible effect?
