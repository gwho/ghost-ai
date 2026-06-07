# Plan: Fix `useRealtimeRun` Missing accessToken Error

## What Was the Problem?

When you open the editor page, React renders `AISidebar` immediately. Inside that component, there was this line running on every single render:

```tsx
useRealtimeRun(runId ?? '', {
  accessToken: publicToken ?? '',
  ...
})
```

At startup, `runId` and `publicToken` are both `null` (no AI run has been triggered yet). The `?? ''` fallback turns them into empty strings. Trigger.dev's `useRealtimeRun` hook then sees an empty `accessToken` and throws:

> "Missing accessToken in TriggerAuthContext or useApiClient options"

This crashes the whole page because the error bubbles up through the component tree.

There was even an old comment in the code saying "hook handles that gracefully" — but it doesn't.

---

## Why Can't You Just Wrap It in an `if`?

React has a strict rule: **hooks must be called the same number of times on every render**. You cannot do this:

```tsx
// NOT ALLOWED — violates Rules of Hooks
if (runId && publicToken) {
  useRealtimeRun(runId, { accessToken: publicToken })
}
```

If you skip a hook on one render and call it on the next, React loses track of which hook is which and will throw a different error.

---

## The Solution: Child Component Pattern

The idiomatic fix is to move `useRealtimeRun` into a tiny **child component** (`RunTracker`) and only **mount** that component when we have a real token. This is valid because:

- Inside `RunTracker`, the hook is called on every render of `RunTracker` (consistent ✓)
- `RunTracker` itself only exists in the DOM when `runId && publicToken` are both truthy

```tsx
function RunTracker({ runId, publicToken, onComplete }) {
  useRealtimeRun(runId, {
    accessToken: publicToken,
    onComplete: (run) => onComplete(run.status === 'COMPLETED'),
  })
  return null  // renders nothing — it's just a "behaviour component"
}

// Inside AISidebar's JSX:
{runId && publicToken && (
  <RunTracker runId={runId} publicToken={publicToken} onComplete={handleRunComplete} />
)}
```

When a user submits a prompt, `runId` and `publicToken` get set → `RunTracker` mounts → subscription starts. When the run completes, `handleRunComplete` sets both back to `null` → `RunTracker` unmounts → subscription stops automatically.

---

## File Changed

- `components/editor/ai-sidebar.tsx`
