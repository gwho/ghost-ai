# Fix: Share Link Copy Fallback

## Finding

`components/editor/share-dialog.tsx` had a still-valid issue in `handleCopy`:
it called `navigator.clipboard.writeText(url)` directly, then immediately ran
`setIsCopied(true)`.

That meant the UI could show `Copied!` even when the Clipboard API was missing,
blocked by browser permissions, unavailable outside a secure context, or rejected
for another reason.

## Decision

Keep the fix minimal and local to copy behavior:

- Try `navigator.clipboard.writeText` first when it exists.
- If it is unavailable or throws, fall back to a temporary `<textarea>` plus
  `document.execCommand('copy')`.
- If both copy paths fail, show the URL in `window.prompt` as a last-resort manual
  copy path.
- Only call `setIsCopied(true)` after a confirmed copy.
- Clear `copyTimer.current` before each attempt and reset it after the success
  timeout or failed copy path.

Skipped broader changes such as adding toast errors or changing dialog state
because the requested issue was isolated to copy reliability.
