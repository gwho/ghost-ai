# AI Discussion Topics — Feature 24: AI Presence State

## 1. Why use Liveblocks presence for `thinking` instead of a room event?

**The distinction:** Presence is per-user state that Liveblocks automatically cleans up when a participant disconnects. Room events are fire-and-forget broadcasts — they're not stored and don't survive reconnects.

**Why `thinking` belongs in presence:** If the browser tab closes mid-generation, we want the thinking indicator to disappear automatically. If we put it in a room event, we'd need to manually broadcast a "done" event on disconnect — which can't happen if the tab closes. Presence handles this for free.

**Discussion:** When would you put AI state in a room event vs. presence? What other AI state might belong in presence vs. a broadcast event?

---

## 2. Why validate incoming Liveblocks events at the boundary?

**The event type gives you TypeScript safety at compile time, not runtime.** A `RoomEvent` typed as `{ type: 'ai-status'; message: string; status: '...' }` tells TypeScript what shape to expect in your event handler — but Liveblocks doesn't validate the actual bytes that arrive over the wire. A misconfigured server, a future code change, or a malicious actor could broadcast a malformed event.

**The `validateAiStatusPayload` function** in `types/tasks.ts` is a type guard that checks the real shape of the data before the UI touches it. This is the same principle as validating API response bodies before rendering them.

**Discussion:** What's the difference between TypeScript types (compile-time) and runtime validation? Can you think of other places in this codebase where runtime validation would add safety?

---

## 3. Status messages: latest only vs. full history

**The current approach** shows only the most recent status message from the ai-status-feed as a chip above the input. Older status messages are discarded from the UI (though `aiMessages` in `workspace-shell.tsx` keeps the full array in memory).

**Alternative:** Show all status messages as a scrollable log in the sidebar — like a "build output" panel. This gives more transparency into what the AI is doing step by step.

**Trade-off:** The spec calls for "show only the most recent status message." Full history can be useful for debugging but makes the sidebar feel more like a terminal than a chat UI. The single-chip approach is friendlier for non-technical collaborators.

**Discussion:** When would you want a full log vs. just the latest? How would you toggle between the two without cluttering the UI?

---

## 4. The feed is generic — what comes next?

The spec says "keep the feed generic enough for design and spec generation later." The current `AiStatusPayload` has a `text?: string` field that's unused today. Future AI features (like spec generation) could use this field to carry richer output — partial markdown, token counts, step labels — without changing the event type.

**Discussion:** What would a spec-generation status event look like? How would you extend `AiStatusPayload` to support multiple AI task types without breaking existing consumers?

---

## 5. Why disable the input during generation instead of queuing?

**Current behavior:** The textarea and send button are disabled while `isAiThinking` is true. The user has to wait for the current generation to finish before sending another prompt.

**Alternative:** Queue the next prompt and send it automatically when the current one finishes.

**Trade-off:** Queuing adds complexity (what if the user changes their mind mid-queue? what if the agent fails?). Disabling is simpler and forces the user to review the result before sending the next prompt — which is better for a design tool where each generation changes the canvas significantly.

**Discussion:** Are there scenarios where queuing makes more sense than blocking? How would you design a cancellation button alongside queuing?
