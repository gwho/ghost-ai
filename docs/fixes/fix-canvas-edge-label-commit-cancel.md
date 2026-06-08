# Fix: Canvas Edge Label Commit and Cancel Behavior

## What Was Wrong

`components/editor/canvas-edge.tsx` lets users edit an edge label through an
inline input. Before this fix, the input persisted every keystroke:

```tsx
onChange={(e) => {
  setDraft(e.target.value)
  updateEdgeData(id, { label: e.target.value })
}}
```

That caused two related problems.

### Problem 1: Every intermediate edit was saved

Typing `Database` saved a sequence like:

```text
D
Da
Dat
Data
Datab
Databa
Databas
Database
```

The UI should treat label editing like a small form: keep the text local while
the user types, then save once when the user commits the edit.

### Problem 2: Escape could not cancel

The Escape key only closed the editor:

```tsx
if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
```

But because `onChange` had already persisted each typed character, Escape had
nothing left to cancel. The original label was already overwritten.

| File | Finding | Status |
| --- | --- | --- |
| `components/editor/canvas-edge.tsx` | `onChange` called `updateEdgeData` every keystroke | Fixed |
| `components/editor/canvas-edge.tsx` | Escape closed editing without restoring the original label | Fixed |
| `components/editor/canvas-edge.tsx` | Enter/blur needed explicit commit behavior | Fixed |

---

## The Fix

### Fix 1: `onChange` only updates local draft state

```tsx
onChange={(e) => setDraft(e.target.value)}
```

Typing now updates only the React state used by the input. Nothing is persisted
to the edge data until the user commits.

### Fix 2: Blur commits the draft

```tsx
onBlur={() => {
  if (skipBlurCommitRef.current) {
    skipBlurCommitRef.current = false
    return
  }
  updateEdgeData(id, { label: draft })
  setEditing(false)
}}
```

Clicking away from the input saves the current draft and exits editing.

### Fix 3: Enter commits the draft

```tsx
if (e.key === 'Enter') {
  skipBlurCommitRef.current = true
  updateEdgeData(id, { label: draft })
  setEditing(false)
  return
}
```

Enter saves the draft immediately and exits editing.

### Fix 4: Escape restores the original label and does not persist

```tsx
if (e.key === 'Escape') {
  skipBlurCommitRef.current = true
  setDraft(label)
  setEditing(false)
}
```

Escape restores the incoming `label` value and closes the editor without calling
`updateEdgeData`.

### Fix 5: A small blur guard prevents accidental double commits

When Enter or Escape exits editing, the input can also blur as it unmounts. A
ref tracks that the key handler already handled the outcome:

```tsx
const skipBlurCommitRef = useRef(false)
```

If the next blur was caused by Enter or Escape, `onBlur` skips its own commit
and resets the ref.

---

## Why This Approach

### Why keep `draft` local while typing?

This separates two concepts:

| Concept | Meaning |
| --- | --- |
| `draft` | What the user is currently typing |
| `label` | The committed edge label stored in React Flow / Liveblocks |

This is the same pattern used by many form UIs. The user can freely edit the
draft, and the app only updates persisted state when the user commits.

### Why restore `label` on Escape?

`label` is the last committed value passed into the edge component. That makes it
the correct rollback target. Escape means "cancel my in-progress edit," so the
input should go back to the last saved value, not keep the partially typed text.

### Why use a ref for the blur guard?

`useRef` is ideal for this because the flag is not visual UI state. Changing it
does not need to re-render the component. It only coordinates event order between
`onKeyDown` and `onBlur`.

Without the guard, this sequence can happen:

```text
Press Enter
  -> onKeyDown commits
  -> setEditing(false) unmounts input
  -> input blurs
  -> onBlur commits again
```

The guard keeps the explicit key action from being repeated by blur.

---

## Beginner Mental Model: Draft State vs Committed State

When editing text, there are often two versions of the value:

```text
Committed value: "API Gateway"
Draft value:     "API Gatewa"
```

The committed value is what the rest of the app should trust. The draft value is
temporary. It belongs to the editor while the user is typing.

Good editable UI usually follows this flow:

```text
Start editing -> copy committed value into draft
Type          -> update draft only
Enter/blur    -> copy draft into committed value
Escape        -> throw draft away and keep committed value
```

This makes Escape meaningful because the app still has a clean committed value
to return to.

---

## Beginner Mental Model: Event Order Can Surprise You

Keyboard and focus events can happen back-to-back. If pressing a key closes an
input, the browser may also fire `blur` because the focused input disappeared.

That means this code:

```tsx
onKeyDown={commit}
onBlur={commit}
```

can accidentally commit twice unless you coordinate the two handlers. A ref is a
simple way to say:

```text
The key handler already handled this edit. If blur fires next, skip it once.
```

---

## Suggested Topics To Discuss With LLMs

To learn more, ask an LLM about these topics:

- "Explain draft state vs committed state in React form inputs with examples."
- "Why should Escape cancel an inline edit instead of saving it?"
- "How do React `onKeyDown`, `onBlur`, and component unmount order interact?"
- "When should I use `useRef` instead of `useState` for event coordination?"
- "How do undo stacks get affected when form inputs persist every keystroke?"

---

## Validation

- Project ESLint passed for the changed file:

```sh
npm --prefix "/Users/jessejames/Desktop/ghost-ai/my-app-ghost" run lint -- components/editor/canvas-edge.tsx
```

- IDE diagnostics still show Microsoft Edge Tools warnings about existing inline
  styles in this React Flow/SVG component. Those warnings are unrelated to this
  fix and are not reported by the project ESLint command.

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/canvas-edge.tsx` | Changed edge label editing so typing updates local draft only; blur/Enter commit; Escape restores the original label; blur guard prevents double commit |
| `docs/fixes/fix-canvas-edge-label-commit-cancel.md` | Added this beginner-friendly fix log |
