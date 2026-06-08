# Plan: Feature 21 — Canvas Autosave

## Goal

Add durable persistence for the collaborative canvas. Canvas JSON is stored in Vercel Blob; the blob URL is stored on the Prisma project record. Autosave fires 2 s after any change. When a room is empty (no active collaboration), the saved canvas is restored on load.

---

## What Already Existed

- `canvasJsonPath String?` field on the `Project` model — no migration needed.
- `getProjectAccess()` auth helper in `lib/project-access.ts` — reused in both API routes.
- `useLiveblocksFlow` in `canvas-flow.tsx` — provides `nodes` and `edges` for autosave.
- `{ suspense: true }` on `useLiveblocksFlow` — guarantees room is fully synced before `CanvasFlowInner` renders, making an empty `nodes` array a reliable "room is empty" signal.

---

## New Files

### `app/api/projects/[projectId]/canvas/route.ts`

**GET** — member-only read:
1. `getProjectAccess(projectId)` → 401 if not a member.
2. Read `canvasJsonPath` from `access.project`.
3. If null → return `{ nodes: [], edges: [] }`.
4. `fetch(canvasJsonPath)` → return the JSON.

**PUT** — member-only write (all collaborators can trigger autosave):
1. `getProjectAccess(projectId)` → 401 if not a member.
2. Parse `{ nodes, edges }` from body.
3. `put('canvas/${projectId}.json', JSON.stringify({ nodes, edges }), { access: 'private', contentType: 'application/json', addRandomSuffix: false })`.
4. `prisma.project.update({ canvasJsonPath: blob.url })`.
5. Return `{ url }`.

### `hooks/use-canvas-autosave.ts`

```ts
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useCanvasAutosave(
  projectId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): { saveStatus: SaveStatus }
```

- `isFirstRender` ref skips the mount trigger (avoids re-uploading freshly loaded data).
- `debounceRef` — clears + reschedules a 2 s timeout on every `nodes`/`edges` change.
- `isMounted` ref — guards against state updates after unmount.

---

## Modified Files

### `canvas-flow.tsx`

New props on `CanvasFlowProps`:
- `projectId: string`
- `onSaveStatusChange: (status: SaveStatus) => void`

Added to `CanvasFlowInner`:
- `hasLoadedRef` + one-shot `useEffect([], [])` — on mount, if room is empty, fetches and loads saved canvas via `onNodesChange` / `onEdgesChange`.
- `useCanvasAutosave(projectId, nodes, edges)` — returns `saveStatus`.
- `useEffect` that calls `onSaveStatusChange(saveStatus)` whenever status changes.

### `canvas-wrapper.tsx`

Added `onSaveStatusChange: (status: SaveStatus) => void` prop; forwarded to `CanvasFlow` alongside the existing `roomId` (used as `projectId`).

### `workspace-shell.tsx`

- `saveStatus` state + `setSaveStatus` passed as `onSaveStatusChange` to `CanvasWrapper`.
- `useEffect` auto-resets `'saved'` → `'idle'` after 3 s.
- Status chip in toolbar: "Saving…" (`text-copy-muted`), "Saved" (`text-brand`), "Save failed" (`text-red-400`); hidden when `idle`.

---

## Prop Threading

```
WorkspaceShell
  └── CanvasWrapper (roomId, onSaveStatusChange)
        └── CanvasFlow (projectId=roomId, onSaveStatusChange)
              └── CanvasFlowInner (same)
                    ├── useCanvasAutosave → saveStatus
                    └── useEffect → onSaveStatusChange(saveStatus)
```

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] Add a node → wait 2 s → toolbar shows "Saved"
- [ ] Reload → node reappears (loaded from blob)
- [ ] Open project in second tab with active nodes → nodes present → load is skipped (no duplicate)
- [ ] Kill network → toolbar shows "Save failed"
- [ ] Prisma project record has `canvasJsonPath` set to a Vercel Blob URL
- [ ] Vercel Blob contains valid `canvas/{projectId}.json`
