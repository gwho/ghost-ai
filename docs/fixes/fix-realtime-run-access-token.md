# Fix: `useRealtimeRun` Missing accessToken (Runtime Crash on Editor Load)

## The Error

```
Missing accessToken in TriggerAuthContext or useApiClient options

at AISidebar (components/editor/ai-sidebar.tsx:86:17)
```

This crashed the editor page immediately on load, before any user action.

---

## What Changed

**File:** `components/editor/ai-sidebar.tsx`

### Removed (the broken code)

```tsx
useRealtimeRun(runId ?? '', {
  accessToken: publicToken ?? '',
  onComplete: (completedRun) => {
    handleRunComplete(completedRun.status === 'COMPLETED')
  },
})
```

This was called unconditionally on every render. On the first render, both `runId` and `publicToken` are `null`, so empty strings were passed. Trigger.dev rejects empty tokens and throws.

### Added (the fix)

A small child component called `RunTracker` that owns the `useRealtimeRun` call:

```tsx
function RunTracker({ runId, publicToken, onComplete }) {
  useRealtimeRun(runId, {
    accessToken: publicToken,
    onComplete: (completedRun) => {
      onComplete(completedRun.status === 'COMPLETED')
    },
  })
  return null
}
```

And inside `AISidebar`'s JSX, it's only mounted when both values are real:

```tsx
{runId && publicToken && (
  <RunTracker runId={runId} publicToken={publicToken} onComplete={handleRunComplete} />
)}
```

---

## Why It Broke

Two things went wrong together:

1. **Trigger.dev rejects empty tokens** — `useRealtimeRun` throws immediately if `accessToken` is `''` or falsy. It does not silently no-op.
2. **React's Rules of Hooks prevent conditional calls** — you cannot put `if (runId) { useRealtimeRun(...) }` inside a component. Hooks must run on every render of the component that contains them.

The old code tried to work around #2 by passing `''` as a "do nothing" value, assuming #1 wasn't a problem. That assumption was wrong.

---

## The Reusable Lesson

**When a hook requires a real value to function, put it in a child component and conditionally render that component.**

This is a general React pattern, not just Trigger.dev-specific. You'll see it with:
- `useRealtimeRun` / `useRealtimeStream` from Trigger.dev (need a valid token)
- Subscription hooks that should only be active when a resource ID exists
- Any hook that throws or misbehaves with placeholder/empty values

The child component acts as a gate: it only exists when its inputs are valid, so the hook inside it always receives good data.

---

## Suggested AI Discussion Topics

- **React Rules of Hooks**: Why can hooks not be called conditionally? What problem does that rule prevent?
- **Component as a behaviour boundary**: What does it mean for a component to `return null`? When is that a useful pattern?
- **Trigger.dev token lifecycle**: Why does the token need to be scoped to a specific `runId`? What would happen if we used a general API key on the frontend instead?
- **Error boundaries**: This error crashed the whole page. How could you add a React Error Boundary around `AISidebar` so that a future Trigger.dev error doesn't take down the entire editor?
- **Auth context vs. prop drilling**: Trigger.dev offers `TriggerProvider` as a context-based alternative to passing `accessToken` per-hook. When would the context approach be better? When would prop-passing be better?
