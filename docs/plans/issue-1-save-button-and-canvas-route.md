# Plan: Issue 1 — Save Button & Canvas Route Fix

## Problem Summary

Two separate problems make up Issue 1:

**A. Missing Save button in the workspace navbar**
The workspace toolbar (`WorkspaceShell`) already shows save state as passive text
("Saving…", "Saved", "Save failed"). But there is no clickable Save button. Users
cannot trigger a manual save. The autosave hook (`useCanvasAutosave`) also only
returns `saveStatus` — it exposes no imperative save function to call.

**B. Canvas API route bugs**
- PUT stores blobs with `access: 'public'` — should be `'private'` (canvas data
  belongs to the project owner, not the world).
- GET uses a raw `fetch(canvasJsonPath)` — this breaks as soon as blobs are private
  because a raw fetch has no auth credentials.

---

## Architecture Context

```
EditorLayout (app/editor/layout.tsx)
  └── EditorShell  ← renders EditorNavbar (h-14, fixed top-0)
        └── <main pt-14>
              └── WorkspaceShell  ← has its own floating toolbar (absolute top-0 inside main)
                    └── CanvasWrapper
                          └── CanvasFlow (ReactFlowProvider)
                                └── CanvasFlowInner
                                      └── useCanvasAutosave  ← save logic lives here
```

The save logic is at the bottom of the tree. WorkspaceShell (mid-tree) renders the
toolbar. The plan: bubble the save function up from the hook to the toolbar via a
callback chain, keeping prop flow explicit and testable.

---

## Implementation Steps

### Step 1 — Expose `save()` from `useCanvasAutosave`

**File:** `hooks/use-canvas-autosave.ts`

- Add `nodesRef` and `edgesRef` (`useRef`) that mirror the latest `nodes`/`edges`
  props via `useEffect`. This lets the `save` callback close over refs instead of
  state, so it never goes stale.
- Extract the fetch call into a `save = useCallback(async () => {...}, [projectId])`
  — stable identity, safe to put in dependency arrays.
- The existing debounce `useEffect` calls `save` instead of inlining the fetch.
- Return `{ saveStatus, save }`.

**Why refs for nodes/edges?**  
`useCallback` with `[projectId]` keeps `save` stable across renders. If we closed
over `nodes`/`edges` directly in the callback, we'd need them in the dep array,
which would recreate `save` on every canvas change and trigger the debounce effect
on every change — defeating the debounce.

### Step 2 — Thread `onManualSaveReady` up to WorkspaceShell

**Files:** `canvas-flow.tsx`, `canvas-wrapper.tsx`

- Add optional prop `onManualSaveReady?: (fn: () => Promise<void>) => void` to both
  component interfaces.
- In `CanvasFlowInner`, call `onManualSaveReady?.(save)` inside a `useEffect`
  after `save` is ready (stable after mount since projectId doesn't change).
- `CanvasWrapper` passes the prop straight through to `CanvasFlow`.

### Step 3 — Add Save button in WorkspaceShell toolbar

**File:** `components/editor/workspace-shell.tsx`

- Add `saveRef = useRef<(() => Promise<void>) | null>(null)`.
- `handleManualSaveReady = useCallback(fn => { saveRef.current = fn }, [])` —
  called once by CanvasFlow after mount.
- Replace the three passive text spans (`Saving…` / `Saved` / `Save failed`) with a
  single `<button>` that:
  - Reads label from `saveStatus`: idle→"Save", saving→"Saving...", saved→"Saved",
    error→"Error"
  - Is `disabled` while `saveStatus === 'saving'`
  - `onClick` calls `saveRef.current?.()`
- Fix the reset `useEffect` to also reset `'error'` state back to `'idle'` after
  3 s (currently only resets `'saved'`).

### Step 4 — Fix canvas API route

**File:** `app/api/projects/[projectId]/canvas/route.ts`

**PUT handler:** change `access: 'public'` → `access: 'private'`

**GET handler:** replace raw `fetch(canvasJsonPath)` with:
```ts
import { get } from '@vercel/blob'

const result = await get(canvasJsonPath, { access: 'private' })
if (!result) return NextResponse.json({ nodes: [], edges: [] })
const data = await new Response(result.stream).json()
return NextResponse.json(data)
```
`get()` uses the `BLOB_READ_WRITE_TOKEN` env var automatically to authenticate,
so private blobs are readable from server-side route handlers.

---

## What NOT to Change

- Do not modify `EditorNavbar` — that is Issue 7.
- Do not change canvas node/edge rendering.
- Do not modify editor home navbar layout.
- Do not break autosave debounce, presence, or collaboration logic.

---

## Risk Notes

- The `save` ref pattern means if someone calls the Save button before CanvasFlow
  mounts (impossible in practice — the button is inside WorkspaceShell which only
  renders after mount), it would silently no-op. That is safe.
- Changing blob access from public→private is a storage-level change. Existing
  project blobs stored under `canvas/{projectId}.json` will remain public until
  overwritten. First save after this change will store a private copy. This is
  acceptable because the GET handler always reads via the SDK.

---

## Files Changed

| File | Change |
|---|---|
| `hooks/use-canvas-autosave.ts` | expose `save`, add node/edge refs |
| `components/editor/canvas-flow.tsx` | add `onManualSaveReady` prop, call it |
| `components/editor/canvas-wrapper.tsx` | thread `onManualSaveReady` |
| `components/editor/workspace-shell.tsx` | capture save fn, Save button, fix error reset |
| `app/api/projects/[projectId]/canvas/route.ts` | private access, SDK GET |
