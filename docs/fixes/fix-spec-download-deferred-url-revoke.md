# Fix: spec downloads could revoke Blob URLs too early

## Finding Verification

The finding was still valid in current code.

`components/editor/ai-sidebar.tsx` created a Blob URL for downloaded Markdown, assigned it to a temporary anchor, called `a.click()`, and immediately called `URL.revokeObjectURL(url)`.

That can be flaky because the browser may not have started reading the Blob URL by the time JavaScript revokes it. The result can be an empty or failed download in some browser engines.

## Fix

The download helper now:

1. Creates the Blob URL.
2. Creates a temporary anchor.
3. Appends the anchor to `document.body`.
4. Clicks the anchor.
5. Removes the anchor in a `finally` block.
6. Defers `URL.revokeObjectURL(url)` with `window.setTimeout(..., 0)`.

This preserves the same UI behavior while giving the browser a chance to start the download before the object URL is released.

## Why This Is Minimal

No API routes, storage behavior, spec data shape, or UI state changed. The patch only changes the browser-side mechanics of the existing download click.

The `finally` block is intentional: even if the synthetic click throws, the temporary DOM node is removed and the Blob URL is scheduled for cleanup.

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint components/editor/ai-sidebar.tsx
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "How do Blob URLs work in the browser, and why do they need to be revoked?"
2. Ask: "Why can revoking an object URL immediately after `a.click()` cause flaky downloads?"
3. Ask: "What is the event loop difference between synchronous code, microtasks, and `setTimeout(..., 0)`?"
4. Ask: "When is it useful to append a temporary anchor to the DOM before triggering a browser download?"
