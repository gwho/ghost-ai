# Plan: Feature 24 — AI Presence State

## What we're building

Shared AI activity indicators — everyone in the room sees when generation is in progress. No actual AI generation is added here; this is purely UI, presence, and realtime status signals.

## What already exists (don't duplicate)

- `liveblocks.config.ts` — `Presence.thinking: boolean` already typed; `RoomEvent { type: 'ai-status' }` already typed.
- `canvas-flow.tsx` — `useUpdateMyPresence` already syncs `thinking` to the room; `useEventListener` already handles `ai-status` events.
- `workspace-shell.tsx` — `isAiThinking` state already exists.
- `ai-sidebar.tsx` — receives `statusMessages` prop and has a send button/textarea.
- `live-cursors.tsx` — reads `other.presence.cursor` and badge info; `other.presence.thinking` is available but unused.

## The "ai-status-feed"

The spec asks to reuse a Liveblocks feed named `ai-status-feed`. In Liveblocks best practice, broadcasting room-wide events uses `broadcastEvent` + `useEventListener`. The existing `RoomEvent { type: 'ai-status' }` IS this feed — it's the channel through which the design-agent broadcasts status updates to all participants. No new Liveblocks API is needed; the logical feed name is documented in `types/tasks.ts`.

## Steps

### 1. `types/tasks.ts` (new)
- `AiStatusPayload` interface with `type`, `message`, `status`, and optional `text`
- `validateAiStatusPayload(raw: unknown): AiStatusPayload | null` — runtime type guard

### 2. `canvas-flow.tsx`
- Replace the simple `event.type !== 'ai-status'` guard with `validateAiStatusPayload(event)`
- Drop invalid payloads silently before calling `onAiStatus`

### 3. `ai-sidebar.tsx`
- Add `isAiThinking?: boolean` prop
- Track `latestStatus: string | null` instead of accumulating status messages as chat bubbles
- Show a pulsing dot on the Bot icon in the header when thinking
- Subtitle changes to "AI is thinking…" when active
- Textarea: `disabled={isAiThinking}`
- Send button: shows `Loader2` spinner + "Thinking…" label when active; disabled
- Latest status message renders as a single chip above the input (replaced on each update, not accumulated)

### 4. `live-cursors.tsx`
- Import `Loader2` from `lucide-react`
- When `other.presence.thinking` is true, render a spinner inside the cursor name badge

### 5. `workspace-shell.tsx`
- Pass `isAiThinking={isAiThinking}` to `<AISidebar>` (one-line change)

## Verification checklist

- [ ] `npm run build` passes
- [ ] Sidebar textarea and send button are disabled when AI is thinking
- [ ] Sidebar shows "Thinking…" on the send button with a spinner
- [ ] Sidebar shows only the latest status message as a banner (not accumulated)
- [ ] Header pulsing dot appears when `isAiThinking` is true
- [ ] Live cursor badges show a spinner next to the participant name when `presence.thinking` is true
- [ ] Invalid feed payloads (missing fields, wrong types) are silently dropped
