# Feature 25 — Sidebar Chat Feed: Implementation Plan

## What We're Building

Real-time collaborative chat in the AI sidebar using the Liveblocks Feed API. Room participants can send and receive persistent chat messages through the existing sidebar input, separate from AI progress status updates.

---

## Why We Changed Direction: Broadcast → Feed API

An earlier draft used `useBroadcastEvent` + `useEventListener` (same pattern as the `ai-status` feed). That was rejected for two reasons:

1. **Broadcast events are ephemeral.** Messages only reach users who are currently subscribed. A collaborator who joins mid-session sees nothing. Chat needs persistence — the Liveblocks Feed API stores messages server-side and delivers history to late joiners.

2. **The sidebar was outside the Liveblocks context tree.** `LiveblocksProvider` and `RoomProvider` were both inside `CanvasWrapper`. `AISidebar` is a sibling component in `WorkspaceShell` — outside that tree. The broadcast workaround required threading state and callbacks through 4 components. The Feed API fix was to move the providers up.

---

## The Key Architecture Change: Provider Lift

**Before:**
```
WorkspaceShell
├── CanvasWrapper
│   └── LiveblocksProvider       ← providers buried here
│       └── RoomProvider
│           └── CanvasFlow (has Liveblocks context)
└── AISidebar ← outside context, cannot use Liveblocks hooks
```

**After:**
```
WorkspaceShell
└── LiveblocksProvider            ← lifted to top
    ├── CanvasWrapper
    │   └── RoomProvider
    │       └── CanvasFlow (still has full context)
    └── AISidebar ← now inside context, can use feed hooks ✓
```

Moving `LiveblocksProvider` to `WorkspaceShell` costs nothing — it just changes which component is responsible for initializing the Liveblocks connection. Both the canvas and the sidebar share the same connection.

---

## Files Changed

| File | Change |
|------|--------|
| `liveblocks.config.ts` | Added `FeedMessageData` type for the `ai-chat` feed |
| `types/tasks.ts` | Added `AiChatMessageSchema` (Zod), `AiChatMessage` type, `validateAiChatMessage()` |
| `components/editor/canvas-wrapper.tsx` | Removed `LiveblocksProvider` (moved up); kept `RoomProvider` + error boundary |
| `components/editor/workspace-shell.tsx` | Added `LiveblocksProvider` wrapper; moved `authorizeLiveblocks` function here |
| `components/editor/ai-sidebar.tsx` | Uses `useFeedMessages`, `useCreateFeedMessage`, `useCreateFeed`, `useSelf` directly |

---

## How the Chat Feed Works

```
User types a message and hits Send
  → createFeedMessage("ai-chat", { sender, role, content, timestamp })
  → Liveblocks writes the message to server storage
  → All subscribers to useFeedMessages("ai-chat") get the update via WebSocket
  → Each subscriber validates the message data through validateAiChatMessage()
  → Valid messages render in the chat area; invalid ones are silently skipped
```

The feed ID `"ai-chat"` is a constant. It's created on sidebar mount via `useCreateFeed()` — if it already exists, the call is a no-op.

---

## What Stayed the Same

- The `ai-status` broadcast (`useBroadcastEvent` / `useEventListener` in `canvas-flow.tsx`) is untouched — AI progress chips still work.
- `onSubmit` prop on `AISidebar` still calls the design agent — sending a chat message also triggers AI (Features 23+25 coexist).
- All canvas features (presence, cursors, nodes, edges) are unaffected by the provider lift.
