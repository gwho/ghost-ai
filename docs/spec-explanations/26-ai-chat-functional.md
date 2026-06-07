# Feature 26: AI Chat Functional — Spec Explanation

## What this feature does

Before this feature, the AI Architect tab had a text input and a Send button, but pressing Send did nothing useful — it called `onSubmit` which made an API call but there was no feedback, no status display, and no result in the chat. Feature 26 completes the loop: submit a prompt → see it appear in Chat → watch the AI work → see the result.

---

## The full flow step by step

### 1. User types a prompt and presses Send

In [ai-sidebar.tsx](../../components/editor/ai-sidebar.tsx), the `submitAi` function runs:

```
User presses Send
  → push user message to ai-chat feed (visible in Chat tab immediately)
  → POST /api/ai/design with { prompt, roomId }
  → receive { runId } back
  → POST /api/ai/design/token with { runId }
  → receive { token } back
  → store runId + token in component state
  → set isLoading = true (disables input, shows spinner)
```

The user message appears in the Chat tab right away, before the AI has done anything, because it's pushed to the Liveblocks `ai-chat` feed immediately.

### 2. Tracking the AI run with `useRealtimeRun`

Trigger.dev provides a React hook called `useRealtimeRun`. Once we have a `runId` and `publicToken`, this hook opens a live connection to Trigger.dev's servers and streams run status updates in real time. The `publicToken` is a scoped, read-only credential that only grants access to this single run for 1 hour — it's safe to use on the frontend.

```ts
useRealtimeRun(runId ?? '', {
  accessToken: publicToken ?? '',
  onComplete: (completedRun) => {
    // fires once when the run finishes (success or failure)
  },
})
```

The `runId ?? ''` pattern is necessary because React doesn't allow conditional hook calls. When there's no active run, the hook gets an empty string and simply doesn't connect to anything.

### 3. Status strip during the run

While the design agent is running, it broadcasts status messages via Liveblocks:

```ts
// inside trigger/design-agent.ts
await broadcastEvent(roomId, { type: 'ai-status', message: 'Generating nodes…', status: 'processing' })
```

The sidebar listens for these events directly with `useEventListener`:

```ts
useEventListener(({ event }) => {
  const payload = validateAiStatusPayload(event)
  if (!payload) return
  setStatusText(payload.message)
  // clear the strip when done
  if (payload.status === 'complete' || payload.status === 'error') {
    setStatusText(null)
  }
})
```

A compact status strip renders above the input whenever `isLoading && statusText`:

```
┌────────────────────────────────────┐
│ ● Generating nodes…                │  ← dark strip, green dot
├────────────────────────────────────┤
│ Describe your architecture…        │
│                              Send  │
└────────────────────────────────────┘
```

### 4. When the run completes

The `onComplete` callback in `useRealtimeRun` fires exactly once. It:
1. Pushes a final AI message to the `ai-chat` feed (visible in Chat tab)
2. Resets `runId`, `publicToken`, `isLoading` back to null/false
3. Calls `onThinkingChange(false)` so the canvas presence (`thinking: false`) updates

---

## Why two separate API calls?

The sidebar makes two calls: one to `/api/ai/design` for `runId`, then one to `/api/ai/design/token` for the public token. This keeps both existing API routes completely unchanged. The alternative (returning `publicToken` directly from the design route) would require modifying a working endpoint.

---

## Why the user message goes to the Chat tab, not just the AI Architect tab

Both tabs read from the same Liveblocks `ai-chat` feed. Messages in the feed persist across refreshes and are visible to all collaborators in the room. The AI Architect tab is where you send commands to the AI; the Chat tab is where you see the conversation history. When you submit a prompt, it's treated as a message in that shared conversation.

---

## Canvas updates are automatic

The design agent mutates nodes and edges directly through Liveblocks. Because `useLiveblocksFlow` in `canvas-flow.tsx` keeps nodes and edges in the shared Liveblocks room, any changes the agent makes appear on every collaborator's canvas automatically — no extra wiring needed in this feature.

---

## Files changed

| File | What changed |
|------|-------------|
| [liveblocks.config.ts](../../liveblocks.config.ts) | `FeedMessageData.role` widened to `'user' \| 'assistant'` so AI messages can be written to the feed |
| [types/tasks.ts](../../types/tasks.ts) | `AiChatMessageSchema.role` extended to `z.enum(['user', 'assistant'])` |
| [ai-sidebar.tsx](../../components/editor/ai-sidebar.tsx) | Full rework — owns the entire submit/track/complete flow; removed `isAiThinking`/`onSubmit`/`statusMessages` props |
| [workspace-shell.tsx](../../components/editor/workspace-shell.tsx) | Removed `handleAiSubmit`, `aiMessages`, `handleAiStatus`; added `onThinkingChange` prop to sidebar |

---

## Key concepts introduced

- **`useRealtimeRun`** — Trigger.dev React hook that streams live run status from a task ID + token
- **`onComplete` callback** — fires exactly once when a run reaches a terminal state; safer than `useEffect` on `run.status`
- **Liveblocks `useEventListener` fan-out** — multiple components in the same room can listen to the same broadcast event independently
- **Scoped public token** — a short-lived, read-only Trigger.dev credential that exposes only one specific run to the frontend
