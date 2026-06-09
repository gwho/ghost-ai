# Fix: generate-spec Task Payload Mismatch

## What broke and why

Clicking **Generate Spec** triggered a Trigger.dev background task called `generate-spec`. That task uses a **schema** — a set of rules — to check every piece of data it receives before running. Think of a schema like a bouncer at a nightclub: if your data doesn't match what's on the list, it gets rejected at the door.

The schema (`AiChatMessageSchema` in `types/tasks.ts`) said each chat message must have **four fields**:

| Field | Type | Example |
|---|---|---|
| `sender` | string | `"Jesse"` |
| `role` | `"user"` or `"assistant"` | `"user"` |
| `content` | string | `"Build a CI/CD pipeline"` |
| `timestamp` | number | `1717966795000` |

But the frontend code that *builds* the list of messages only included two fields (`role` and `content`), forgetting `sender` and `timestamp`. When the task worker received the data and checked it against the schema, it saw `sender: undefined` and `timestamp: undefined`, and immediately failed with `TASK_INPUT_ERROR` — before any AI work even started.

## Where the bug lived

**File:** [components/editor/ai-sidebar.tsx](../components/editor/ai-sidebar.tsx) — inside the `submitSpec` function (~line 317).

The messages come from Liveblocks (the real-time collaboration system) and are stored as `architectMessages`. Each message's `.data` object already had all four fields on it — `sender`, `role`, `content`, and `timestamp` — but the code that packaged them for the API only grabbed two.

## The one-line fix

```typescript
// Before (broken — only 2 fields sent)
const chatHistory = architectMessages.map((m) => ({
  role: m.data.role,
  content: m.data.content,
}))

// After (fixed — all 4 required fields sent)
const chatHistory = architectMessages.map((m) => ({
  sender: m.data.sender,
  role: m.data.role,
  content: m.data.content,
  timestamp: m.data.timestamp,
}))
```

No schema changes needed. The schema was correct all along — the payload construction was the bug.

## The reusable lesson

**When you use `schemaTask` in Trigger.dev, the schema is the contract.** Every field marked as required (no `.optional()`) must be present in the payload you send, or Trigger.dev rejects the task before it runs. This validation happens server-side at Trigger.dev, not in your Next.js app, which is why the error showed up in the Trigger.dev dashboard rather than in the browser.

A good debugging habit: when you see `TASK_INPUT_ERROR` or `TaskPayloadParsedError` in Trigger.dev, immediately compare:
1. The Zod schema in the `trigger/` folder (what is *required*)
2. The payload shown in the Trigger.dev dashboard (what was *actually sent*)

The mismatch is always in one of those two places.

---

## Suggested AI Discussion Topics

These are great things to explore in a conversation with an AI to deepen your understanding of the concepts involved:

1. **Zod schema validation** — What is Zod? How do `.string()`, `.number()`, `.enum()`, `.optional()`, and `.array()` work? How does Zod give you TypeScript types for free?

2. **Trigger.dev `schemaTask` vs `task`** — What's the difference? Why does `schemaTask` validate the payload automatically, and why is this useful for catching bugs early?

3. **`.map()` in JavaScript** — What does `.map()` do? How does it transform an array? Why is it common to "pick" specific fields when mapping — and what are the risks of forgetting fields?

4. **Data contracts between systems** — When a frontend sends data to a backend (or to a third-party service like Trigger.dev), why is it important to agree on the exact shape? What happens when the shape drifts over time?

5. **Liveblocks feed messages** — How does Liveblocks store real-time data? What is a "feed message" and how does `useFeedMessages` work?
