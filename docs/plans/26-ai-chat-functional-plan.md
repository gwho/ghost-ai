# Plan: Feature 26 — AI Chat Functional

## Context

Features 22–25 built all the infrastructure: the design API endpoint, the Trigger.dev design agent, AI presence state broadcasting via Liveblocks room events, and the persistent `ai-chat` feed. Feature 26 wires them together end-to-end: the AI Architect tab submits a prompt, pushes a user message to the feed, calls the backend to start a Trigger.dev run, tracks it with `useRealtimeRun`, and pushes a final AI message when the run completes. The sidebar also listens to Liveblocks `ai-status` events directly for mid-run status display.

---

## Files modified

| File | Change |
|------|--------|
| `liveblocks.config.ts` | Widened `FeedMessageData.role` to `'user' \| 'assistant'` |
| `types/tasks.ts` | Extended `AiChatMessageSchema` role to `z.enum(['user', 'assistant'])` |
| `components/editor/ai-sidebar.tsx` | Major rework — owns the full submit/track/complete flow |
| `components/editor/workspace-shell.tsx` | Removed `handleAiSubmit`/`aiMessages`/`handleAiStatus`; added `onThinkingChange` to sidebar |

`/api/ai/design/route.ts` and `/api/ai/design/token/route.ts` are **unchanged**.

---

## Key design decisions

### 1. Two API calls instead of one
The sidebar calls `/api/ai/design` to start the run, then immediately calls `/api/ai/design/token` with the returned `runId` to get a scoped public read token. This keeps both existing routes unchanged rather than modifying a working endpoint.

### 2. `useRealtimeRun` directly in the component
Called with `runId ?? ''` as a fallback. When no run is active, the hook receives an empty string and doesn't connect to any run. The `onComplete` callback fires exactly once when the run reaches a terminal state, making it cleaner than watching `run.status` in a `useEffect`.

### 3. `useEventListener` directly in the sidebar
The sidebar is inside `RoomProvider` (as of Feature 25), so it can call Liveblocks hooks directly. This eliminates the `statusMessages` prop relay through `workspace-shell.tsx` and makes the sidebar self-contained for status display.

### 4. `isAiThinking` stays in `workspace-shell`
`canvas-flow.tsx` uses `isAiThinking` to sync the local user's `thinking` presence field. The sidebar notifies workspace-shell via `onThinkingChange` when a run starts/ends, keeping the canvas presence sync path unchanged.

### 5. `handleAiComplete` kept as a safety net
Canvas-flow fires `onAiComplete` when it receives an `ai-status: 'complete'` broadcast from the design agent. This is independent of the Trigger.dev run completion. Both paths calling `setIsAiThinking(false)` is idempotent and harmless.

---

## Removed from `workspace-shell.tsx`

- `aiMessages` state
- `handleAiSubmit` — sidebar calls the API directly
- `handleAiStatus` — sidebar uses `useEventListener` directly

---

## Verification checklist

- [ ] Submitting a prompt calls `/api/ai/design` and returns a `runId`
- [ ] `useRealtimeRun` connects using the token from `/api/ai/design/token`
- [ ] Input is disabled while the run is active
- [ ] Status strip appears above input only during active runs
- [ ] Chat updates appear across multiple sessions (Liveblocks feed)
- [ ] No TypeScript or build errors
