# Fix: AI Architect Message Routing and Design Run Failure

## What Was Broken

Two bugs in `components/editor/ai-sidebar.tsx`:

1. **Message cross-contamination** — Messages typed in the AI Architect tab appeared in the Chat tab. The AI Architect tab had no message display, so users had to switch to Chat to see their prompts and AI responses.

2. **Design run always failed** — Every prompt returned "Failed to start AI design run. Please try again." The canvas stayed empty.

## Root Causes

### Shared Liveblocks feed (message routing)

Both `submitAi()` (AI Architect) and `submitChat()` (Chat) wrote to the same Liveblocks feed (`ai-chat`). The Chat tab subscribed to that feed and displayed everything — including AI Architect prompts, AI responses, and error messages that belonged exclusively to the Architect workflow.

The AI Architect tab only rendered starter chips and an input box. It had no message display area, so the conversation was invisible unless the user switched to Chat.

### Missing `projectId` in API call (design run failure)

The API route `POST /api/ai/design` requires three fields:

```ts
const { prompt, roomId, projectId } = body
if (!prompt || !roomId || !projectId) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}
```

The frontend only sent two:

```ts
body: JSON.stringify({ prompt: trimmed, roomId })
```

`projectId` was never included, so the API returned 400. The generic catch block swallowed the error and posted "Failed to start AI design run" to the feed.

In this app `roomId === project.id` (set in `workspace-shell.tsx`), so the value was already available — it just wasn't being passed.

## What Changed

All changes in `components/editor/ai-sidebar.tsx`:

### 1. Separated feeds

Added a new feed constant `ARCHITECT_FEED_ID = 'ai-architect-feed'` alongside the existing `CHAT_FEED_ID = 'ai-chat'`. Both feeds are created on mount.

- AI Architect messages (user prompts, AI responses, errors) now write to `ai-architect-feed`
- Collaborator chat messages continue using `ai-chat`
- Each tab subscribes to its own feed via `useFeedMessages()`

### 2. Added message display to AI Architect tab

The Architect tab now has a scrollable message area identical in structure to the Chat tab. It shows the conversation between the user and Ghost AI (prompts, completion messages, errors). Starter chips still appear when there are no messages yet.

### 3. Fixed `projectId`

Changed the design API call from:

```ts
body: JSON.stringify({ prompt: trimmed, roomId })
```

to:

```ts
body: JSON.stringify({ prompt: trimmed, roomId, projectId: roomId })
```

## Why This Fixes It

- Feed separation prevents AI Architect messages from leaking into the collaborator Chat. Each tab has its own data source.
- Passing `projectId` satisfies the API validation, allowing `tasks.trigger()` and `prisma.taskRun.create()` to proceed. The Trigger.dev design agent can now run, call Gemini, and update the canvas via `mutateFlow`.

## Files Modified

- `components/editor/ai-sidebar.tsx`

No backend changes were needed — the API routes and Trigger.dev task were correct as-is.
