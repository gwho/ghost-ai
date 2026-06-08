# Plan: Fix — RoomProvider Not Lifted (Feature 25 Follow-Up)

## Problem

Feature 25 (sidebar-chat-feed) was marked complete with the note: "`LiveblocksProvider` lifted from `canvas-wrapper.tsx` to `workspace-shell.tsx`…". In practice, **only `LiveblocksProvider` was lifted. `RoomProvider` was not.** It stayed inside `CanvasWrapper`.

`AISidebar` is a sibling component of `CanvasWrapper` — it lives next to the canvas in the tree, not inside it. When `AISidebar` called `useSelf()`, `useFeedMessages()`, `useCreateFeed()`, and `useCreateFeedMessage()`, React searched up the component tree for a `RoomProvider` ancestor and found none. Every workspace page crashed on load:

```
RoomProvider is missing from the React tree.
  at AISidebar (components/editor/ai-sidebar.tsx:35:21)
```

## Root Cause

The Liveblocks provider hierarchy is layered:

```
LiveblocksProvider   ← sets up the connection and auth
  └── RoomProvider   ← scopes all hooks to a specific room
        └── component that uses useSelf / useFeedMessages / etc.
```

`LiveblocksProvider` gives Liveblocks its credentials and auth endpoint. `RoomProvider` ties those credentials to a specific room ID. Any component that calls a room-scoped hook **must** be a descendant of `RoomProvider`, not just `LiveblocksProvider`.

After Feature 25, the tree was:

```
LiveblocksProvider
  ├── CanvasWrapper
  │     └── RoomProvider   ← room scope here
  │           └── CanvasFlow
  └── AISidebar            ← hooks used here, OUTSIDE RoomProvider ❌
```

## Fix

Move `RoomProvider` up one level so it wraps both `CanvasWrapper` and `AISidebar`:

```
LiveblocksProvider
  └── RoomProvider          ← room scope lifted here ✓
        ├── CanvasWrapper
        │     └── CanvasFlow
        └── AISidebar       ← now inside RoomProvider ✓
```

### Changes

**`workspace-shell.tsx`**
- Import `RoomProvider` and `ClientSideSuspense` from `@liveblocks/react`.
- Add `<RoomProvider id={project.id} initialPresence={{ cursor: null, thinking: false }}>` inside `<LiveblocksProvider>`, wrapping the workspace div.
- Wrap `<AISidebar>` with `<ClientSideSuspense fallback={null}>` — sidebar hooks suspend during room connection, so they need a Suspense boundary.

**`canvas-wrapper.tsx`**
- Remove `RoomProvider` from imports and from JSX.
- Keep `ClientSideSuspense` for the canvas "Connecting…" loading state.
- Keep the `roomId` prop — it's still forwarded to `CanvasFlow` as `projectId`.
