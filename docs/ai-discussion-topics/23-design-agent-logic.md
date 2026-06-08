# AI Discussion Topics: Feature 23 — Design Agent Logic

These are good prompts to explore with an AI tutor to deepen understanding of the concepts used in this feature.

---

## 1. Structured Output vs. Free-form Text Generation

**Question**: Why do we use `generateObject` with a zod schema instead of `generateText` and then JSON-parsing the result? What can go wrong with the parse approach, and how does schema-validated generation fix it?

**What to understand**: Reliability guarantees, retry behaviour, type safety in TypeScript, and why structured output is almost always the right choice when you need machine-readable data.

---

## 2. Durable Background Tasks vs. API Route Handlers

**Question**: What happens if a Next.js API route handler tries to run a 30-second AI call on a serverless platform? Why does Trigger.dev solve this? What does "durable" mean in the context of background tasks?

**What to understand**: Serverless cold starts, function timeouts, checkpointing in Trigger.dev, and the pattern of "fire and forget" from the API route while the real work happens in a task worker.

---

## 3. The Liveblocks Event System: broadcastEvent vs. Storage Mutations

**Question**: What is the difference between `broadcastEvent` and `mutateStorage` (used internally by `mutateFlow`) in Liveblocks? When would you use each one? Why did we use broadcast events for status messages instead of writing them to storage?

**What to understand**: Ephemeral vs. persistent data, the difference between signalling (events) and state (storage), and why status messages don't need to survive a page refresh.

---

## 4. Component Tree Boundaries and the RoomProvider Constraint

**Question**: Why can't `AISidebar` call `useEventListener` directly? What is the rule about React context and where hooks can be used? How does the callback chain pattern (`onAiStatus` prop chain) work around this without restructuring the whole component tree?

**What to understand**: React context scope, the provider pattern, prop drilling vs. lifting state up, and trade-offs between restructuring providers vs. using callback chains.

---

## 5. Presence vs. Persistent State for "Thinking" Indicator

**Question**: Why is the AI "thinking" state stored in Liveblocks Presence rather than in the database or in regular React state? What are the lifetime and visibility characteristics of Presence data?

**What to understand**: Liveblocks Presence is ephemeral (lost on disconnect), per-connection, and automatically broadcast to all connected peers — which makes it ideal for transient UI state like cursors, selection, or activity indicators.

---

## 6. Prompt Engineering for Structured Architecture Diagrams

**Question**: The system prompt tells Gemini exactly what shapes to use for what components (rectangle=service, cylinder=database, hexagon=queue, etc.). Why is this kind of prescriptive prompt necessary? What happens if you give Gemini too much freedom on shape choice?

**What to understand**: The principle of constrained generation — giving the model a controlled vocabulary produces more consistent and usable outputs. Explore how system prompts encode domain knowledge and design conventions.

---

## 7. Clearing the Canvas Before Adding AI Nodes

**Question**: In `mutateFlow`, we first remove all existing nodes and edges, then add the new ones. What are the trade-offs of this approach vs. merging new nodes with existing ones? When would you want to merge instead of replace?

**What to understand**: Idempotency in canvas mutations, the complexity of conflict resolution when merging AI-generated and user-created nodes, and why a clean-slate approach is simpler but less collaborative for iterative refinement.
