# Feature 02 — Editor Chrome: Navbar + Sidebar

## What This Feature Is

Before any canvas, AI, or collaboration features can exist, the editor screen needs a structural frame — a consistent shell that wraps everything. Feature 02 builds that shell:

- A **fixed top navbar** that always sits at the top of the screen
- A **floating left sidebar** that slides in and out without pushing other content

These are pure UI components. They hold no business logic, make no API calls, and store no data. Their only job is layout and user-triggered visibility.

---

## Spec Summary

From `context/feature-specs/02-editor.md`:

### Editor Navbar
- Fixed-height, always visible at the top
- Three zones: left (sidebar toggle), center (empty for now), right (empty for now)
- Left zone shows `PanelLeftOpen` or `PanelLeftClose` icon depending on sidebar state
- Dark background with a subtle bottom border

### Project Sidebar
- Floats **above** the editor — opening it must not shift the page layout
- Slides in from the left (CSS transition)
- Receives `isOpen` and `onClose` as props
- Header: "Projects" title + X (close) button
- shadcn `Tabs`: "My Projects" and "Shared" — both showing empty placeholder text
- Full-width "New Project" button with a `Plus` icon pinned to the bottom

### Dialog Pattern
- The existing `components/ui/dialog.tsx` (installed via shadcn CLI) already uses the project's design tokens
- No new dialog code needed — just confirm it's wired up correctly

---

## Files Created

```
components/
└── editor/
    ├── editor-navbar.tsx      ← NEW
    └── project-sidebar.tsx    ← NEW
```

```
context/
└── progress-tracker.md       ← UPDATED (Feature 02 added to Completed)
```

---

## Implementation Plan

### Step 1 — Update progress-tracker.md

Set Current Phase to Feature 02, add it to Completed once done.

### Step 2 — editor-navbar.tsx

**Why `"use client"`?**
This component has an `onClick` handler (`onToggleSidebar`). Any component that responds to browser events — clicks, input, scroll — must be a Client Component. React Server Components cannot run event handlers because they only render on the server.

```tsx
"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function EditorNavbar({ isSidebarOpen, onToggleSidebar }: EditorNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-3 bg-surface border-b border-surface-border">
      <div>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-xl text-copy-muted hover:text-copy-primary transition-colors"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="flex-1" />

      <div />
    </nav>
  )
}
```

**Key styling decisions:**
| Class | What it does |
|---|---|
| `fixed top-0 left-0 right-0` | Pins navbar to the top edge of the viewport regardless of scroll |
| `z-50` | Stacks it above everything else |
| `h-14` | Fixed height (3.5rem = 56px) |
| `bg-surface` | Dark surface color from design tokens, not a raw hex value |
| `border-b border-surface-border` | Subtle separator line beneath the navbar |
| `text-copy-muted hover:text-copy-primary` | Muted icon that brightens on hover |

### Step 3 — project-sidebar.tsx

**Why `"use client"`?**
Two reasons: the close button has an `onClick` handler, and the shadcn `<Tabs>` component itself is already a Client Component. A Server Component cannot render a Client Component as a direct child without wrapping it — so the sidebar must also be a Client Component.

**How the slide animation works:**
Instead of toggling `display: none` (which is instant and jarring), we use a CSS `transform`. The sidebar always exists in the DOM. When closed, it's shifted 100% to the left off-screen. When open, the shift is removed. The `transition-transform duration-300` class smoothly animates between the two states.

```tsx
// closed: sidebar is off the left edge of the screen
"-translate-x-full"

// open: sidebar is in its natural position
"translate-x-0"
```

**Why `fixed top-14`?**
The navbar is `h-14` (3.5rem). The sidebar uses `top-14` so it starts exactly where the navbar ends, and `h-[calc(100vh-3.5rem)]` so it fills the remaining screen height without overlapping the navbar or scrollbar.

**Why doesn't it push content?**
`position: fixed` removes the element from the normal document flow. The rest of the page has no idea the sidebar exists — it doesn't reflow when the sidebar opens. This matches the spec: "opening it should not push page content."

```tsx
"use client"

import { X, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <aside
      className={`fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-72 flex flex-col bg-surface border-r border-surface-border transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-sm font-semibold text-copy-primary">Projects</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-lg text-copy-muted hover:text-copy-primary transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-4">
        <Tabs defaultValue="my-projects" className="flex flex-col flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="my-projects" className="flex-1">My Projects</TabsTrigger>
            <TabsTrigger value="shared" className="flex-1">Shared</TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects" className="flex-1">
            <p className="text-sm text-copy-muted text-center py-8">No projects yet.</p>
          </TabsContent>

          <TabsContent value="shared" className="flex-1">
            <p className="text-sm text-copy-muted text-center py-8">No shared projects yet.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="mt-auto p-4 border-t border-surface-border">
        <Button className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </aside>
  )
}
```

---

## Files Modified (Layout Integration)

After the components were built, they were wired into a dedicated editor route:

```
app/
└── editor/
    ├── layout.tsx   ← NEW — owns sidebar state, renders navbar + sidebar
    └── page.tsx     ← NEW — placeholder canvas content at /editor
```

`app/editor/layout.tsx` is a `"use client"` component because it uses `useState` to track `isSidebarOpen`. It passes that state and the toggle/close callbacks down to the navbar and sidebar. The `<main>` inside the layout has `pt-14` to push page content below the fixed navbar.

---

## Testing Phase — What Went Wrong and Why

### Issue 1: Missing `type="button"` on `<button>` elements

**Where it was caught:** The IDE's diagnostic panel flagged both buttons immediately after the files were written.

**The warning:**
```
Button type attribute has not been set.
```

**What this means for a beginner:**

In HTML, a `<button>` inside a `<form>` has a default `type` of `"submit"`. This means that if you place a button inside (or near) a form without explicitly declaring its type, clicking it may accidentally submit the form — even if that's not what you intended.

Even when there's no visible form, the browser still applies this default, and linters flag it because the intent is ambiguous. The rule exists to force you to be explicit.

There are three valid values for the `type` attribute:

| Value | What it does |
|---|---|
| `type="button"` | Does nothing on its own — only fires its `onClick` handler |
| `type="submit"` | Submits the nearest ancestor `<form>` |
| `type="reset"` | Resets the nearest ancestor `<form>` to its default values |

**The fix:**

Add `type="button"` to every `<button>` that is not meant to submit a form:

```tsx
// Before (ambiguous — browser defaults to "submit" inside forms)
<button onClick={onToggleSidebar}>

// After (explicit — does exactly what onClick says, nothing more)
<button type="button" onClick={onToggleSidebar}>
```

**Rule of thumb:** Any `<button>` that is not inside a `<form>` and is not meant to submit data should always have `type="button"`. When in doubt, add it — it never hurts.

### Issue 2: React Hydration Mismatch on `<body>`

**Where it was caught:** The browser's dev overlay showed a hydration error after the layout was integrated and the dev server was running.

**The error:**
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
```

**The diff shown in the error:**
```diff
<body
  className="min-h-full flex flex-col"
- data-new-gr-c-s-check-loaded="14.1292.0"
- data-gr-ext-installed=""
>
```

**What React hydration is:**

Next.js renders pages twice. First on the **server**: it produces plain HTML and sends it to the browser immediately so the user sees content fast. Then on the **client**: React loads, re-runs your components, and "hydrates" — attaching event listeners and taking over the static HTML.

For hydration to succeed, the server-rendered HTML and the client-rendered HTML must be identical. If React finds any difference, it warns you and refuses to reconcile the two versions, because it doesn't know which one is correct.

**What caused the mismatch:**

The attributes `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` are injected by the **Grammarly browser extension**. The sequence of events:

1. Server renders `<body className="min-h-full flex flex-col">` and sends it to the browser
2. The browser receives the HTML — Grammarly runs immediately and adds its own attributes to `<body>`
3. React boots up, inspects the DOM, and sees a `<body>` with extra attributes
4. React compares against what the server produced — mismatch, hydration warning fires

**This is not a bug in your code.** It only happens in your local browser because you have Grammarly installed. Users without Grammarly won't see this. It also does not affect any functionality — the page works correctly.

**The fix:**

Add `suppressHydrationWarning` to the `<body>` tag in `app/layout.tsx`:

```tsx
// Before
<body className="min-h-full flex flex-col">{children}</body>

// After
<body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
```

`suppressHydrationWarning` tells React: "I know this element may differ between server and client — don't warn about it." Importantly, it only suppresses warnings **one level deep** — it applies only to the `<body>` tag's own attributes, not to anything inside the body. So it silences the Grammarly noise without masking real mismatches in your app's actual content.

**When to use it:** Only on elements that browser extensions or third-party scripts are known to modify (typically `<html>` and `<body>`). Never use it to silence hydration errors in your own components — those are real bugs that need fixing.

---

## Verification Steps

```bash
# Check for lint errors (ESLint)
npm run lint

# Check for TypeScript errors and build the project
npm run build
```

Both commands should exit with no errors. If `npm run build` exits with code `0`, the TypeScript compiler found no type violations.

---

## What "Dialog Pattern Ready" Means

The spec says to ensure the dialog pattern is ready for future use without building actual dialogs yet.

The shadcn `dialog.tsx` component (installed in `components/ui/dialog.tsx`) uses shadcn's semantic CSS variables internally — things like `--background`, `--foreground`, `--border`. In `globals.css`, those variables are already wired to the project's design tokens:

```css
--background: var(--bg-base);
--foreground: var(--text-primary);
--border: var(--border-default);
```

This means the dialog will automatically inherit the correct dark theme colors as soon as it is used. No extra configuration is needed.

---

## Design Token Cheat Sheet (Used in This Feature)

| Tailwind class | CSS variable | Hex |
|---|---|---|
| `bg-surface` | `--bg-surface` | `#111114` |
| `text-copy-primary` | `--text-primary` | `#f0f0f4` |
| `text-copy-muted` | `--text-muted` | `#808090` |
| `border-surface-border` | `--border-default` | `#2a2a30` |

These are the only color references used — no raw hex values, no raw Tailwind color classes like `zinc-900`. This is enforced by the project's code standards.
