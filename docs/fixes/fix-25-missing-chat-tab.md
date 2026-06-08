# Fix: Missing Chat Tab in AI Sidebar (Feature 25)

**Date:** 2026-06-08  
**File fixed:** `components/editor/ai-sidebar.tsx`

---

## What Was Wrong

Opening the workspace and clicking the AI button showed a sidebar with only **two tabs**: "AI Architect" and "Specs". There was no "Chat" tab.

Feature 25 specified a dedicated Chat tab for real-time room messaging. The Liveblocks `ai-chat` feed was technically wired up (hooks imported, feed created on mount, messages subscribed), but the feed display and input were embedded inside the "AI Architect" tab — not in their own labeled tab. The feature existed in the code but was invisible in the UI.

There was also a second bug: the send function wrote to the chat feed **and** triggered the AI design agent in the same call. The spec says "don't trigger backend AI tasks" from the chat feed — these two actions were incorrectly merged.

---

## What We Fixed

### 1. Added the Chat tab

Changed `grid-cols-2` to `grid-cols-3` in the `TabsList` and inserted a new `TabsTrigger` and `TabsContent` for "Chat" between "AI Architect" and "Specs".

### 2. Moved feed display to Chat tab

The scrollable message list (`useFeedMessages('ai-chat')`, message bubbles, sender/timestamp) was moved from the "AI Architect" tab into the new "Chat" tab, along with its own input area.

### 3. Split the submit function

**Before** — one function doing two unrelated things:
```tsx
const submit = async () => {
  await createFeedMessage(CHAT_FEED_ID, { sender, content, ... }) // chat feed
  onSubmit?.(trimmed)                                              // AI trigger
}
```

**After** — two focused functions:
```tsx
// AI Architect tab
const submitAi = async () => {
  onSubmit?.(trimmed)  // only triggers the AI
}

// Chat tab
const submitChat = async () => {
  await createFeedMessage(CHAT_FEED_ID, { ... })  // only writes to feed
}
```

### 4. Simplified AI Architect tab

With the feed display moved out, "AI Architect" now shows only the starter chips, status banner, and the AI prompt input. It no longer mixes AI-prompting with collaborative chat.

---

## Why This Happened

The original implementation made a reasonable shortcut: the "AI Architect" tab already had a scrollable area and an input, so the developer added the feed display there instead of creating a new tab. The Liveblocks hooks were set up correctly — the issue was purely a UI structure decision that didn't match the spec's intent or the expected user experience.

The conflation of `createFeedMessage` and `onSubmit` in the same handler was another consequence of that same shortcut — one input was doing two jobs.

---

## The Reusable Lesson

**"Wired" and "visible" are not the same thing.** A feature can be fully implemented at the data/hook level and still be invisible to users because the UI doesn't expose it clearly. Always check whether the feature is findable by a user who hasn't read the code — not just whether it compiles and runs.

**One function, one job.** When a handler does two things (chat feed write + AI trigger), it violates both the spec's scope limits and the single-responsibility principle. Split functions with clear names (`submitAi`, `submitChat`) make the intent obvious and make future changes safe — modifying one doesn't accidentally affect the other.
