# AI Discussion Topics — Feature 25: Sidebar Chat Feed & Provider Hierarchy

Use these questions in conversation with an AI to deepen your understanding of the concepts introduced in Feature 25 and the follow-up fix.

---

## React Context & Provider Trees

1. **What is a React context, and how does `createContext` + `useContext` work under the hood?** Ask the AI to show a minimal example from scratch — no libraries — so you see the raw pattern before Liveblocks adds its own layer.

2. **Why can't a sibling component read a provider's context?** Draw a simple tree on paper (or ask the AI to draw one in text), then ask the AI to explain exactly where context values propagate and where they stop.

3. **What happens if you call `useContext` without a matching provider above it?** Ask the AI to show what the error looks like and why React throws it instead of just returning `undefined`.

4. **If you have two providers for the same context, which one wins?** Explore what happens when providers nest: which ancestor does `useContext` find first?

---

## Suspense & `ClientSideSuspense`

5. **What does it mean for a component to "suspend"?** Ask the AI to explain React Suspense without any library — just `use(promise)` or a manual throw — so you understand the mechanism before seeing it in Liveblocks.

6. **What is `<Suspense fallback={...}>` and why does every suspending component need one above it in the tree?** Ask the AI to trace what happens if there is no boundary: which component crashes, and what does the error look like?

7. **Why does `fallback={null}` make sense for the AI sidebar but `fallback={<ConnectingSpinner />}` makes sense for the canvas?** Explore the UX tradeoff: blank vs. loading indicator for two parts of the same page.

8. **Can you have multiple `Suspense` boundaries in one page, each showing a different fallback?** Ask the AI to show an example with two independent suspended components, each with its own boundary.

---

## Liveblocks Architecture

9. **What is the difference between `LiveblocksProvider` and `RoomProvider`?** Ask the AI to explain each one's responsibility and what breaks if you swap their order or nest them wrong.

10. **What is a Liveblocks Feed, and how is it different from Presence or Storage?** Ask about the tradeoffs — when would you use a Feed instead of Presence? What does "persisted" vs "ephemeral" mean in a real-time system?

11. **Why does `useFeedMessages` return an array that updates in real time without polling?** Ask the AI to explain how Liveblocks pushes updates through a WebSocket and how React state gets updated when a collaborator sends a message.

12. **How does `useSelf()` know who "I" am?** Trace the auth flow: from the auth endpoint (`/api/liveblocks-auth`) to `prepareSession` to the Liveblocks room token, and how `name` and `avatar` end up on the `me` object.

---

## Zod Validation Pattern

13. **Why validate feed messages with Zod before rendering them?** Ask the AI to describe what could go wrong if you skip validation — old schema versions, unexpected payloads, injection-style attacks through shared rooms.

14. **What is the `.filter()` call doing in this pattern?**
    ```ts
    .filter((m): m is { id: string; data: NonNullable<...> } => m.data !== null)
    ```
    Ask the AI to explain what the TypeScript type predicate `: m is {...}` does and why the plain `.filter(m => m.data !== null)` doesn't narrow the type without it.

---

## Design Decisions to Debate

15. **Should `RoomProvider` live in `workspace-shell.tsx` or even higher — like the editor layout?** What are the tradeoffs of lifting it higher vs. keeping it scoped to a single workspace page?

16. **Why keep `ai-chat` and the AI status broadcast as two separate channels?** When would merging them into a single feed make sense? What would break?

17. **The sidebar uses `fallback={null}` (nothing shown while connecting). Should it show a skeleton or spinner instead?** What would the user experience be in each case — especially on a slow connection?
