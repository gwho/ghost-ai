# AI Discussion Topics: AI Architect Message Routing

These topics explore the concepts behind feed separation, API contract enforcement, and multi-channel real-time architecture.

---

## 1. One feed vs. separate feeds — when to split

**Question**: The original implementation used a single `ai-chat` feed for both AI Architect prompts and collaborator chat. Why does this cause problems? When should you use one feed vs. multiple feeds in a Liveblocks app?

**What to understand**: A single feed is simpler but couples unrelated message streams. When two UI surfaces display different subsets of the same feed, you need client-side filtering — which is fragile and means every subscriber downloads messages they don't need. Separate feeds provide natural isolation: each subscriber gets exactly the messages it cares about, and the data model reflects the actual domain boundaries (AI conversation vs. human chat). Consider the trade-off between simplicity (one feed) and correctness (separate feeds), and when the coupling cost exceeds the simplicity benefit.

---

## 2. API contract mismatches — silent failures in frontend/backend communication

**Question**: The frontend sent `{ prompt, roomId }` but the API required `{ prompt, roomId, projectId }`. This caused a 400 error that was caught and displayed as a generic message. How could this have been caught earlier? What patterns prevent this class of bug?

**What to understand**: This is a contract mismatch — the client and server disagree on the request shape. TypeScript doesn't help across the network boundary unless you share types. Options include: shared Zod schemas validated on both sides, end-to-end type-safe APIs (tRPC, Hono RPC), or integration tests that exercise the actual HTTP call. Discuss why the generic catch block made this harder to debug (it swallowed the 400 status and reason), and how structured error handling could surface the root cause.

---

## 3. Liveblocks feeds vs. room events — choosing the right real-time channel

**Question**: This app uses three Liveblocks channels: feeds (`ai-chat`, `ai-architect-feed`), room events (`ai-status` broadcasts), and presence (`thinking`). Why not put everything in one channel? What are the differences in persistence, delivery, and use case?

**What to understand**: Feeds are persistent — messages are stored and available to late joiners. Room events are ephemeral — they're only delivered to currently connected clients. Presence is per-user live state. Choosing the wrong channel type leads to bugs: if AI status used a feed, old status messages would accumulate and confuse new joiners. If chat used events, message history would be lost on reconnect. The choice depends on whether the data needs persistence, who needs to see it, and whether it represents state or an event.

---

## 4. Defensive UI — showing the right empty state

**Question**: The AI Architect tab shows starter chips when the architect feed is empty, and switches to a message list when conversations exist. Why is this conditional rendering important? What happens if you always show the message list?

**What to understand**: Empty states are a form of user guidance — they tell users what to do next. An empty message list with just an input box gives no context about what the feature does or how to use it. Starter chips serve as both documentation and shortcuts. The pattern of "empty state with guidance → populated state with data" is a UX best practice. Discuss how this applies to other features in the app (e.g., empty canvas, empty collaborator list) and when a static placeholder is better than a dynamic suggestion.

---

## 5. Identity reuse — why `roomId === projectId` works here but might not scale

**Question**: The fix passes `projectId: roomId` because in this app the Liveblocks room ID is the project ID. Is this a good pattern? When would it break?

**What to understand**: Using a single identifier for multiple concepts (room identity, project identity, URL parameter) reduces boilerplate but creates an implicit coupling. If the app later needs multiple rooms per project (e.g., separate canvas pages, whiteboard + diagram), or if room IDs need to be namespaced, the assumption breaks. Discuss the trade-off between pragmatic simplicity now and architectural flexibility later, and how you'd refactor if the assumption changed.

---

## 6. Error handling granularity — generic catch vs. per-error handling

**Question**: The `submitAi` function catches all errors with a single catch block and shows the same message regardless of whether the design API returned 400, 401, 404, or 500. What are the trade-offs of this approach?

**What to understand**: A generic catch block is simple and ensures the user always sees feedback. But it hides the actual problem — a 400 (missing field) requires a code fix, a 401 (unauthorized) might need re-login, a 500 (server error) might be transient. Without error differentiation, debugging requires checking server logs. Discuss when generic error messages are appropriate (consumer-facing apps where error details are a security risk) vs. when specific messages help (developer tools, internal apps, or at minimum logging the actual error for observability).
