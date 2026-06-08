# Feature 25 — Sidebar Chat Feed: Implementation Plan

## What We're Building

A dedicated **Chat** tab in the AI sidebar that lets everyone in a workspace room send and receive messages in real time. Messages persist across page refreshes and are visible to collaborators who join later.

This is separate from the "AI Architect" tab (which sends prompts to the AI design agent) and the "Specs" tab.

---

## The Problem We Found

Feature 25 was marked complete, but when testing the actual UI only two tabs were visible:

```
[ AI Architect ]  [ Specs ]
```

The expected design required three tabs:

```
[ AI Architect ]  [ Chat ]  [ Specs ]
```

The Liveblocks `ai-chat` feed was wired correctly (hooks, types, validation — all present), but the feed's message display and input were merged into the "AI Architect" tab. A collaborator looking for a chat area couldn't find it because there was no tab labeled "Chat."

Additionally, the existing `submit` function called **both** `createFeedMessage` (writes to the chat feed) **and** `onSubmit` (triggers the AI design agent). The spec explicitly says "don't trigger backend AI tasks" from the chat feed — those two actions were incorrectly conflated.

---

## Files Changed

### `components/editor/ai-sidebar.tsx` — only file modified

**1. New state**
```tsx
const [chatInput, setChatInput] = useState('')
const [chatSendError, setChatSendError] = useState<string | null>(null)
const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
const chatScrollRef = useRef<HTMLDivElement>(null)
```

**2. Split submit function**

Before (single function doing two things):
```tsx
const submit = async () => {
  await createFeedMessage(CHAT_FEED_ID, { ... })   // ← chat feed write
  onSubmit?.(trimmed)                               // ← AI trigger
}
```

After (two focused functions):
```tsx
// AI Architect tab — prompts the AI, no feed write
const submitAi = async () => {
  onSubmit?.(trimmed)
}

// Chat tab — writes to feed, no AI trigger
const submitChat = async () => {
  await createFeedMessage(CHAT_FEED_ID, { ... })
}
```

**3. Tab layout**

Changed `grid-cols-2` to `grid-cols-3` and added a Chat `TabsTrigger` + `TabsContent` between AI Architect and Specs.

**4. AI Architect tab** — simplified to AI prompting only
- Starter chips + description text remain
- Input area calls `submitAi`
- AI thinking status banner stays
- Feed message display removed (those go in Chat tab)

**5. Chat tab** — new
- Scrollable message list from `useFeedMessages('ai-chat')`
- Messages validated through `validateAiChatMessage` before render
- Own/other message bubbles (right/left aligned)
- Sender name + timestamp per bubble
- Empty state: MessageSquare icon, "No messages yet" description
- Input area calls `submitChat`
- Error chip shown on send failure

**6. Specs tab** — unchanged

---

## How the Liveblocks Feed Works Here

```
User types in Chat tab
  → submitChat()
    → createFeedMessage('ai-chat', { sender, role, content, timestamp })
      → Liveblocks broadcasts to all subscribers
        → useFeedMessages('ai-chat') updates for every user in the room
          → messages re-render in real time
```

All users in the same Liveblocks room share the same `ai-chat` feed. Messages are persisted — a user who joins after messages were sent will still see the full history.

---

## What Was Not Changed

- Provider tree (`LiveblocksProvider` + `RoomProvider` in `workspace-shell.tsx`) — already correct
- `liveblocks.config.ts` — `FeedMessageData` type already declared
- `types/tasks.ts` — `AiChatMessageSchema` + `validateAiChatMessage` already present
- Specs tab — unchanged

---

## Verification

1. `npm run build` — passes, zero TypeScript errors
2. Open the workspace — sidebar shows 3 tabs: AI Architect, Chat, Specs
3. Chat tab shows empty state (MessageSquare icon) with no messages
4. Type a message and press Enter — message appears in the list
5. Open in a second browser tab — message appears for the second user without refresh
6. AI Architect tab — shows only the starter chips and prompt input, no feed messages
