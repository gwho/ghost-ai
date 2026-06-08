# Plan: Fix — AI Architect Tab Messages Vanish and No Visual Feedback

## Problem

Two related bugs in the AI Architect tab (`components/editor/ai-sidebar.tsx`):

1. **Messages disappear after sending** — after submitting a design prompt, previously visible messages vanish from the conversation view.
2. **No visual response** — despite the design agent running successfully on the backend (the canvas updates via Liveblocks), the sidebar shows no loading state, no completion message, and no AI response.

## Root Cause

### Component tree

```
WorkspaceShell
  └── LiveblocksProvider
        └── RoomProvider (id=project.id)
              ├── CanvasWrapper → CanvasFlow
              └── ClientSideSuspense (fallback=null)
                    └── AISidebar
                          ├── useFeedMessages (architect feed)
                          └── RunTracker (conditional)
                                └── useRealtimeRun (Trigger.dev)
```

`RunTracker` is a child of `AISidebar`, which is wrapped in `ClientSideSuspense fallback={null}`. Any suspense or uncaught error from `useRealtimeRun` propagates to this boundary, blanking the entire sidebar.

### Bug 1 — messages disappear

1. User submits prompt → `submitAi()` writes user message to `ai-architect-feed`
2. API calls succeed → `setRunId(...)`, `setPublicToken(...)`, `setIsLoading(true)` trigger re-renders
3. `RunTracker` mounts → `useRealtimeRun` initializes its WebSocket subscription
4. If `useRealtimeRun` throws a suspense promise or runtime error, it propagates to `ClientSideSuspense`
5. `ClientSideSuspense` catches → renders `fallback={null}` → `AISidebar` unmounts
6. All local state is lost (`runId`, `publicToken`, `isLoading` reset to defaults)
7. When resolved, `AISidebar` remounts fresh → `useFeedMessages` re-subscribes with a visible flash

Prior evidence: `fix-realtime-run-access-token.md` documents `useRealtimeRun` crashing the page with empty strings. The `RunTracker` child-component pattern was introduced to fix that, but it was placed inside the same `ClientSideSuspense` boundary.

### Bug 2 — no visual response

When `AISidebar` remounts after a re-suspension, `runId` and `publicToken` reset to `null`, so `RunTracker` does not mount again. Nobody listens for the run completion. `handleRunComplete` never fires, no AI message is posted, and `isLoading` stays `false`.

Additionally, the `onComplete` callback passed to `useRealtimeRun` is captured by closure on mount. If the hook stores it internally without updating on re-renders, it becomes stale.

## Fix

All changes in `components/editor/ai-sidebar.tsx`.

### Step 1: Isolate RunTracker with its own Suspense + Error Boundary

Wrap `RunTracker` in a dedicated `<Suspense>` boundary so that suspense or errors from `useRealtimeRun` do not propagate to the `ClientSideSuspense` wrapping the whole sidebar.

Add a lightweight `RunTrackerErrorBoundary` class component that catches runtime errors and renders nothing instead of crashing the tree.

### Step 2: Harden RunTracker with useRef for the callback

Store the `onComplete` callback in a ref inside `RunTracker` to prevent stale closure issues. Update the ref on every render so the latest callback is always used.

### Step 3: Add useEffect fallback for run status detection

Instead of relying solely on the `onComplete` option (which may not fire reliably), also return `run` from `useRealtimeRun` and watch `run.status` via a `useEffect`. Use a `firedRef` guard to ensure completion logic runs exactly once.

### Step 4: Persist run state in sessionStorage to survive re-mounts

Store `runId` and `publicToken` in `sessionStorage` keyed by `roomId`. On mount, check sessionStorage for an in-progress run and restore the values. On completion, clear the stored values.

## Scope

- No backend changes
- No other frontend files affected
- No changes to the Chat or Specs tabs

## Verification

- Submitting a prompt shows the user message immediately and it persists
- The loading spinner appears while the run is active
- The AI completion message appears when the run finishes
- Previous messages do not disappear when sending a new one
- Errors from `useRealtimeRun` do not crash the sidebar
- Feed messages persist across page reloads via Liveblocks
