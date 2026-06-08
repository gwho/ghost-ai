# Fix: Realtime Run Error Clears AI Loading State

## Finding Verification

The finding was still valid in `components/editor/ai-sidebar.tsx`.

`RunTracker` called `useRealtimeRun(runId, { accessToken: publicToken })` but only destructured `{ run }`. The Trigger.dev hook can also return `error`, and the component did not observe it.

## What Was Wrong

The sidebar already handled terminal run statuses:

```ts
if (TERMINAL_STATUSES.has(run.status)) {
  firedRef.current = true
  onCompleteRef.current(run.status === 'COMPLETED')
}
```

That path only runs when a realtime subscription produces a `run` update. If the subscription itself fails and returns an `error`, the completion handler is never called.

The result is a stuck UI state: the AI Architect input can remain disabled, AI thinking presence can stay active, and the persisted run can remain in session storage until some other completion signal clears it.

## What Changed

`RunTracker` now destructures `error` from `useRealtimeRun` and watches it in a small effect.

When `error` becomes truthy, the component:

- checks `firedRef.current` to avoid duplicate completion
- marks the tracker as fired
- calls `onCompleteRef.current(false)`

This reuses the existing failure completion path instead of adding separate cleanup logic.

## Why This Fixes It

`onCompleteRef.current(false)` points to the sidebar's existing failed-run handler. That handler already clears the active run, resets loading state, removes the persisted run, clears tracking warnings, and turns off AI thinking presence.

Using the existing `firedRef` also keeps Trigger realtime and Liveblocks fallback completion from racing into duplicate assistant messages.

## Suggested AI Discussion Topics

1. Why should subscription errors be treated differently from task failures in user-facing copy?
2. When is it better to route a new failure mode through an existing completion handler instead of adding new state?
3. How do refs like `onCompleteRef` and `firedRef` prevent stale callbacks and duplicate async completion?

## Validation

- `npx eslint components/editor/ai-sidebar.tsx`
- `npx tsc --noEmit --pretty false`
