# Spec Explanation: Feature 19 — Presence Avatars & Live Cursors

## What This Feature Does (Plain English)

When multiple people are in the same project room at the same time, this feature makes them visible to each other in two ways:

1. **Avatar stack** — A small group of profile photo circles appears in the top-right corner of the canvas. Each circle represents a collaborator currently in the room. Your own profile photo is shown separately via your Clerk account button; you don't appear in the collaborator stack.
2. **Live cursors** — As each collaborator moves their mouse around the canvas, a small colored arrow cursor appears on everyone else's screen at the same position, with the collaborator's name attached. This is how tools like Figma and Miro show who is where.

---

## Why This Matters

Without this feature, the canvas is a ghost town. You can see changes happening (nodes appearing, edges connecting) but you have no idea who is making them or where they are looking. Presence avatars and live cursors turn a shared canvas into a clearly collaborative space. Users instantly know who is in the room and can follow what others are doing.

---

## Key Concepts for Beginners

### What is "Presence" in Liveblocks?

Liveblocks is the real-time sync library this project uses for the shared canvas. Every user connected to a room has a **presence** object — a small blob of data that is visible to all other users in real time. Unlike the canvas storage (which holds nodes and edges that persist), presence data is ephemeral: it disappears when the user leaves the room.

Our presence object has two fields:

```ts
Presence: {
  cursor: { x: number; y: number } | null;
  thinking: boolean;
}
```

- `cursor` — the user's current mouse position in canvas coordinates, or `null` when the mouse is outside the canvas
- `thinking` — reserved for the AI copilot (when it's "thinking", the user's cursor pulses)

**`thinking` replaces the old `isThinking` field.** The rename happened in this feature to match the spec. The field wasn't being read by any component yet, so the rename was safe.

### What is `useOthers()`?

`useOthers()` is a Liveblocks hook that returns an array of all users currently in the room *except yourself*. Each entry has:
- `connectionId` — a unique number for this connection (used as React key)
- `id` — the user's Clerk user ID
- `info` — the `UserMeta` set when the Liveblocks auth token was issued: `{ name, avatar, color }`
- `presence` — the user's current presence object (including `cursor`)

### What is `useUpdateMyPresence()`?

`useUpdateMyPresence()` returns a function you call to update your own presence. It merges a partial update — you only need to provide the fields you want to change:

```ts
const updateMyPresence = useUpdateMyPresence()
updateMyPresence({ cursor: { x: 100, y: 200 } })  // update cursor only
updateMyPresence({ cursor: null })                  // clear cursor
```

Liveblocks broadcasts the update to all other users in the room instantly.

### Canvas Coordinates vs Screen Coordinates

React Flow has two coordinate systems:

- **Screen/viewport coordinates** — pixel positions relative to the top-left of the browser window (`e.clientX`, `e.clientY`)
- **Flow/canvas coordinates** — positions within the infinite React Flow canvas, accounting for pan and zoom

If you store screen coordinates in presence, the cursor positions would be wrong for any user who has panned or zoomed to a different part of the canvas. To fix this:

- **Storing**: convert screen → flow with `screenToFlowPosition({ x: e.clientX, y: e.clientY })` before writing to presence
- **Rendering**: convert flow → screen with `flowToScreenPosition(cursor)` before positioning the cursor element, then subtract the canvas container's bounding rect to get a local pixel position

This way, if Alice zooms in while Bob pans left, they both still see each other's cursors at the correct canvas position.

---

## Component Breakdown

### `presence-avatars.tsx`

**What it does:** Renders the collaborator avatar group and Clerk UserButton in the canvas top-right.

**Key logic:**

```tsx
const collaborators = others.filter((other) => other.id !== user?.id)
const visible = collaborators.slice(0, 5)
const overflow = Math.max(0, collaborators.length - 5)
```

- `useOthers()` already excludes the current user. The `other.id !== user?.id` check is a safety guard.
- Up to 5 avatars are shown with `-space-x-2` (negative margin) to create the overlapping stack effect.
- When there are more than 5, an overflow chip `+N` appears.
- The divider (`<div className="w-px h-5 ...">`) only renders when `collaborators.length > 0`. No divider = no visual clutter when you're alone.

**Avatar fallback:**

```tsx
{avatar ? (
  <img src={avatar} alt={name} className="w-full h-full object-cover" />
) : (
  initials
)}
```

If the Liveblocks user info includes a profile photo URL, it's shown. Otherwise, up to 2 initials are extracted from the name.

**`ring-2 ring-base`** on each avatar gives a thin dark ring around each circle. This separates overlapping avatars visually on the dark canvas background.

**Positioned at `top-14 right-3 z-10`** — 56px from the top of the canvas container. The workspace toolbar is 48px (`h-12`) tall and floats at `z-20`, so `top-14` places avatars just below the toolbar edge, and `z-10` keeps them behind it.

---

### `live-cursors.tsx`

**What it does:** Renders a colored pointer + name badge for every other user whose cursor is non-null.

**Key logic:**

```tsx
const overlayRef = useRef<HTMLDivElement>(null)

// inside the map:
const screenPos = flowToScreenPosition(other.presence.cursor)
const rect = overlayRef.current?.getBoundingClientRect()
const x = screenPos.x - rect.left
const y = screenPos.y - rect.top
```

1. The overlay div is `absolute inset-0 pointer-events-none overflow-hidden z-40` — it fills the canvas area without blocking mouse events.
2. `flowToScreenPosition` converts the stored canvas-space coordinate to a browser viewport coordinate.
3. Subtracting the overlay's `getBoundingClientRect()` converts viewport coordinates to local coordinates within the overlay.
4. Each cursor is rendered as an SVG pointer (stroke outline for visibility on any background) plus a pill badge with the participant's name, both colored with `other.info.color`.

**Why `pointer-events-none` everywhere?** Cursor elements should never intercept clicks or hover events — they're purely decorative overlays.

---

### Canvas-flow.tsx changes

**Cursor broadcasting:**

```tsx
const updateMyPresence = useUpdateMyPresence()

const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  updateMyPresence({ cursor: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
}, [updateMyPresence, screenToFlowPosition])

const onMouseLeave = useCallback(() => {
  updateMyPresence({ cursor: null })
}, [updateMyPresence])
```

`onMouseMove` and `onMouseLeave` are added to the outer wrapper `<div>` (not just ReactFlow's internal component) to ensure reliable event coverage across the full canvas area.

**Component placement in the render tree:**

```tsx
<div className="w-full h-full relative" onMouseMove={...} onMouseLeave={...} ...>
  <ReactFlow ...>
    <Background />
    <MiniMap />
  </ReactFlow>
  <LiveCursors />          {/* fills inset-0, z-40 */}
  <CanvasControls ... />   {/* bottom-left pill */}
  <ShapePanel ... />       {/* bottom-center pill */}
  <PresenceAvatars />      {/* top-right, z-10 */}
  <StarterTemplatesModal />
</div>
```

`LiveCursors` is rendered directly after `<ReactFlow>` to ensure it sits above the canvas but below the controls and modal.

---

## Data Flow Diagram

```
User moves mouse
  → onMouseMove fires on canvas wrapper div
  → screenToFlowPosition(clientX, clientY) → flow coords {x, y}
  → updateMyPresence({ cursor: {x, y} })
  → Liveblocks broadcasts to all room members

Other user receives presence update
  → useOthers() re-renders LiveCursors
  → flowToScreenPosition(cursor) → viewport coords
  → subtract container bounding rect → local pixel position
  → cursor div rendered at (x, y) with other.info.color and name

User leaves canvas
  → onMouseLeave fires
  → updateMyPresence({ cursor: null })
  → other users' LiveCursors removes that cursor from the DOM
```

---

## Scope Decisions

| What | Decision | Why |
|---|---|---|
| Presence avatars in navbar | ❌ Not added | Spec explicitly excludes this |
| Collaborator avatars interactive | ❌ Display-only | Spec scope limit |
| Current user shown in collaborator stack | ❌ Excluded | Rendered by Clerk UserButton instead |
| Cursor for current user | ❌ Not rendered | `useOthers()` already excludes self |
| Canvas node/edge behavior | ❌ Unchanged | Out of scope |

---

## AI Discussion Topics

### 1. Why store canvas coordinates instead of screen coordinates in presence?

If you stored screen coordinates, every user would need to be looking at exactly the same part of the canvas at the same zoom level for cursors to line up. By storing canvas (flow) coordinates, each client independently converts the stored position to their own viewport using their current pan and zoom — so cursors always appear at the semantically correct place regardless of each user's viewport state. This is the standard pattern in all collaborative canvas tools (Figma, Miro, Excalidraw).

### 2. What is the `useOthers()` re-render cost?

`useOthers()` subscribes to all presence updates from all room members. Every mouse move by any collaborator triggers a presence update, which causes every subscriber to re-render. In practice, Liveblocks throttles cursor updates. But for a room with many active collaborators, `useOthers()` with no selector can be expensive.

**Optimisation:** Pass a selector to `useOthers()`:
```ts
const cursors = useOthers((others) =>
  others.map(({ connectionId, info, presence }) => ({
    connectionId,
    info,
    cursor: presence.cursor,
  }))
)
```
This memoizes the derived array and only re-renders when the selected values actually change. For this project's current scale (small teams), the full `useOthers()` is fine, but this is the first optimisation to reach for if cursor rendering causes frame drops.

### 3. Why does `flowToScreenPosition` need a bounding rect subtraction?

`flowToScreenPosition` returns coordinates in the browser viewport — absolute pixel positions from the top-left corner of the browser window. But our cursor overlay is a `position: absolute` div nested inside the canvas container. Absolutely positioned elements use their nearest positioned ancestor as the reference point, not the viewport. Subtracting `getBoundingClientRect().left` and `.top` converts viewport coordinates into coordinates relative to the overlay div — which is what CSS `left` and `top` actually need for correct positioning.

### 4. Presence vs Storage: what's the difference in Liveblocks?

**Storage** is the persistent, conflict-free data layer. For this project, nodes and edges live in Storage via `useLiveblocksFlow`. It survives disconnections and reconnections — you can refresh the page and the canvas is still there.

**Presence** is ephemeral per-connection data. It's broadcast to all current room members but not persisted. When you close the tab, your presence disappears. Cursor positions and "thinking" state are perfect presence candidates because they're meaningless outside of an active session.

### 5. What happens if `overlayRef.current` is null when rendering cursors?

This can happen on the first render pass before the overlay `<div>` has been committed to the DOM. The guard `if (!rect) return null` silently skips cursor rendering for that frame. On the next render (triggered by the next Liveblocks presence update), the ref will be populated and cursors will render correctly. This is a one-frame flash suppression that prevents an error without any visible impact.

### 6. Why is `thinking` a presence field rather than a storage field?

The "thinking" indicator is meant to show in real time whether the AI copilot is actively processing for a user. This state is:
- Per-user (different users can have different AI states at the same time)
- Ephemeral (irrelevant after the session ends)
- Low-stakes (missing or stale values cause no data corruption)

All three of these properties make presence the right place for it. If it were in Storage, every AI processing toggle would add to the undo history and be persisted permanently — both of which are wrong for this use case.

### 7. The `ring-2 ring-base` technique for stacked avatars

When avatars overlap with `-space-x-2`, the edges blur together. Adding a thin ring in the background color (`ring-base` = `#080809`) creates a visible gap between each circle without actually spacing them apart. This is a common CSS trick used by GitHub, Linear, Notion, and Loom for their collaborator avatar stacks. The ring color must match the surface behind the avatars — if avatars are rendered on a lighter background, `ring-surface` would be the right choice instead.
