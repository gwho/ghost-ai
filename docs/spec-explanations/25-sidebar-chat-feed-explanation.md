# Feature 25 — Sidebar Chat Feed

## What This Feature Does

Feature 25 adds a real-time chat feed to the AI sidebar. When multiple collaborators are in the same workspace, they can type messages and see each other's messages appear instantly — no page refresh needed.

This is powered by **Liveblocks Feeds**, a Liveblocks primitive designed for ordered, persistent message lists scoped to a room. Chat messages are stored by Liveblocks (not in your database) and survive page refreshes. A collaborator who joins late will see the full message history.

---

## Key Files

| File | Role |
|---|---|
| `liveblocks.config.ts` | Declares the `FeedMessageData` type so TypeScript knows the shape of chat messages |
| `types/tasks.ts` | Defines `AiChatMessageSchema` (Zod) + `validateAiChatMessage` — validates messages before rendering |
| `components/editor/ai-sidebar.tsx` | Subscribes to the feed, renders messages, handles sending |
| `components/editor/workspace-shell.tsx` | Provides `RoomProvider` so sidebar hooks have access to the room |

---

## How Liveblocks Feeds Work

A **Liveblocks Feed** is a named list of messages tied to a room. You identify it by a string ID (`"ai-chat"` in this case). Think of it like a chat channel inside the room.

Three hooks power the feed in `ai-sidebar.tsx`:

### `useCreateFeed(feedId)`
Creates the feed if it doesn't already exist. Called once on mount via `useEffect`. If the feed exists, the error is silently swallowed — this is intentional.

```ts
useEffect(() => {
  createFeed(CHAT_FEED_ID).catch(() => {
    // Feed already exists — fine
  })
}, [])
```

### `useFeedMessages(feedId)`
Subscribes to the feed and returns `{ messages }`. The messages array updates in real time — when any collaborator sends a message, everyone's `messages` array updates without a reload.

### `useCreateFeedMessage()`
Returns a function that appends a new message to the feed. Calling it broadcasts the message to all subscribers immediately.

```ts
await createFeedMessage(CHAT_FEED_ID, {
  sender: me?.info.name ?? 'Unknown',
  role: 'user',
  content: trimmed,
  timestamp: Date.now(),
})
```

### `useSelf()`
Returns the current user's Liveblocks presence data — name, avatar, and color. Used here to get the sender's display name and to determine whether a message bubble is "mine" (shown on the right) or someone else's (shown on the left).

---

## Message Validation

Raw feed messages are untyped — Liveblocks doesn't know the shape of `data`. Before rendering, each message passes through `validateAiChatMessage()` defined in `types/tasks.ts`.

This function uses a **Zod schema** to check that `sender`, `role`, `content`, and `timestamp` are all present and have the right types. Messages that fail validation are filtered out before render. This protects against stale or malformed data in the feed from ever reaching the UI.

```ts
const messages = (rawMessages ?? [])
  .map((m) => ({ id: m.id, data: validateAiChatMessage(m.data) }))
  .filter((m): m is { id: string; data: NonNullable<...> } => m.data !== null)
```

---

## Provider Hierarchy (Why This Matters)

Liveblocks hooks need two providers above them in the React tree:

```
LiveblocksProvider   ← Liveblocks credentials + WebSocket connection
  └── RoomProvider   ← Scopes hooks to a specific room
        └── component using feed hooks
```

Feature 25 originally moved `LiveblocksProvider` up but accidentally left `RoomProvider` inside `CanvasWrapper`. The sidebar (`AISidebar`) is a *sibling* of `CanvasWrapper`, not a child — so it had no `RoomProvider` above it and crashed.

The follow-up fix (2026-06-08) moved `RoomProvider` up to `workspace-shell.tsx`, wrapping both the canvas and sidebar. Now the tree is:

```
LiveblocksProvider      (workspace-shell.tsx)
  └── RoomProvider      (workspace-shell.tsx)
        ├── CanvasWrapper → CanvasFlow
        └── AISidebar
```

---

## Separation from AI Status Feed

Feature 24 introduced a separate `ai-status-feed` (or `broadcastEvent` on the room) for AI progress updates — the "AI is generating nodes…" status chips. Feature 25's `ai-chat` feed is **not the same thing**. They serve different purposes:

- `ai-chat` — user-to-user chat, persisted, visible to late joiners
- AI status broadcasts — ephemeral events fired by the design agent task, only received while connected

The two are never mixed. Status messages flow through `onAiStatus` props, while chat messages flow through the Liveblocks feed subscription.

---

## Suspense Boundaries

Liveblocks hooks *suspend* — they pause rendering while waiting for the room connection. This is a React feature: a component can tell React "I'm not ready yet, show a fallback." Without a `<Suspense>` boundary (or `<ClientSideSuspense>` which is Liveblocks's wrapper), the entire tree above the suspending component would crash.

- `CanvasWrapper` has its own `<ClientSideSuspense>` showing "Connecting…" while the canvas loads.
- `AISidebar` is wrapped in a `<ClientSideSuspense fallback={null}>` in `workspace-shell.tsx` — while the sidebar suspends, nothing renders (the container div still exists, so the slide-in transition still works once it resolves).
