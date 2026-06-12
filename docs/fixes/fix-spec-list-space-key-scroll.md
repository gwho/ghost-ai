# Fix: spec list custom button scrolled on Space

## Finding Verification

The finding was still valid in current code.

`components/editor/ai-sidebar.tsx` renders each generated spec as a focusable custom button:

```tsx
role="button"
tabIndex={0}
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPreview(spec) }}
```

This opened the preview for Enter and Space, but Space did not call `preventDefault()`. On custom button-like elements, the browser still treats Space as a page scroll key unless default behavior is prevented.

## Fix

The keyboard handler now handles Space and Enter separately:

```tsx
onKeyDown={(e) => {
  if (e.key === ' ') {
    e.preventDefault()
    openPreview(spec)
  } else if (e.key === 'Enter') {
    openPreview(spec)
  }
}}
```

Space now behaves like activation without also scrolling the page. Enter still activates the preview normally.

## Why This Is Minimal

The fix does not change the list markup, styling, preview behavior, download behavior, or API calls. It only corrects keyboard behavior for the existing custom button.

A larger refactor could replace the wrapper `div` with a real `<button>`, but that would require checking nested button semantics because each list item already contains a download button. The minimal fix keeps the current structure and fixes the reported accessibility bug directly.

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint components/editor/ai-sidebar.tsx
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "Why does Space scroll the page on a focused `div`, but activate a native `<button>`?"
2. Ask: "What keyboard behavior should a custom `role=\"button\"` element implement?"
3. Ask: "Why are native buttons usually preferable to `div role=\"button\"`, and when can nested interactive controls complicate that choice?"
4. Ask: "What is the difference between `keydown` and `keyup` activation behavior for custom buttons?"
