# Fix: Manual Save Handles Promise Rejections

## Finding Verification

The finding was still valid in `components/editor/workspace-shell.tsx`.

`handleManualSave` called `saveRef.current?.()` without awaiting or catching the returned promise.

## What Was Wrong

`saveRef.current` points to the canvas save function from `useCanvasAutosave`. That hook already catches normal fetch failures and sets the save status to `error`.

However, the parent click handler still discarded the promise. If `save()` ever rejects unexpectedly, the rejection can become unhandled and the toolbar can remain in an inconsistent state.

## What Changed

`handleManualSave` is now async and wraps the save call in `try/catch`:

```ts
try {
  await saveRef.current?.()
} catch {
  setSaveStatus('error')
}
```

This keeps the existing save implementation as the owner of normal save status updates while giving the toolbar a parent-level fallback for unexpected failures.

## Suggested AI Discussion Topics

1. Why should event handlers handle returned promises even when the called function has internal error handling?
2. What is the difference between expected network failures and unexpected promise rejections?
3. When is a small parent-level error boundary preferable to moving all error handling into a hook?

## Validation

- `npx eslint components/editor/workspace-shell.tsx`
- `npx tsc --noEmit --pretty false`
