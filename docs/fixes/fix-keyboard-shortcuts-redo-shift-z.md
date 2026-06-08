# Fix: Keyboard Shortcuts — Cmd/Ctrl+Shift+Z Redo

## What Was Wrong

`hooks/useKeyboardShortcuts.ts` handles canvas keyboard shortcuts such as zoom,
undo, and redo.

The undo and redo checks looked like this:

```ts
if (meta && !e.shiftKey && e.key === 'z') {
  e.preventDefault()
  undo()
  return
}
if (meta && e.shiftKey && e.key === 'z') {
  e.preventDefault()
  redo()
  return
}
```

The redo branch was fragile because pressing Shift can make `KeyboardEvent.key`
report an uppercase value. In that case:

```ts
e.key === 'Z'
```

So this comparison fails:

```ts
e.key === 'z'
```

That means `Cmd+Shift+Z` on macOS or `Ctrl+Shift+Z` on Windows/Linux could fail
to trigger `redo()`, even though it is the standard redo shortcut.

| File | Finding | Status |
| --- | --- | --- |
| `hooks/useKeyboardShortcuts.ts` | Redo branch compared shifted key directly to lowercase `'z'` | Fixed |
| `hooks/useKeyboardShortcuts.ts` | Undo branch also compared directly to lowercase `'z'` | Fixed defensively |

---

## The Fix

Normalize the key once near the top of the handler:

```ts
const key = e.key.toLowerCase()
```

Then use the normalized `key` value for the two `z` shortcut checks:

```ts
if (meta && !e.shiftKey && key === 'z') {
  e.preventDefault()
  undo()
  return
}
if (meta && e.shiftKey && key === 'z') {
  e.preventDefault()
  redo()
  return
}
```

The existing `e.preventDefault()` and `return` behavior is preserved exactly.
The rest of the shortcut logic is intentionally unchanged.

---

## Why This Approach

### Why normalize with `toLowerCase()`?

Keyboard shortcuts care about the physical intent, not the letter casing. For
undo/redo, both of these should be treated as the same base key:

```ts
'z'
'Z'
```

`toLowerCase()` gives the handler one stable value to compare against:

```ts
const key = e.key.toLowerCase()
```

Now the branch can ask one simple question:

```ts
key === 'z'
```

That works whether Shift changed the reported key to uppercase or not.

### Why normalize both undo and redo?

The reported failure is most visible in the redo branch, because redo requires
Shift. But using the normalized key for both undo and redo keeps the paired
checks consistent. Both branches are about the same base key (`z`), with
`e.shiftKey` deciding whether the action is undo or redo.

### Why not change the other shortcuts?

The report was specifically about `z` shortcut casing. The zoom checks (`+`,
`=`, `-`) and the alternate redo shortcut (`Cmd/Ctrl+Y`) were already outside
the reported failure. Keeping those comparisons unchanged keeps the patch small
and avoids changing unrelated keyboard behavior.

---

## Beginner Mental Model: `e.key` Means "The Character Produced"

`KeyboardEvent.key` is not always the physical key label. It represents the
character or key value produced by the event.

For letter keys:

```text
Press z          -> e.key may be "z"
Press Shift + z  -> e.key may be "Z"
```

That is useful when typing into text fields, because the browser needs to know
whether to insert `z` or `Z`. But keyboard shortcuts usually care about the
base key, not the typed character. For shortcuts, normalizing case is usually
the safest approach.

The pattern is:

```ts
const key = e.key.toLowerCase()

if (meta && key === 'z') {
  // handle shortcut
}
```

This keeps shortcut behavior stable across shifted and unshifted key events.

---

## Beginner Mental Model: Modifier Keys Decide the Action

The hook uses two pieces of information:

```ts
const meta = e.metaKey || e.ctrlKey
const key = e.key.toLowerCase()
```

Then it combines that with `e.shiftKey`:

| Shortcut | Conditions | Action |
| --- | --- | --- |
| `Cmd/Ctrl+Z` | `meta && !e.shiftKey && key === 'z'` | `undo()` |
| `Cmd/Ctrl+Shift+Z` | `meta && e.shiftKey && key === 'z'` | `redo()` |

The base key (`z`) selects the shortcut family. The Shift modifier selects the
direction: undo or redo.

---

## Validation

- IDE diagnostics for `hooks/useKeyboardShortcuts.ts`: no linter errors.
- File-scoped ESLint passed:

```sh
npm --prefix "/Users/jessejames/Desktop/ghost-ai/my-app-ghost" run lint -- hooks/useKeyboardShortcuts.ts
```

---

## Files Changed

| File | Change |
| --- | --- |
| `hooks/useKeyboardShortcuts.ts` | Added `const key = e.key.toLowerCase()` and used it for the undo/redo `z` comparisons |
| `docs/fixes/fix-keyboard-shortcuts-redo-shift-z.md` | Added this beginner-friendly fix log |
