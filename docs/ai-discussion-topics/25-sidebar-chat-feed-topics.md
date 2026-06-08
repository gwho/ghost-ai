# AI Discussion Topics — Feature 25: Sidebar Chat Feed

Use these prompts with the Ghost AI Architect to practice thinking about collaborative real-time systems and the design decisions in this feature.

---

## Conceptual Foundations

**1. What is a Liveblocks Feed and how does it differ from presence?**
> "Explain the difference between Liveblocks presence data and Liveblocks Feeds. When would you use each? Give me a concrete example for a collaborative design tool."

**2. Real-time vs. persisted messaging**
> "Compare ephemeral real-time messaging (like WebSocket broadcasts) with persisted message feeds (like Liveblocks Feeds). What are the trade-offs? When would you choose one over the other for a feature like room chat?"

**3. Why validate data from a feed?**
> "The Chat tab runs every incoming feed message through a Zod schema before rendering it. Why is this necessary even though we control what's written to the feed? What could go wrong without validation?"

---

## Architecture Decisions

**4. Why is the Chat tab separate from the AI Architect tab?**
> "The sidebar now has three tabs — AI Architect, Chat, and Specs. The AI Architect tab sends prompts to an AI agent; the Chat tab is for user-to-user messages. What are the benefits of keeping these separate instead of combining them in one tab? What would break if they shared the same input?"

**5. Feed scoping — room-level vs. global**
> "The `ai-chat` feed is scoped to a Liveblocks room (one workspace). What are the implications of this for multi-room products? How would you redesign this if users needed to see a global chat across all their workspaces?"

**6. Provider placement and component trees**
> "The `LiveblocksProvider` and `RoomProvider` live in `workspace-shell.tsx`, wrapping both the canvas and the sidebar. Why does their position in the component tree matter? What would break if `RoomProvider` were inside `CanvasWrapper` instead?"

---

## Implementation Patterns

**7. Optimistic vs. confirmed UI updates**
> "When a user sends a chat message via `createFeedMessage`, the message appears after Liveblocks confirms the write. Would optimistic rendering (showing the message immediately before confirmation) be better here? What are the risks?"

**8. Empty state design**
> "The Chat tab shows an empty state with a MessageSquare icon and a description when there are no messages. Why is an empty state important UX? What information should an empty state communicate to a first-time user?"

**9. Auto-scroll behavior**
> "After sending a message, the chat scrolls to the bottom using `scrollTo`. What edge cases exist with auto-scroll in a chat interface? For example: what should happen if the user has manually scrolled up to read old messages and a new message arrives?"

---

## Scaling and Edge Cases

**10. What happens when two users send at the same time?**
> "Two collaborators press Enter at the exact same millisecond. How does Liveblocks handle concurrent writes to the same feed? Is there any risk of data loss or ordering issues?"

**11. Message history limits**
> "Liveblocks stores all feed messages. What happens if a room accumulates thousands of messages over months? How would you add pagination or infinite scroll to the Chat tab?"

**12. User identity in the chat**
> "Messages are attributed to a sender name from `useSelf()`. What could go wrong if two collaborators have the same display name? How would you fix the `isOwn` bubble logic to be more robust?"
