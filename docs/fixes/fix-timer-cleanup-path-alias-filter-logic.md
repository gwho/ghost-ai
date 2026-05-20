# Fix: Timer Cleanup, Path Alias, and Filter Logic Separation

## Findings Batch Summary

Three issues were reported across three files. All three were valid and fixed.

| # | File | Issue | Status |
|---|------|-------|--------|
| 1 | `hooks/use-project-dialogs.ts` | `setTimeout` IDs never stored or cleared | Fixed |
| 2 | `.agents/skills/clerk-nextjs-patterns/templates/nextjs-basic-auth/tsconfig.json` | `@/*` path alias pointed to `./src/*` which does not exist | Fixed |
| 3 | `components/editor/project-sidebar.tsx` | Filtering logic lived in the UI component instead of the hook | Fixed |

---

## Fix 1 — Clear `setTimeout` on Unmount (`use-project-dialogs.ts`)

### What Was Wrong

Inside `useProjectDialogs`, three handlers — `handleCreate`, `handleRename`, and `handleDelete` — each called `setTimeout` to simulate a short async loading state before closing the dialog:

```ts
// Before (all three handlers looked like this)
const handleCreate = () => {
  setIsLoading(true)
  setTimeout(() => {
    setIsLoading(false)
    closeDialog()
  }, 400)
}
```

The problem: `setTimeout` returns a **timer ID** — a number you can use later to cancel the timer. None of these three calls stored that ID, so there was no way to:

1. **Cancel an already-running timer** if the user triggered the same action twice quickly (the first timer would still fire).
2. **Clean up on unmount** — if the component that uses this hook is removed from the page while a 400ms timer is still counting down, React would try to call `setIsLoading` and `closeDialog` on state that no longer exists, causing a **"state update on unmounted component"** warning.

### Why This Matters (Beginner Context)

Think of `setTimeout` like setting an alarm clock. If you set two alarms without cancelling the first, both will go off. And if you leave the house (unmount the component) while the alarm is still set, it will still ring even though nobody is home to hear it — except React, which will complain because it tried to update state that no longer exists.

`useRef` is the right tool here because:

- A ref holds a value **across renders** without causing a re-render when it changes.
- It is **mutable**, so you can overwrite `timerRef.current` every time you schedule a new timer.
- `useEffect` with an empty dependency array (`[]`) runs **once on mount** and returns a **cleanup function** that React calls on unmount — the right place to cancel any pending timer.

### Verification

Confirmed all three handlers called `setTimeout` without saving the return value. No prior cleanup mechanism existed in the hook.

### The Fix

**Step 1 — Add `useRef` and `useEffect` to the import:**

```ts
// Before
import { useState } from "react"

// After
import { useEffect, useRef, useState } from "react"
```

**Step 2 — Add a ref and a cleanup effect inside the hook:**

```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  return () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }
}, [])
```

`ReturnType<typeof setTimeout>` is a TypeScript utility that means "whatever type `setTimeout` returns" — which differs between browser (`number`) and Node.js (`NodeJS.Timeout`). Using this avoids hardcoding the wrong type.

The cleanup function runs when the component unmounts. It checks whether a timer is pending (`!== null`) and cancels it if so.

**Step 3 — Extract a shared `scheduleClose` helper:**

Instead of repeating the same `setTimeout` block in all three handlers, one shared function handles it. It also clears any existing timer before scheduling a new one, so rapid repeated clicks don't stack:

```ts
const scheduleClose = () => {
  if (timerRef.current !== null) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    timerRef.current = null
    setIsLoading(false)
    closeDialog()
  }, 400)
}

const handleCreate = () => {
  setIsLoading(true)
  scheduleClose()
}

const handleRename = () => {
  setIsLoading(true)
  scheduleClose()
}

const handleDelete = () => {
  setIsLoading(true)
  scheduleClose()
}
```

Setting `timerRef.current = null` inside the callback is a small but useful touch: once the timer fires naturally, the ref is reset, so the cleanup effect knows there is nothing to cancel.

### What Did Not Change

The public interface (`ProjectDialogsContextValue`), all state variables, all other handlers, and the return shape are identical.

---

## Fix 2 — Correct `@/*` Path Alias in Template `tsconfig.json`

### What Was Wrong

The template file at `.agents/skills/clerk-nextjs-patterns/templates/nextjs-basic-auth/tsconfig.json` had this path alias:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

This tells TypeScript: "when you see an import like `@/components/button`, look for it at `./src/components/button`."

The problem: **this template has no `src/` directory.** Its files live at the root:

```
nextjs-basic-auth/
  app/
    layout.tsx
    page.tsx
  proxy.ts
  package.json
  tsconfig.json
```

So any import using `@/` would fail to resolve because TypeScript would look inside a `src/` folder that does not exist.

### Why This Matters (Beginner Context)

Path aliases like `@/*` are shortcuts so you can write `import { Button } from "@/components/ui/button"` instead of `import { Button } from "../../../components/ui/button"`. They are configured in two places — `tsconfig.json` (for TypeScript) and `next.config.ts` (for the bundler). If the alias points to the wrong folder, every import using `@/` silently breaks at compile time.

The `src/` pattern is common in older Create React App or Vite setups. Next.js App Router projects typically **do not** use a `src/` folder — their `app/`, `components/`, `lib/` directories all live at the root.

### Verification

Checked the template directory listing. No `src/` folder present. The real project's own `tsconfig.json` already used `./*`:

```json
// Real project tsconfig.json (correct)
"paths": {
  "@/*": ["./*"]
}
```

This confirmed the fix was both needed and consistent with the rest of the codebase.

### The Fix

```json
// Before
"paths": {
  "@/*": ["./src/*"]
}

// After
"paths": {
  "@/*": ["./*"]
}
```

`./*` means "start from the directory this `tsconfig.json` lives in" — which is the template root, where `app/` and `proxy.ts` actually are.

### What Did Not Change

Every other compiler option remained identical.

---

## Fix 3 — Move Filter Logic from Component to Hook (`project-sidebar.tsx`)

### What Was Wrong

Inside `ProjectSidebar`, two arrays were computed by filtering the global `MOCK_PROJECTS` constant directly in the component body:

```tsx
// Inside ProjectSidebar — before
import { MOCK_PROJECTS, type MockProject } from "@/hooks/use-project-dialogs"

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const { openCreate } = useProjectDialogsContext()

  const ownedProjects = MOCK_PROJECTS.filter((p) => p.isOwned)
  const sharedProjects = MOCK_PROJECTS.filter((p) => !p.isOwned)
  // ...
}
```

This creates two problems:

1. **Leaking data concerns into UI**: `ProjectSidebar` is a layout/display component. It should receive data that is already shaped for it — not know about raw data sources like `MOCK_PROJECTS` and apply filtering rules itself. The decision of "what counts as owned" is a data concern, not a display concern.

2. **Duplication risk**: If another component also needs this split (say, a mobile sidebar), it would have to duplicate the same filtering logic. Changing the filter condition (e.g., adding a new ownership type) would require updating every component that does its own filtering.

### Why This Matters (Beginner Context)

This is an application of the **separation of concerns** principle: each piece of code should do one thing. A UI component's job is to render. A hook's job is to manage state and prepare data. When a component starts doing data preparation work, it becomes harder to test, reuse, and reason about.

Think of it like a restaurant: the **kitchen** (hook) prepares the food (data). The **waiter** (component) serves it. You don't want the waiter chopping vegetables — that's the kitchen's job.

The hook already owned the `MOCK_PROJECTS` constant and exposed other project-related values. Placing the filtered arrays there keeps everything data-related in one place.

### Verification

Confirmed `MOCK_PROJECTS.filter(...)` existed at lines 53–54 of `project-sidebar.tsx`. Also confirmed `useProjectDialogsContext` returns the value of `useProjectDialogs`, meaning adding fields to `useProjectDialogs`'s return value automatically makes them available via the context hook.

### The Fix

**Step 1 — Add `ownedProjects` and `sharedProjects` to the interface in `use-project-dialogs.ts`:**

```ts
export interface ProjectDialogsContextValue {
  // ... existing fields ...
  ownedProjects: MockProject[]
  sharedProjects: MockProject[]
}
```

**Step 2 — Compute and return them from `useProjectDialogs`:**

```ts
const ownedProjects = MOCK_PROJECTS.filter((p) => p.isOwned)
const sharedProjects = MOCK_PROJECTS.filter((p) => !p.isOwned)

return {
  // ... existing fields ...
  ownedProjects,
  sharedProjects,
}
```

Because `MOCK_PROJECTS` is a static constant (it never changes at runtime), these filters run once per render and are cheap — no `useMemo` is needed.

**Step 3 — Consume them from context in `project-sidebar.tsx` and remove the import of `MOCK_PROJECTS`:**

```tsx
// Before
import { MOCK_PROJECTS, type MockProject } from "@/hooks/use-project-dialogs"

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const { openCreate } = useProjectDialogsContext()
  const ownedProjects = MOCK_PROJECTS.filter((p) => p.isOwned)
  const sharedProjects = MOCK_PROJECTS.filter((p) => !p.isOwned)

// After
import type { MockProject } from "@/hooks/use-project-dialogs"

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const { openCreate, ownedProjects, sharedProjects } = useProjectDialogsContext()
```

`MockProject` is still imported as a type because `ProjectItem` uses it for its prop type — but it is now a type-only import (`import type`), which is more explicit: it tells TypeScript and the bundler this import has no runtime value.

### What Did Not Change

The JSX that renders `ownedProjects.map(...)` and `sharedProjects.map(...)` was untouched — the arrays have the same shape, just a different origin.

---

## Cross-Cutting Lessons

These three fixes share a common theme: **where should logic live?**

| Decision | Wrong place | Right place | Why |
|----------|-------------|-------------|-----|
| Clear timers on unmount | Nowhere | `useEffect` cleanup | React lifecycle is the contract for unmount side-effects |
| Path alias root | `./src/*` | `./*` | Alias must match the actual directory structure |
| Data filtering | UI component | Data hook | Hooks prepare data; components render it |

A useful mental checklist before writing code in a component:

- Is this about **layout or appearance**? → belongs in the component.
- Is this about **data shape, state, or lifecycle**? → belongs in a hook or utility.
- Is this a **configuration value** (path, token, constant)? → should match the real file system or design system, never be guessed.
