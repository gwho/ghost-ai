# Plan: AI Architect Message Routing and Design Run Failure

## Problem

1. Messages typed in the AI Architect tab appear in the Chat tab instead of staying in their own conversation view.
2. Design prompts always fail with "Failed to start AI design run" because the frontend omits `projectId` from the API request.

## Analysis

Both tabs (AI Architect and Chat) write to a single Liveblocks feed `ai-chat`. The Chat tab displays all messages from that feed. The AI Architect tab has no message display — only starter chips and an input box.

The design API (`POST /api/ai/design`) requires `{ prompt, roomId, projectId }` but the frontend sends `{ prompt, roomId }`. The API returns 400, which the frontend catches and displays as a generic error.

## Implementation

### Step 1: Add a separate architect feed

- Define `ARCHITECT_FEED_ID = 'ai-architect-feed'` alongside `CHAT_FEED_ID = 'ai-chat'`
- Create both feeds on mount using the existing `useCreateFeed` pattern
- Subscribe to each feed independently: `useFeedMessages(ARCHITECT_FEED_ID)` for the Architect tab, `useFeedMessages(CHAT_FEED_ID)` for the Chat tab

### Step 2: Reroute AI Architect messages

- `submitAi()` writes user messages to `ARCHITECT_FEED_ID` instead of `CHAT_FEED_ID`
- `handleRunComplete()` writes AI completion/failure messages to `ARCHITECT_FEED_ID`
- Error catch in `submitAi()` writes error messages to `ARCHITECT_FEED_ID`
- `submitChat()` continues writing to `CHAT_FEED_ID` (unchanged)

### Step 3: Add message display to AI Architect tab

- Add a scrollable message area to the Architect `TabsContent`
- Show starter chips when the conversation is empty; show message bubbles when messages exist
- Reuse the same bubble styling pattern from the Chat tab (user messages on right in accent color, AI messages on left in elevated background)

### Step 4: Fix `projectId`

- Change the `submitAi` fetch body from `{ prompt, roomId }` to `{ prompt, roomId, projectId: roomId }`
- `roomId` equals `project.id` in this app, so no additional prop is needed

## Scope

All changes are in `components/editor/ai-sidebar.tsx`. No backend modifications required.

## Verification

- AI Architect messages stay in the Architect tab and do not appear in Chat
- Chat messages stay in the Chat tab
- Submitting a design prompt calls `/api/ai/design` with `projectId` and returns a `runId`
- The canvas updates when the design agent completes
- Both feeds are collaborative — messages visible across all connected clients
