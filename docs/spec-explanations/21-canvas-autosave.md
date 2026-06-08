# Spec Explanation: Feature 21 — Canvas Autosave

## What This Feature Does

Before Feature 21, the canvas only existed in the Liveblocks room — a temporary in-memory space. If all users left the project and the room was cleaned up, any nodes and edges were gone.

Feature 21 adds two things:

1. **Autosave** — whenever nodes or edges change, the canvas is automatically saved to permanent storage after a 2-second pause. A small status indicator in the toolbar shows "Saving…", "Saved", or "Save failed".
2. **Load on open** — when you open a project editor and the canvas room is empty (no active collaborators), the last saved canvas is fetched and restored so your work is never lost.

---

## Why Two Storage Layers? (Prisma vs. Vercel Blob)

This project uses two storage systems that play different roles:

| Layer | What it stores | Why |
|---|---|---|
| **PostgreSQL (Prisma)** | Project metadata: name, owner, collaborators, blob URL | Small, structured, queryable |
| **Vercel Blob** | The actual canvas JSON (potentially large) | Designed for large file storage |

**The key insight:** Storing a large JSON document (100+ nodes, each with position/color/label data) directly in a database row is inefficient. Instead, the canvas JSON is stored as a file in Vercel Blob, and only the URL pointing to that file is stored in the database.

This is called the **reference pattern**: your database record holds a small reference (a URL string), not the large artifact itself.

Think of it like a library card catalog: the card tells you where the book is (shelf, row, number), but the book's content lives on the shelf, not on the card.

---

## How the Autosave Hook Works

The hook lives at `hooks/use-canvas-autosave.ts` and has this signature:

```ts
function useCanvasAutosave(
  projectId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): { saveStatus: SaveStatus }
```

### What is debouncing?

Without debouncing, every single canvas change (dragging a node pixel-by-pixel, typing each character of a label) would immediately trigger an API call. That could mean hundreds of network requests per second.

**Debouncing** means: "wait until things stop changing, then save once."

The implementation uses `setTimeout` + `clearTimeout`:

```ts
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current)  // cancel pending save

  debounceRef.current = setTimeout(async () => {
    // This only runs if 2 s passes with no new changes
    setSaveStatus('saving')
    const res = await fetch(`/api/projects/${projectId}/canvas`, {
      method: 'PUT',
      body: JSON.stringify({ nodes, edges }),
    })
    setSaveStatus(res.ok ? 'saved' : 'error')
  }, 2000)

  return () => clearTimeout(debounceRef.current)  // cleanup if component unmounts
}, [nodes, edges, projectId])
```

Every time `nodes` or `edges` changes:
1. The previous scheduled save is cancelled with `clearTimeout`.
2. A fresh 2-second timer is started.
3. Only when 2 s passes without another change does the save actually fire.

**Analogy:** Imagine an autocomplete search box. You don't search after every letter you type — you search after you pause. Same idea.

---

## Why Skip the First Render?

```ts
const isFirstRender = useRef(true)

useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false
    return  // skip — don't save data we just loaded
  }
  // ... debounce logic
}, [nodes, edges, projectId])
```

When `CanvasFlowInner` first mounts, the `nodes` and `edges` values initialize from the Liveblocks room. If we saved immediately, we'd be uploading data that was just restored — wasted work, and the status indicator would flash "Saving…" before the user has done anything.

The `isFirstRender` ref is the guard. A ref doesn't cause a re-render when it changes (unlike state), making it the right tool for a one-time skip flag.

**Why not `useState` for this?** `useState` causes a re-render on every update. Changing a ref is instant and invisible to React — exactly what we want for a skip-flag that only matters once.

---

## How Canvas Load-on-Mount Works

Inside `CanvasFlowInner`:

```ts
const hasLoadedRef = useRef(false)

useEffect(() => {
  if (hasLoadedRef.current) return   // already ran
  hasLoadedRef.current = true

  if (nodes.length > 0 || edges.length > 0) return  // room has data — skip

  fetch(`/api/projects/${projectId}/canvas`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.nodes?.length && !data?.edges?.length) return
      onNodesChange(data.nodes.map(n => ({ type: 'add', item: n })))
      onEdgesChange(data.edges.map(e => ({ type: 'add', item: e })))
    })
    .catch(() => {})
}, []) // empty deps — intentional, runs once on mount
```

### Why is `nodes.length === 0` a reliable "empty room" check?

`useLiveblocksFlow` is called with `{ suspense: true }`. This tells React to suspend (pause rendering) until the Liveblocks room is fully synced. By the time `CanvasFlowInner` renders at all, the room data is complete. So if `nodes.length === 0` on first render, the room is genuinely empty — not "still loading."

Without `suspense: true`, the room might appear empty while still loading, and we'd incorrectly overwrite active collaboration data.

### Why use an empty dependency array `[]`?

The load should happen exactly once — on mount, after the room is synced. An empty array `[]` means "run this effect once, on mount." The `hasLoadedRef` guard provides extra protection in React StrictMode, which runs effects twice in development.

---

## The Save Status Indicator

### State lifting

`saveStatus` is owned by `WorkspaceShell`, not by `CanvasFlowInner`. Why?

The toolbar is rendered by `WorkspaceShell`. The autosave logic runs deep inside `CanvasFlowInner`. The save status needs to travel from inside the canvas up to the toolbar.

The solution: `WorkspaceShell` creates a `saveStatus` state variable and passes a setter callback (`onSaveStatusChange`) down through the component tree. `CanvasFlowInner` calls `onSaveStatusChange(saveStatus)` whenever the status changes. This pattern is called **state lifting** — state lives in the closest ancestor that needs it.

```
WorkspaceShell (owns saveStatus, renders chip)
  └── CanvasWrapper
        └── CanvasFlow
              └── CanvasFlowInner (calls onSaveStatusChange)
```

### Auto-reset after 3 s

```ts
useEffect(() => {
  if (saveStatus !== 'saved') return
  const t = setTimeout(() => setSaveStatus('idle'), 3000)
  return () => clearTimeout(t)
}, [saveStatus])
```

After a successful save, the "Saved" chip would stay visible forever without this. The 3-second auto-reset removes it after the user has had a chance to notice it, keeping the toolbar clean.

---

## Prop Threading

`projectId` and `onSaveStatusChange` need to flow through three layers:

```
WorkspaceShell
  → CanvasWrapper (adds onSaveStatusChange prop)
      → CanvasFlow (adds projectId + onSaveStatusChange props)
          → CanvasFlowInner (uses both)
```

The `roomId` prop already existed on `CanvasWrapper` (it's the Liveblocks room ID, which equals the project ID). Inside `CanvasWrapper`, `roomId` is passed to `CanvasFlow` as `projectId` — same value, renamed to match the canvas's perspective.

---

## The API Routes

### GET `/api/projects/[projectId]/canvas`

```
1. Verify membership (getProjectAccess)
2. Read canvasJsonPath from Prisma project record
3. If null → return { nodes: [], edges: [] }
4. Fetch the blob URL → return the JSON
```

### PUT `/api/projects/[projectId]/canvas`

```
1. Verify membership (getProjectAccess)
2. Parse { nodes, edges } from request body
3. Upload JSON to Vercel Blob at canvas/{projectId}.json
   (addRandomSuffix: false → same URL every time, no orphan files)
4. Update project.canvasJsonPath in Prisma
5. Return { url }
```

**Why `addRandomSuffix: false`?** Vercel Blob normally appends a random string to filenames to avoid collisions. For canvas files, we always want to overwrite the previous version at the same path. Without this option, each save would create a new file and the old one would never be deleted — wasting storage.

---

## Token Quick Reference

| Class | CSS Variable | Value |
|---|---|---|
| `text-copy-muted` | `--text-muted` | `#808090` (dim gray) |
| `text-brand` | `--accent-primary` | `#00c8d4` (cyan) |
| `text-red-400` | Tailwind red | `#f87171` |
| `bg-surface` | `--bg-surface` | `#111114` |
| `border-surface-border` | `--border-default` | `#2a2a30` |

---

## AI Discussion Topics

### Storage and architecture
- Why is the blob URL stored in Prisma instead of directly in a Liveblocks storage field? What trade-offs does the Prisma + Blob split create?
- What is the "reference pattern"? Can you think of another place in everyday software where a system stores a reference to a file rather than the file itself?
- Why does the PUT route use `addRandomSuffix: false`? What would happen over time if suffixes were enabled — how many files would accumulate for a project that autosaves once per minute for a year?
- What is an idempotent operation? Why is re-uploading the same canvas JSON on load harmless, and why does idempotency matter for autosave systems?

### Hooks and React patterns
- What is debouncing? Explain what `clearTimeout` + `setTimeout` do on every effect trigger. Draw a timeline showing 5 fast changes followed by a 2-second pause.
- Why does `isFirstRender` skip the mount trigger? What would a user see on the screen if we removed that skip?
- What is `useRef` used for in the autosave hook vs. `useState`? Give the rule: "use a ref when ____, use state when ____."
- What is "state lifting"? Draw the component tree and mark where `saveStatus` lives and where it is consumed.
- What does an empty dependency array `[]` tell React about an effect? Why is it the right choice for a one-time load?

### Liveblocks and real-time collaboration
- Why is `{ suspense: true }` passed to `useLiveblocksFlow`, and why does that make the empty-room check (`nodes.length === 0`) reliable?
- What is the difference between `nodes.length === 0` immediately after component mount (without suspense) vs. after suspense resolves?
- If two collaborators are in the same room and both trigger autosave within 2 seconds of each other, what happens? Is there a race condition? Does it matter?
- The spec says: "if the room already has nodes or edges, skip the load entirely." Why is this critical for collaboration? What would go wrong if we loaded saved state on top of active collaboration?

### UI and UX
- Why does the save status reset to `'idle'` after 3 s? What UX problem does keeping "Saved" visible forever create?
- The status text is placed in the toolbar header, not on a dedicated "Save" button. What are the trade-offs of this placement vs. a dedicated Save button?
- How does `text-brand` (cyan) communicate success here? Why is color alone not enough for accessibility?
