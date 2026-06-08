# Fix: Workspace Toolbar Dialog Buttons `aria-haspopup`

## What Was Wrong

`components/editor/workspace-shell.tsx` has two toolbar buttons that open dialogs:

- `Templates` opens the starter templates modal.
- `Share` opens the share dialog.

Before this fix, both buttons opened dialog UI but did not declare that behavior
to assistive technology:

```tsx
<button
  type="button"
  onClick={() => setIsTemplatesOpen(true)}
>
  <LayoutTemplate className="h-4 w-4" />
  Templates
</button>

<button
  type="button"
  onClick={() => setIsShareOpen(true)}
>
  <Share2 className="h-4 w-4" />
  Share
</button>
```

For sighted mouse users, the result is usually understandable after activation:
a dialog appears. For screen reader users, it is better for the control to expose
that it opens a dialog before activation.

| File | Finding | Runtime Evidence | Status |
| --- | --- | --- | --- |
| `components/editor/workspace-shell.tsx` | `Templates` opened a dialog without `aria-haspopup="dialog"` | Debug log showed `Templates` with `ariaHaspopup: null` | Fixed |
| `components/editor/workspace-shell.tsx` | `Share` opened a dialog without `aria-haspopup="dialog"` | Debug log showed `Share` with `ariaHaspopup: null` | Fixed |

---

## Runtime Evidence

Debug instrumentation inspected the rendered toolbar buttons. The relevant
entries were:

```json
{"text":"Templates","ariaHaspopup":null,"opensDialog":true}
{"text":"Share","ariaHaspopup":null,"opensDialog":true}
```

That confirmed the issue existed at runtime, not just in source code.

---

## The Fix

Add `aria-haspopup="dialog"` to both dialog-opening buttons:

```tsx
<button
  type="button"
  onClick={() => setIsTemplatesOpen(true)}
  aria-haspopup="dialog"
>
```

```tsx
<button
  type="button"
  onClick={() => setIsShareOpen(true)}
  aria-haspopup="dialog"
>
```

No click behavior, styling, state, or dialog implementation changed. The fix only
adds the missing accessibility metadata.

---

## Why This Approach

### Why `aria-haspopup="dialog"`?

`aria-haspopup` tells assistive technology that activating a control opens a
popup-like surface. The value `"dialog"` is the most specific value for controls
that open modal/dialog UI.

This gives screen reader users extra context before they activate the button:

```text
Templates, button, has popup dialog
Share, button, has popup dialog
```

### Why not add it to every toolbar button?

Only controls that open popup/dialog UI should use `aria-haspopup`. The Save and
AI buttons do not open these dialogs:

- `Save` runs an action.
- `AI` toggles a sidebar.

Adding `aria-haspopup="dialog"` to those would be inaccurate. Accessibility
attributes should describe real behavior, not just make the markup look more
complete.

---

## Beginner Mental Model: ARIA Describes Behavior, Not Style

ARIA attributes do not change what the app looks like. They describe behavior to
assistive technology.

In this case, the visual UI already had buttons that opened dialogs. The missing
piece was semantic:

```text
Visual behavior: clicking opens a dialog
ARIA behavior: screen reader is told this button opens a dialog
```

When visual behavior and semantic behavior match, users relying on assistive
technology get the same expectations as sighted users.

---

## Validation

- Runtime debug log confirmed both buttons were missing `aria-haspopup` before
  the fix.
- IDE diagnostics for `components/editor/workspace-shell.tsx`: no linter errors.
- Project ESLint passed:

```sh
npm --prefix "/Users/jessejames/Desktop/ghost-ai/my-app-ghost" run lint -- components/editor/workspace-shell.tsx
```

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/workspace-shell.tsx` | Added `aria-haspopup="dialog"` to the Templates and Share toolbar buttons |
| `docs/fixes/fix-workspace-toolbar-dialog-aria-haspopup.md` | Added this fix log |
