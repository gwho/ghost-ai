# Feature 25 — Sidebar Chat Feed: Spec Explanation

## What This Feature Does

Before this feature, the AI sidebar showed only AI-generated status messages ("AI is thinking…", "Design complete…"). Collaborators in the same room had no way to talk to each other.

After this feature, anyone in the room can type a message in the sidebar and it appears in real time for all participants. Messages persist — if you refresh or join late, you see the full history. This is implemented using the Liveblocks Feed API, which stores messages on Liveblocks servers and delivers them over WebSockets.

---

## Key Concept: React Context and Provider Trees

React Context is how data flows between components without being passed as props at every level. A `Provider` component wraps part of your component tree and makes its data available to all children — no matter how deep.

```
Grandparent
└── Parent (has no idea about the data)
    └── Child (can still access the data from Grandparent's Provider)
```

The critical insight in this feature: **context flows DOWN, not sideways.** Two sibling components cannot share a context unless their common parent provides it.

Before this feature, `LiveblocksProvider` was inside `CanvasWrapper`. The sidebar was a sibling of `CanvasWrapper` — not a child. It couldn't access Liveblocks hooks at all. By moving `LiveblocksProvider` up one level to `WorkspaceShell`, both components become children of the same provider.

---

## Key Concept: Feeds vs. Broadcast Events

Liveblocks gives you two ways to communicate in real time:

**`broadcastEvent`** — fire-and-forget. Sends a signal to everyone currently connected. If you're not listening at that exact moment, you miss it. Used in this project for AI progress signals ("Gemini is reading your prompt…").

**Feed API (`useFeedMessages`, `useCreateFeedMessage`)** — persistent records. Messages are stored on Liveblocks servers with a unique ID, a server timestamp, and the data you provide. Anyone subscribing — now or later — gets the full message history. The right tool for chat.

The difference is like SMS vs. a group chat channel. If you text someone who has their phone off, they miss it (broadcast). If you post in a Slack channel, they see it when they come back (feed).

---

## Key Concept: `FeedMessageData` in `liveblocks.config.ts`

Liveblocks lets you declare the TypeScript shape of your data in a global `interface Liveblocks {}` declaration. This is called "declaration merging" — you're adding fields to an interface that Liveblocks defined in its package.

Adding `FeedMessageData` tells TypeScript: "every message in any feed has these fields." Without it, `message.data` would be `Record<string, unknown>` — untyped JSON that you'd have to cast manually everywhere.

```ts
// liveblocks.config.ts
FeedMessageData: {
  sender: string
  role: 'user'
  content: string
  timestamp: number
}
```

Now `useFeedMessages("ai-chat")` returns messages typed with this shape automatically.

---

## Key Concept: Zod Validation Before Rendering

Even though WE wrote the messages, we still validate them before rendering. Why?

1. **Schema drift**: If we ever change the message shape in future code, old messages in the feed won't match the new schema. Validation lets us skip them gracefully.
2. **Corrupt writes**: Network errors or bugs can produce partial writes.
3. **Defense in depth**: Never trust data from external systems — even your own past writes.

`validateAiChatMessage` uses Zod's `safeParse`, which returns `{ success: true, data }` or `{ success: false, error }` instead of throwing. Components can filter out invalid messages with `.filter()` without any try/catch.

---

## How `useSelf()` Gets the Sender Name

When a user joins a room, Liveblocks stores their metadata (name, avatar, color) from the auth token. `useSelf()` returns that metadata for the current user. In `ai-sidebar.tsx`:

```ts
const me = useSelf()
// me.info.name → "Jesse James" (from Clerk via the auth endpoint)
```

This means the sender name in each chat message is exactly the name from Clerk identity — no extra state needed.

---

## The Full Data Flow

```
1. User types in the sidebar textarea
2. Presses Enter or clicks Send
3. submit() calls createFeedMessage("ai-chat", { sender, role, content, timestamp })
4. Liveblocks writes the message to its servers
5. useFeedMessages("ai-chat") in all connected sidebars gets updated via WebSocket
6. Each message is passed through validateAiChatMessage()
7. Valid messages render; own messages right-aligned, others left-aligned
8. Timestamp shown below each bubble
```

If `createFeedMessage` throws (e.g., network down), `sendError` state is set and a small error chip appears below the input. The input is NOT cleared so the user can retry.

---

## Files Involved

- [liveblocks.config.ts](../../liveblocks.config.ts) — `FeedMessageData` type declaration
- [types/tasks.ts](../../types/tasks.ts) — `AiChatMessage` Zod schema + validator
- [components/editor/workspace-shell.tsx](../../components/editor/workspace-shell.tsx) — `LiveblocksProvider` now lives here
- [components/editor/canvas-wrapper.tsx](../../components/editor/canvas-wrapper.tsx) — `RoomProvider` only; no more `LiveblocksProvider`
- [components/editor/ai-sidebar.tsx](../../components/editor/ai-sidebar.tsx) — uses `useFeedMessages`, `useCreateFeedMessage`, `useSelf`
