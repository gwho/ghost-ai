# Spec Explanation: generate-spec — How Spec Generation Works End-to-End

This doc walks through the full journey of what happens when you click **Generate Spec** in the AI sidebar.

---

## The big picture

```
User clicks "Generate Spec"
        ↓
[Frontend] ai-sidebar.tsx
  – Reads chat messages from Liveblocks
  – Reads canvas nodes/edges from React Flow
  – Sends a POST to /api/ai/spec
        ↓
[Backend] app/api/ai/spec/route.ts
  – Validates the request
  – Calls tasks.trigger("generate-spec", payload)
        ↓
[Trigger.dev] generate-spec task
  – Validates payload with Zod schema ← (this is where the bug was)
  – Calls Claude AI with the chat history + canvas data
  – Writes the generated spec to Vercel Blob storage
  – Updates the database with the spec URL
```

---

## Step 1 — The frontend collects data

**File:** [components/editor/ai-sidebar.tsx](../components/editor/ai-sidebar.tsx)

When you click "Generate Spec", the `submitSpec` function runs. It does two things:

**1. Gets the chat history from Liveblocks**

The messages typed in the Architect sidebar are stored in a Liveblocks "feed" (a real-time list shared across all collaborators). The hook `useFeedMessages(ARCHITECT_FEED_ID)` reads them.

Each message has: `sender` (who wrote it), `role` ("user" or "assistant"), `content` (the text), and `timestamp` (when it was sent).

**2. Gets a snapshot of the canvas**

`getCanvasSnapshot()` returns the current list of nodes (boxes) and edges (arrows) on the React Flow canvas.

The function then POSTs all of this to `/api/ai/spec`.

---

## Step 2 — The API route triggers the background task

**File:** [app/api/ai/spec/route.ts](../app/api/ai/spec/route.ts)

This is a Next.js **Route Handler** — a serverless function that runs when the frontend hits `/api/ai/spec`.

It does three things:
1. Parses the request body
2. Checks that `roomId` exists (basic validation)
3. Calls `tasks.trigger("generate-spec", payload)` — this hands the work off to Trigger.dev

The API route then immediately returns the Trigger.dev run handle to the frontend. The heavy AI work runs *in the background* — the user's browser doesn't have to wait for the full spec to be written.

---

## Step 3 — Trigger.dev validates the payload with Zod

**File:** [trigger/generate-spec.ts](../trigger/generate-spec.ts)

The task is defined with `schemaTask`, which means Trigger.dev automatically validates the incoming payload against a Zod schema before running any code.

```typescript
const SpecPayloadSchema = z.object({
  projectId: z.string(),
  roomId: z.string(),
  chatHistory: z.array(AiChatMessageSchema),  // ← each message must match this
  nodes: z.array(CanvasNodeSchema),
  edges: z.array(CanvasEdgeSchema),
})
```

`AiChatMessageSchema` (defined in [types/tasks.ts](../types/tasks.ts)) requires: `sender`, `role`, `content`, `timestamp`.

If any field is missing, Trigger.dev throws `TASK_INPUT_ERROR` and the task never runs — which was exactly what happened before this fix.

---

## Step 4 — The AI generates the spec

Once validation passes, the task:
1. Formats the chat history and canvas data into a prompt
2. Sends it to Claude (the AI model)
3. Streams the response back as a Markdown document

---

## Step 5 — The spec is saved

The generated Markdown spec is:
1. Written to **Vercel Blob** storage (a file-hosting service) at a URL like `specs/{projectId}/{specId}.md`
2. The URL is saved to **PostgreSQL** (the database) so the frontend can fetch it

The frontend is subscribed to the Trigger.dev run's status in real-time (via `useRealtimeRun`), so the spec panel updates automatically when the task completes.

---

## Key concepts to understand

| Concept | What it is |
|---|---|
| `schemaTask` | A Trigger.dev task that validates its input automatically using Zod |
| `useFeedMessages` | A Liveblocks hook for reading a real-time ordered list of messages |
| `tasks.trigger(...)` | The Trigger.dev SDK call that enqueues a background task |
| `TASK_INPUT_ERROR` | Trigger.dev's error code when the payload fails schema validation |
| Vercel Blob | Cloud file storage — like S3 but simpler |
