# Feature 23: Design Agent Logic — What It Does and Why

## What This Feature Delivers

When a user types a prompt like "design a microservices e-commerce system" in the AI sidebar and clicks Send, the following happens in real time:

1. A status chip appears in the sidebar: *"Gemini is reading your prompt…"*
2. Gemini (`gemini-2.5-flash-lite`) interprets the prompt and generates nodes and edges.
3. Another status chip: *"Updating canvas…"*
4. The canvas updates live — new architecture nodes appear for everyone in the room.
5. Final chip: *"Design complete — 8 nodes added."*

If something goes wrong: *"Something went wrong — canvas unchanged."*

All collaborators in the room see every status chip at the same time, and the submitting user shows a "thinking" state to others.

---

## Key Concept 1: Why a Background Task?

The AI call can take 5–15 seconds. You cannot do this inside a Next.js API route handler because:
- Request handlers have tight timeouts (usually 10–30 s on serverless platforms)
- A long-running handler blocks the response and can't send incremental updates

**Trigger.dev** solves this. The API route just fires off the task (`tasks.trigger`) and returns immediately with a `runId`. The actual Gemini call and canvas mutation happen in a durable background worker that can run as long as needed.

---

## Key Concept 2: How Gemini Generates Structured Output

We use `generateObject` from the Vercel AI SDK, not `generateText`. The difference:

- `generateText` → free-form string (hard to parse, unreliable structure)
- `generateObject` → validates output against a **zod schema** before returning

The schema enforces that nodes have valid shapes, colors from the allowed palette, and positions within a sane layout. Gemini can't return a malformed response — it gets retried until the output matches the schema.

```ts
const { object } = await generateObject({
  model: google('gemini-2.5-flash-lite'),
  schema: DesignSchema,
  system: SYSTEM_PROMPT,
  prompt,
})
// object.nodes and object.edges are fully typed and validated
```

---

## Key Concept 3: mutateFlow — Writing to the Canvas from the Server

The canvas nodes and edges live in **Liveblocks** (a real-time sync service), not in a regular database. To modify them from a server-side background task, we use `mutateFlow` from `@liveblocks/react-flow/node`:

```ts
await mutateFlow<CanvasNode, CanvasEdge>({ client: liveblocks, roomId }, (flow) => {
  flow.removeNodes(existingNodeIds)   // clear current canvas
  flow.removeEdges(existingEdgeIds)
  flow.addNodes(nodes)                // add AI-generated nodes
  flow.addEdges(edges)
})
```

This is a server-side write directly into the Liveblocks room. Every connected user sees the change instantly via their existing Liveblocks connection — no polling, no refresh needed.

---

## Key Concept 4: broadcastEvent — Real-Time Status to All Users

To show progress in every user's sidebar, the task calls `liveblocks.broadcastEvent(roomId, { type: 'ai-status', status, message })`. This sends a custom event to every connected client.

On the client side, `useEventListener` (inside `CanvasFlowInner`, which is inside the Liveblocks `RoomProvider`) catches these events and passes them up via a callback chain to `workspace-shell` → `AISidebar`, where they render as small italic status chips in the chat area.

---

## Key Concept 5: The Callback Chain (Why It's Needed)

`AISidebar` cannot use Liveblocks hooks directly because it sits **outside** the `RoomProvider`. The `RoomProvider` wraps only the canvas area (in `CanvasWrapper`). The solution is a prop-based callback chain:

```
CanvasFlowInner (useEventListener)
  → onAiStatus prop (workspace-shell)
    → aiMessages state update
      → statusMessages prop (AISidebar)
        → renders as status chips
```

This keeps the Liveblocks boundary intact — only components inside the RoomProvider use Liveblocks hooks.

---

## Key Concept 6: Presence — "Thinking" State

The `Presence` type includes a `thinking: boolean` field. When a user submits a prompt, `workspace-shell` sets `isAiThinking: true`. This prop is threaded down to `CanvasFlowInner`, which uses `useEffect` + `useUpdateMyPresence` to broadcast the thinking state to all collaborators:

```ts
useEffect(() => {
  updateMyPresence({ thinking: isAiThinking ?? false })
}, [isAiThinking, updateMyPresence])
```

When the task completes or errors, the `onAiComplete` callback sets `isAiThinking: false`, clearing the thinking state for all observers.

---

## What Files Were Touched

| File | Role |
|---|---|
| `trigger/design-agent.ts` | The AI brain — Gemini call, canvas mutation, status broadcast |
| `liveblocks.config.ts` | Added `RoomEvent` type so TypeScript knows what events to expect |
| `canvas-flow.tsx` | Listens for room events; syncs thinking presence |
| `canvas-wrapper.tsx` | Passes AI props down to canvas-flow |
| `workspace-shell.tsx` | Orchestrates AI state; wires submit + status handlers |
| `ai-sidebar.tsx` | Shows status chips; calls onSubmit when user sends a prompt |
