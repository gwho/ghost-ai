# Fix: RoomProvider Not Lifted — Workspace Page Crashes on Load

**Date:** 2026-06-08
**Feature affected:** 25 — Sidebar Chat Feed
**Files changed:** `components/editor/workspace-shell.tsx`, `components/editor/canvas-wrapper.tsx`

---

## What Broke

Every workspace page (`/editor/[roomId]`) crashed immediately on load with this error:

```
RoomProvider is missing from the React tree.
  at AISidebar (components/editor/ai-sidebar.tsx:35:21)
  at WorkspaceShell (components/editor/workspace-shell.tsx:153:9)
```

No canvas, no sidebar, no toolbar — a completely blank or error screen.

---

## Why It Broke

Liveblocks has two provider components that must be nested in order:

```
LiveblocksProvider   ← handles auth and the WebSocket connection
  └── RoomProvider   ← scopes everything to one specific room
        └── your component that uses Liveblocks hooks
```

Think of it like this:
- `LiveblocksProvider` is the key to the building — it sets up Liveblocks at all.
- `RoomProvider` is the key to a specific room on a specific floor — it tells Liveblocks *which* room your hooks should talk to.

If a component calls `useSelf()`, `useFeedMessages()`, or any other room hook without `RoomProvider` above it in the tree, Liveblocks throws an error because it doesn't know which room to connect to.

**Feature 25 moved `LiveblocksProvider` up to `workspace-shell.tsx` so both the canvas and sidebar could share the same Liveblocks connection. But `RoomProvider` was accidentally left inside `CanvasWrapper`.**

The component tree ended up like this:

```
LiveblocksProvider              ← in workspace-shell.tsx ✓
  ├── CanvasWrapper
  │     └── RoomProvider        ← still here, inside canvas only ❌
  │           └── CanvasFlow
  └── AISidebar                 ← calls useSelf(), but no RoomProvider above it ❌
```

`AISidebar` is a *sibling* of `CanvasWrapper` — it sits next to it, not inside it. So it never had access to the `RoomProvider` that `CanvasWrapper` owns. When `AISidebar` tried to call `useSelf()` on line 35, React looked up the tree, found no `RoomProvider`, and threw.

---

## The Fix

Move `RoomProvider` out of `CanvasWrapper` and up into `WorkspaceShell`, wrapping both the canvas and the sidebar:

```
LiveblocksProvider              ← workspace-shell.tsx
  └── RoomProvider              ← also workspace-shell.tsx now ✓
        ├── CanvasWrapper
        │     └── CanvasFlow
        └── AISidebar           ← now inside RoomProvider ✓
```

### `workspace-shell.tsx` changes

1. Added `RoomProvider` and `ClientSideSuspense` to the import from `@liveblocks/react`.
2. Wrapped the inner workspace with `<RoomProvider id={project.id} initialPresence={{ cursor: null, thinking: false }}>` — the same `id` and `initialPresence` that were previously in `canvas-wrapper.tsx`.
3. Wrapped `<AISidebar>` with `<ClientSideSuspense fallback={null}>` — Liveblocks hooks can *suspend* (pause rendering) while waiting for the room connection. Without a Suspense boundary, the sidebar would throw a different error. `fallback={null}` means nothing renders until the connection is ready (the sidebar slides in afterward anyway).

### `canvas-wrapper.tsx` changes

1. Removed `RoomProvider` from imports — it's no longer needed here.
2. Removed the `<RoomProvider>` wrapper from JSX.
3. Kept `ClientSideSuspense` in place — it still renders the "Connecting…" fallback while the canvas loads.
4. Kept the `roomId` prop — `CanvasFlow` still needs it as `projectId` for API calls.

---

## The Reusable Lesson

**Sibling components do not share a provider's context.**

Providers in React create a context that flows *down* the tree to descendants. A sibling component — one rendered at the same level, not nested inside — gets nothing from that provider.

If two components both need access to the same context (like a Liveblocks room), their shared provider must be placed *above both of them* in the tree, not inside one of them.

A quick test: if you ever see `useFoo() must be called inside a FooProvider`, find where `FooProvider` is in the tree and ask: is the component calling `useFoo()` a *descendant* of it, or just a *sibling*? If it's a sibling, the fix is always to move the provider up.
