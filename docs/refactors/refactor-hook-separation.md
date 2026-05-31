# Refactor: Splitting `use-project-actions` into Focused Hooks

## Summary

| What | Before | After |
|---|---|---|
| Dialog UI state | `use-project-actions.ts` (monolith) | `use-project-dialogues.ts` |
| Project mutations (API calls) | `use-project-actions.ts` (monolith) | `use-project-actions.ts` (trimmed) |
| Share / clipboard / collaborators | `share-dialog.tsx` (inline) | `use-project-share.ts` |
| Context wiring | single hook call | two hooks composed in provider |

No consumer components changed — the context API surface is identical.

---

## The Problem

`hooks/use-project-actions.ts` was doing three unrelated things at once:

1. **Dialog UI state** — which dialog is open, the form text, the live slug preview, whether the submit button is spinning
2. **Project mutations** — calling `/api/projects` to create/rename/delete, navigating after success
3. *(implicitly)* **Share dialog logic** — living inline in `share-dialog.tsx`: clipboard copy, collaborator fetching, invite, remove

Mixing these made each domain harder to read, extend, or reason about independently.

---

## What Changed and Why

### Before: `hooks/use-project-actions.ts` (172 lines — everything in one place)

```ts
// BEFORE — Dialog state, slug helpers, AND API calls all in one hook
export function useProjectActions(initialOwned, initialShared) {
  // dialog state
  const [open, setOpen] = useState<DialogType>(null)
  const [createName, setCreateNameState] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // ...

  // slug helpers
  function toSlug(name) { ... }
  function randomSuffix() { ... }

  // API calls
  const handleCreate = async () => { await fetch("/api/projects", ...) }
  const handleRename = async () => { await fetch(`/api/projects/${id}`, ...) }
  const handleDelete = async () => { await fetch(`/api/projects/${id}`, ...) }

  return { open, createName, createSlug, isLoading, handleCreate, handleRename, handleDelete, ... }
}
```

### After: Three focused hooks

**`hooks/use-project-dialogues.ts`** — owns all dialog UI state

```ts
// AFTER — Only dialog form state and open/close logic
export function useProjectDialogues(): ProjectDialoguesValue {
  const [open, setOpen] = useState<DialogType>(null)
  const [createName, setCreateNameState] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // ...
  return { open, createName, createSlug, isLoading, openCreate, closeDialog, setCreateName, ... }
}
```

**`hooks/use-project-actions.ts`** — only API mutations, receives dialogue state as a parameter

```ts
// AFTER — Only API calls and project list state; reads dialog values from dialogues param
export function useProjectActions(
  initialOwned: ProjectItem[],
  initialShared: ProjectItem[],
  dialogues: ProjectDialoguesValue  // ← key: reads createName, targetProject, closeDialog, setIsLoading
): ProjectActionsValue {
  const handleCreate = async () => {
    if (!createName.trim()) return
    setIsLoading(true)     // calls setIsLoading from dialogues
    const res = await fetch("/api/projects", ...)
    closeDialog()          // calls closeDialog from dialogues
    router.push(...)
  }
  return { ownedProjects, sharedProjects, handleCreate, handleRename, handleDelete }
}
```

**`hooks/use-project-share.ts`** — clipboard and collaborator CRUD (extracted from `share-dialog.tsx`)

```ts
// AFTER — All share dialog logic in one place, nothing inline in the component
export function useProjectShare(projectId: string, open: boolean): ProjectShareValue {
  const [collaborators, setCollaborators] = useState([])
  const [isCopied, setIsCopied] = useState(false)
  // ...
  async function handleCopy() { ... }   // clipboard with textarea fallback
  async function handleInvite() { ... }
  async function handleRemove(collaboratorId) { ... }
  return { collaborators, isCopied, inviteEmail, handleCopy, handleInvite, handleRemove, ... }
}
```

---

## How the Context Stays the Same

The `ProjectDialogsProvider` now composes both hooks and spreads their values into a single context object — so every consumer (`project-dialogs.tsx`, `project-sidebar.tsx`, `editor-home-actions.tsx`) sees the exact same properties as before:

```ts
// components/editor/project-dialogs-context.tsx (updated)
const dialogues = useProjectDialogues()
const actions = useProjectActions(initialOwned, initialShared, dialogues)

<ProjectDialogsContext.Provider value={{ ...dialogues, ...actions }}>
```

The spread `{ ...dialogues, ...actions }` produces the same 17-field shape that consumers already destructure. No consumer file needed updating.

---

## Options Considered

### Option A: Extract hooks as peers, compose in the provider ✓ (chosen)
- Provider calls both hooks and spreads into context
- No consumer changes needed
- Clean ownership: dialogue state → dialogues hook; mutations → actions hook

### Option B: One giant hook that internally calls sub-hooks
- Adds an extra indirection layer with no benefit
- The monolith reappears at a different level

### Option C: Separate contexts for dialogue and actions
- Consumers would need two `useContext` calls
- Breaking change for all existing callers

---

## Beginner Mental Model: Separation of Concerns in React Hooks

**The core idea:** A custom hook is just a function. Like any function, it should do one thing. When a hook does three things, you have three responsibilities tangled together — a change to any one of them touches all three.

**Why this matters in React specifically:**

Hooks hold *state*. State causes re-renders. When state for unrelated concerns lives in the same hook, a change to one piece of state (e.g., typing in the create-dialog input) can inadvertently re-render code that manages API calls or project lists, even though those areas didn't change.

**The "single responsibility" test:** Read the hook name. If you can describe what the hook does without using the word "and", it passes. `useProjectDialogues` manages dialog state — no "and". The old `useProjectActions` managed dialog state *and* called APIs *and* maintained project lists — three "ands", three concerns.

**Passing state between hooks:** When one hook needs to react to state owned by another (e.g., `handleCreate` needs the `createName` the user typed), pass the first hook's return value as a parameter to the second:

```ts
const dialogues = useProjectDialogues()          // owns createName
const actions = useProjectActions(..., dialogues) // reads createName from dialogues
```

This is composition — the React equivalent of dependency injection. Each hook stays focused; the caller (the provider) is responsible for wiring them together.

**Where share logic lived before (inline in a component):** The clipboard and collaborator state sat directly inside `ShareDialog`. This meant the component was doing two jobs: rendering UI *and* managing data. The rule is the same — components should render, hooks should manage state and side effects.
