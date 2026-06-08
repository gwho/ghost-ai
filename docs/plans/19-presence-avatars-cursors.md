# Plan: Feature 19 — Presence Avatars & Live Cursors

## Goal

Show active room participants inside the editor canvas view — collaborator avatar stack, overflow chip, and live cursor overlays — without touching the editor home navbar.

---

## Scope

**In:**
- Rename `isThinking` → `thinking` in the Liveblocks presence type (spec requirement)
- `PresenceAvatars` component: avatar group in the canvas top-right, Clerk UserButton, divider
- `LiveCursors` component: colored pointer + name badge per other participant
- Cursor broadcast via `useUpdateMyPresence` on canvas `onMouseMove` / `onMouseLeave`

**Out:**
- No changes to the editor home navbar
- No interactivity on collaborator avatars
- No changes to canvas node/edge behavior

---

## Files Changed

| File | Change |
|---|---|
| `liveblocks.config.ts` | Rename `isThinking` → `thinking` |
| `components/editor/canvas-wrapper.tsx` | Update `initialPresence` field name |
| `components/editor/presence-avatars.tsx` | **New** — avatar stack + UserButton |
| `components/editor/live-cursors.tsx` | **New** — cursor overlay rendered in canvas space |
| `components/editor/canvas-flow.tsx` | Add `useUpdateMyPresence`, mouse handlers, render new components |

---

## Architecture Decisions

### 1. Presence type rename: `isThinking` → `thinking`

The existing field was named `isThinking` but the spec calls for `thinking`. Since no component was reading this field yet (only the type definition and `initialPresence` were set), the rename is zero-risk. Both `liveblocks.config.ts` and the `initialPresence` in `canvas-wrapper.tsx` are updated together.

### 2. PresenceAvatars lives inside CanvasFlowInner

The component calls `useOthers()` from `@liveblocks/react`, which requires being inside a `RoomProvider`. `CanvasFlowInner` is already inside `RoomProvider` (via `CanvasWrapper → RoomProvider → CanvasFlow → CanvasFlowInner`). Rendering there avoids prop-drilling presence data up to `WorkspaceShell` and keeps the Liveblocks surface area contained.

### 3. PresenceAvatars positioned at `top-14 right-3 z-10`

The workspace toolbar floats at `top-0 h-12 z-20` over the canvas. By positioning avatars at `top-14` (56px from canvas top), they sit just below the toolbar's bottom edge without overlapping. `z-10` keeps them below the toolbar's `z-20` so the toolbar always renders on top.

### 4. UserButton comes from Clerk, not Liveblocks

The spec is explicit: render the current user via Clerk's `UserButton`, not a second Liveblocks presence entry. `useOthers()` already excludes the local user, but an additional `other.id !== user?.id` guard is applied for safety. The divider between collaborator avatars and UserButton appears only when `collaborators.length > 0`.

### 5. Cursor coordinate system: flow-space storage, viewport-space rendering

When storing cursor position: `screenToFlowPosition({ x: e.clientX, y: e.clientY })` converts browser viewport coordinates to React Flow canvas coordinates. This means cursor positions survive pan and zoom — each viewer's client converts the stored flow-space coordinate back to their own screen using `flowToScreenPosition`. The overlay div uses `getBoundingClientRect()` to subtract the container offset and produce local absolute pixel positions.

### 6. LiveCursors manages its own overlay ref

Rather than passing a ref from CanvasFlowInner, `LiveCursors` renders a `pointer-events-none absolute inset-0` overlay div and holds its own `ref`. This makes the component self-contained and avoids prop coupling. The `inset-0` overlay div's bounding rect equals the canvas container's bounding rect, so the coordinate subtraction is equivalent.

### 7. LiveCursors and PresenceAvatars both require ReactFlowProvider + RoomProvider

`LiveCursors` calls `useReactFlow()` (needs `ReactFlowProvider`) and `useOthers()` (needs `RoomProvider`). Both are satisfied because the components render inside `CanvasFlowInner`, which is nested inside `ReactFlowProvider` (from `CanvasFlow`) and `RoomProvider` (from `CanvasWrapper`).

---

## Implementation Steps

1. **`liveblocks.config.ts`** — rename `isThinking` to `thinking` in the `Presence` interface.
2. **`canvas-wrapper.tsx`** — update `initialPresence={{ cursor: null, thinking: false }}`.
3. **`presence-avatars.tsx`** — create component:
   - `useOthers()` → filter by `other.id !== user?.id` → slice first 5 → compute overflow
   - `CollaboratorAvatar` sub-component: img with fallback to initials; `ring-2 ring-base` separator ring
   - Overflow chip: `+N` div with same ring treatment
   - Divider `<div className="w-px h-5 bg-surface-border" />` only when collaborators exist
   - `<UserButton />` always present
4. **`live-cursors.tsx`** — create component:
   - `useOthers()` + `useReactFlow().flowToScreenPosition`
   - Self-managed overlay ref (`absolute inset-0 pointer-events-none overflow-hidden`)
   - Per-other: skip if `presence.cursor` or `info` is null; compute local x/y; render SVG pointer + colored name badge
5. **`canvas-flow.tsx`** — add:
   - `useUpdateMyPresence` import
   - `onMouseMove`: `updateMyPresence({ cursor: screenToFlowPosition({ x, y }) })`
   - `onMouseLeave`: `updateMyPresence({ cursor: null })`
   - Add both handlers to the outer wrapper div
   - Render `<LiveCursors />` immediately after `<ReactFlow>`
   - Render `<PresenceAvatars />` after ShapePanel (inside same relative container)

---

## Check When Done

- [ ] `liveblocks.config.ts` has `thinking: boolean` (not `isThinking`)
- [ ] `canvas-wrapper.tsx` `initialPresence` uses `thinking`
- [ ] `PresenceAvatars` renders at `top-14 right-3` inside the canvas area
- [ ] Collaborator avatars filter out the current Clerk user
- [ ] Divider only appears when at least one collaborator is present
- [ ] Overflow chip shows when `collaborators.length > 5`
- [ ] `LiveCursors` renders colored SVG pointer + name badge per other participant
- [ ] Cursor position broadcasts on `onMouseMove`, clears on `onMouseLeave`
- [ ] Editor home navbar is unchanged
- [ ] `npm run build` passes
