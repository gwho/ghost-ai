# Feature 25 — AI Discussion Topics: Sidebar Chat Feed

Use these prompts with an AI assistant or coding agent to go deeper on the concepts introduced in this feature.

---

## React Context & Provider Architecture

- "Why does React Context only flow downward in the component tree? What would need to change in React's design for it to flow sideways between siblings?"
- "What happens at runtime if you call `useSelf()` or `useFeedMessages()` outside a `LiveblocksProvider`? Why does React throw instead of returning undefined?"
- "In this project we moved `LiveblocksProvider` from `CanvasWrapper` to `WorkspaceShell`. What is the trade-off of moving a Provider higher up the tree? Are there cases where moving it TOO high is a problem?"
- "What is 'declaration merging' in TypeScript? Why does Liveblocks use it (`interface Liveblocks {}`) instead of passing generic type parameters to every hook?"

---

## Feeds vs. Broadcast Events

- "Explain the difference between ephemeral pub/sub (like Liveblocks `broadcastEvent`) and persistent pub/sub (like Liveblocks Feeds). Give a real-world analogy for each."
- "Why are Liveblocks Feeds scoped to a room rather than being global across the whole app? What would be different if feeds were user-scoped instead?"
- "If we used `broadcastEvent` for chat instead of Feeds, what specific user scenarios would break? Walk me through the failure mode when a user refreshes the page."
- "How does Liveblocks deliver feed updates in real time? What protocol does it use under the hood, and how does `useFeedMessages` know to trigger a React re-render when a new message arrives?"

---

## Zod & Runtime Validation

- "What is `z.infer<typeof Schema>` and why is it better than writing a TypeScript interface manually when you also need runtime validation?"
- "Zod's `safeParse` returns `{ success, data, error }` instead of throwing. What React rendering patterns does this enable that a throwing validator wouldn't?"
- "In this feature we validate feed messages even though WE wrote them. Is this over-engineering, or is there a real risk? Describe a scenario where an old message in the feed breaks new rendering code."
- "What's the difference between validating at the 'system boundary' (when data enters from outside) vs. validating everywhere? Where is the line in a frontend app?"

---

## Real-Time Chat Architecture

- "Compare these three approaches to collaborative chat: (1) local React state only, (2) Liveblocks broadcast events, (3) Liveblocks Feed API. When is each appropriate?"
- "What is 'optimistic UI' in the context of sending a chat message? How would you implement it with the Feed API — show the message immediately before the server confirms, then handle the failure case?"
- "In the current implementation, `submit()` first writes to the feed, then calls `onSubmit()` for the AI agent. What happens if the feed write succeeds but the AI agent call fails? Is this the right order? What would you change?"
- "If 10 users type messages at the same time, how does Liveblocks guarantee message ordering? What consistency model does it use — is it eventual consistency, strong consistency, or something else?"

---

## Component Design

- "The sidebar now uses `useSelf()` to get the current user's name for the `sender` field. What are the trade-offs of storing identity inside the message payload vs. deriving it from a separate user lookup when rendering?"
- "The `CHAT_FEED_ID` constant is defined inside `ai-sidebar.tsx`. What would you need to change if two different sidebar features needed to share the same feed? How would you centralize feed IDs?"
- "The `useCreateFeed` call on mount is fire-and-forget (errors are caught and swallowed). Is this safe? What happens if the feed creation fails silently and the user tries to send a message?"
