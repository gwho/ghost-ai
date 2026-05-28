# Fix: Share Copy Timer Cleanup

## Finding

`components/editor/share-dialog.tsx` had a still-valid timer cleanup issue.
`handleCopy` stored a timeout in `copyTimer.current`, but the component did not
clear that timeout when `ShareDialog` unmounted.

## Decision

Add a small unmount-only `useEffect` cleanup dedicated to `copyTimer.current`.

## What Changed

The component now clears any active copy timeout and resets the ref to `null`
when it unmounts.

## Why

The timeout calls `setIsCopied(false)`. If the dialog component unmounts before
the timeout fires, the timer can outlive the component and attempt to update
state after unmount. Clearing it avoids stale timer work and keeps the ref from
pointing at an old timeout.

## How To Fix This Bug

1. Keep the existing `handleCopy` timer behavior.
2. Add an empty-dependency `useEffect` cleanup in `ShareDialog`.
3. In the cleanup, call `clearTimeout(copyTimer.current)` when present.
4. Set `copyTimer.current = null` after cleanup.

Skipped changing the fetch effect or copy fallback behavior because this finding
was only about unmount cleanup for the copy timeout.
