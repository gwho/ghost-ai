# Feature 24 — AI Presence State: How It Works

## What this feature does

When Ghost AI starts generating a design, every collaborator in the room immediately sees it. The sidebar input locks, a spinner appears on your cursor badge, and a live status message updates in real time. This is all done without any actual AI generation in this feature — the plumbing was already there; we're just connecting it to the UI.

---

## The three moving parts

### 1. Presence — what Liveblocks already knows about you

Every person connected to a room has a **presence** object — a small blob of data Liveblocks syncs to every other participant in real time. In this project it's typed in `liveblocks.config.ts`:

```ts
Presence: {
  cursor: { x: number; y: number } | null
  thinking: boolean
}
```

The `thinking` field was already in the config. In `canvas-flow.tsx`, `useUpdateMyPresence` broadcasts your current `thinking` state to the room every time `isAiThinking` changes:

```ts
useEffect(() => {
  updateMyPresence({ thinking: isAiThinking ?? false })
}, [isAiThinking, updateMyPresence])
```

So when any participant triggers AI generation, their `thinking` presence field goes `true` and all other cursors in the room get notified automatically.

### 2. The ai-status-feed — broadcast events

While presence tells everyone *who* is thinking, status events tell everyone *what's happening*. The design-agent (in `trigger/design-agent.ts`) broadcasts events like this:

```ts
await liveblocks.broadcastEvent(roomId, {
  type: 'ai-status',
  message: 'Generating nodes…',
  status: 'processing',
})
```

On the client, `canvas-flow.tsx` listens with Liveblocks' `useEventListener` hook. This is the **ai-status-feed**: a logical channel of broadcast events flowing from the AI agent to every participant's browser. Before passing the event to the sidebar, we validate it:

```ts
useEventListener(({ event }) => {
  const payload = validateAiStatusPayload(event)  // runtime safety check
  if (!payload) return
  onAiStatus?.({ message: payload.message, status: payload.status })
  if (payload.status === 'complete' || payload.status === 'error') {
    onAiComplete?.()
  }
})
```

The validation lives in `types/tasks.ts` and is a simple type guard — no library needed. It checks that the event has the right shape before the UI ever tries to display it.

### 3. The UI layer — sidebar + cursors

**Sidebar (`ai-sidebar.tsx`):**

- Receives `isAiThinking` and `statusMessages` as props from `workspace-shell.tsx`
- When `isAiThinking` is true:
  - The textarea and send button become disabled
  - The send button shows a spinner and "Thinking…" label
  - A pulsing dot appears on the Bot icon in the header
  - The subtitle changes to "AI is thinking…"
- The latest status message (just the most recent one from the feed) appears as a chip above the input
- User messages still accumulate in the chat area normally — only status display changed

**Live cursors (`live-cursors.tsx`):**

- `other.presence.thinking` is already available on every collaborator's presence
- When it's true, a `Loader2` spinner is rendered inside their cursor name badge
- When false or absent, the badge just shows the name as before

---

## Data flow

```
design-agent.ts
  → broadcastEvent({ type: 'ai-status', status: 'processing', message: '...' })

canvas-flow.tsx (useEventListener)
  → validateAiStatusPayload(event)  ← types/tasks.ts
  → onAiStatus({ message, status })

workspace-shell.tsx
  → setAiMessages([...prev, message])  — keeps the latest in state
  → isAiThinking state tracks start/complete

ai-sidebar.tsx
  → latestStatus = statusMessages[statusMessages.length - 1]
  → renders banner + disabled controls
```

---

## Why only the latest status message?

Accumulating all status messages as chat bubbles made the conversation feel cluttered during long generations. The status messages aren't part of the conversation — they're ephemeral progress signals (like a progress bar). Showing only the most recent one keeps the chat clean while still giving users live feedback.

---

## Key files

| File | Role |
|---|---|
| `types/tasks.ts` | `AiStatusPayload` type + `validateAiStatusPayload` guard |
| `liveblocks.config.ts` | `Presence.thinking` and `RoomEvent` types |
| `canvas-flow.tsx` | Syncs `thinking` presence; validates and routes feed events |
| `ai-sidebar.tsx` | Renders AI state in the chat UI |
| `live-cursors.tsx` | Shows thinking spinner on collaborator cursor badges |
| `workspace-shell.tsx` | Owns `isAiThinking` state; threads it to both canvas and sidebar |
