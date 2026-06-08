# Fix: Issue 1 — Save Button & Canvas Route

## What Was Broken

### Problem A — No Save Button

The workspace toolbar showed passive text labels ("Saving…", "Saved", "Save failed")
but had no clickable button. Users could not trigger a save on demand — only the
2-second debounced autosave ran automatically. Additionally, the autosave hook
(`useCanvasAutosave`) only returned `saveStatus`; it had no `save` function at all.

### Problem B — Canvas Blobs Were Public

The PUT handler stored canvas JSON in Vercel Blob with `access: 'public'`. Anyone
with the blob URL could read any project's canvas without logging in.

### Problem C — GET Handler Would Break on Private Blobs

The GET handler used `fetch(canvasJsonPath)` — a raw HTTP request with no auth
headers. This already worked because blobs were public, but would silently fail
(return garbage or an error) the moment blobs became private.

---

## What Was Changed

### `hooks/use-canvas-autosave.ts`

**Before:** hook ran the fetch inside an anonymous `setTimeout` callback and returned
only `{ saveStatus }`.

**After:** the fetch logic is extracted into a `save = useCallback(async () => {...},
[projectId])` function that is returned alongside `saveStatus`. The debounce effect
now calls `save` instead of inlining the fetch.

Two `useRef` values (`nodesRef`, `edgesRef`) shadow the `nodes` and `edges` props.
They are updated via `useEffect` on every render. The `save` callback reads from
these refs instead of closing over the prop values directly. This keeps `save` stable
(only re-created when `projectId` changes) so it is safe to include in dependency
arrays without causing infinite re-render loops.

### `components/editor/canvas-flow.tsx`

Added optional prop `onManualSaveReady?: (fn: () => Promise<void>) => void` to the
interface. Both the exported `CanvasFlow` wrapper and `CanvasFlowInner` accept and
thread it through.

Inside `CanvasFlowInner`, a `useEffect` calls `onManualSaveReady?.(save)` after the
`save` function is ready. Because `save` is stable (memoized by `useCallback`), this
effect fires once on mount and never again unless `projectId` changes.

### `components/editor/canvas-wrapper.tsx`

Added the same `onManualSaveReady` optional prop and passed it straight through to
`CanvasFlow`. No other logic changed.

### `components/editor/workspace-shell.tsx`

Three additions:

1. **`saveRef`** — a `useRef` that stores the `save` function once CanvasFlow
   provides it via `handleManualSaveReady`. A ref (not state) is used because storing
   the function does not need to trigger a re-render.

2. **`handleManualSave`** — `useCallback` that calls `saveRef.current?.()`. Passed
   as `onClick` to the Save button. The optional chain (`?.`) is a safety guard for
   the brief window between initial render and the CanvasFlow mount effect firing.

3. **Save button** — replaces the three conditional text spans. A single `<button>`
   reads its label from `saveStatus`:
   - `'idle'` → "Save"
   - `'saving'` → "Saving..." (button disabled)
   - `'saved'` → "Saved" (resets to idle after 3 s)
   - `'error'` → "Error" (resets to idle after 3 s)

The existing `useEffect` that reset `'saved'` to `'idle'` was updated to also reset
`'error'`. Previously, an error state would stick permanently until the next
canvas change triggered autosave.

### `app/api/projects/[projectId]/canvas/route.ts`

**PUT:** `access: 'public'` → `access: 'private'`. Canvas data is project-private
and must not be accessible without authentication.

**GET:** replaced:
```ts
const res = await fetch(canvasJsonPath)
```
with:
```ts
const result = await get(canvasJsonPath, { access: 'private' })
if (!result) return NextResponse.json({ nodes: [], edges: [] })
const data = await new Response(result.stream).json()
```

`get()` from `@vercel/blob` authenticates via the `BLOB_READ_WRITE_TOKEN` environment
variable automatically. It returns `null` when the blob is not found, or an object
with a `stream: ReadableStream` for the blob content. Wrapping the stream in
`new Response(result.stream).json()` is the idiomatic way to parse it on the server.

---

## The Reusable Lesson

### Lesson 1 — Stable callbacks with stale-closure protection

When you need a callback that:
- references frequently-changing values (nodes, edges)
- must remain stable (not re-created each render)
- needs to live in dependency arrays without causing infinite loops

…the pattern is: **shadow props with refs, close over refs in the callback**.

```ts
const nodesRef = useRef(nodes)
useEffect(() => { nodesRef.current = nodes }, [nodes])

const save = useCallback(async () => {
  // reads nodesRef.current — always fresh, but callback identity is stable
}, [projectId])  // only projectId in deps, not nodes
```

### Lesson 2 — Bubbling imperative handles upward

React data flows down (props) and events up (callbacks). But sometimes a parent
needs to call a function that lives inside a child (e.g., a save function inside a
canvas hook). The pattern used here:

```
Parent provides: onManualSaveReady(fn) callback
Child calls: onManualSaveReady(save) once on mount
Parent stores: saveRef.current = fn
Parent can later call: saveRef.current?.()
```

This avoids `useImperativeHandle` / `forwardRef` complexity for simple cases where
you just need one function from a deeply nested child.

### Lesson 3 — Private Vercel Blobs need the SDK on the server

Raw `fetch(blobUrl)` only works for public blobs. For private blobs, always use the
`@vercel/blob` SDK from server-side code — it automatically adds the auth token from
`BLOB_READ_WRITE_TOKEN`. Never store sensitive data as public blobs.

---

## AI Discussion Topics

**1. Why not `useImperativeHandle` here?**
`useImperativeHandle` + `forwardRef` is React's official mechanism for exposing
imperative APIs from child components. The ref-callback pattern used here sidesteps
it. When would you prefer `useImperativeHandle`, and when is the callback pattern
better? Consider: type safety, discoverability, component API surface, re-render
behavior.

**2. The stable-callback-with-refs trade-off**
Using refs to avoid listing values in `useCallback` deps means the linter
(`exhaustive-deps`) can't warn you if you forget to add something. How do you decide
when this trade-off is worth making? What invariants must hold for it to be safe?

**3. Debounce + manual save interaction**
When the user clicks Save while a debounced autosave is already queued, the
implementation cancels the pending timeout and saves immediately. What are the
failure modes of this design? Could there be a race condition between a manual save
completing and a subsequent autosave queued from a canvas change that happened while
the manual save was in-flight?

**4. Public vs. private blob storage**
Changing from public to private blobs is a one-way migration: existing public blobs
stay public until overwritten. How would you build a migration that ensures ALL
existing canvases are switched to private without downtime? Consider: background job,
on-demand re-upload on first access, or a database flag tracking which blobs have
been migrated.

**5. Save status as local vs. shared state**
Currently, `saveStatus` lives entirely in the client and resets after 3 s. If two
collaborators both click Save simultaneously, they each see their own save status.
What would it take to make save status a shared collaborative state? Is that
actually better UX, or does local save feedback feel more responsive?
