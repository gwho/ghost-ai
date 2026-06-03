# Fix: Canvas Edge Label Keyboard Accessibility

## What Was Wrong

In `components/editor/canvas-edge.tsx`, the edge label could only be opened for
editing by **double-clicking** it with a mouse. There was no way for a keyboard
user to activate the same "start editing" flow. This violates the core
accessibility rule that every interactive element must be reachable and operable
without a pointer device.

```tsx
// BEFORE — keyboard users were locked out
<div
  className="nodrag nopan"
  onDoubleClick={(e) => {
    e.stopPropagation()
    setDraft(label)
    setEditing(true)
  }}
>
```

## Why It Matters

Screen-reader users, power-keyboard users, and people who cannot use a mouse rely
on being able to **tab** to an element and **press Enter** to activate it. If an
interactive element has no `tabIndex` it is invisible to the tab order — the
browser will skip it entirely. Even if someone managed to move focus there
manually, without an `onKeyDown` handler, pressing Enter would do nothing.

## What Was Fixed

Two lines added to the label container div:

1. **`tabIndex={0}`** — tells the browser "this element can receive keyboard
   focus." `0` means it joins the natural tab order (same as a button or link).
   A negative value like `-1` would allow programmatic focus only; `0` is right
   here because we want users to be able to *tab* to it.

2. **`onKeyDown` handler** — listens for the `Enter` key. When the edge is
   selected (`selected` prop comes from React Flow) and the user presses Enter,
   it:
   - calls `e.stopPropagation()` so the key event doesn't bubble up to the
     canvas and trigger unintended canvas-level shortcuts
   - sets `draft` to the current label text (so the input starts with the
     existing value)
   - flips `editing` to `true`, which swaps the label span for the `<input>`

```tsx
// AFTER
<div
  className="nodrag nopan"
  tabIndex={0}
  onDoubleClick={(e) => {
    e.stopPropagation()
    setDraft(label)
    setEditing(true)
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && selected) {
      e.stopPropagation()
      setDraft(label)
      setEditing(true)
    }
  }}
  onMouseEnter={() => setHovered(true)}
>
```

## Why `selected` Is Checked in the Handler

React Flow already lets users select edges by clicking them. Checking `selected`
means Enter only starts editing when the edge is in its *selected* state — the
same conceptual moment when a mouse user would double-click. Without this guard,
pressing Enter while tabbed to any edge label (even a background one the user
wasn't intending to edit) would open the editor unexpectedly.

## Why `e.stopPropagation()` Is Needed

React Flow (and the canvas wrapper) listen for keyboard events at higher levels
to handle things like deleting nodes, panning, or other shortcuts. If we let the
`Enter` keydown bubble up, the canvas might intercept it and do something
unrelated. `stopPropagation` confines the event to our handler only.

## The Full Editing Flow After the Fix

```
User tabs to the edge label (tabIndex={0} makes this possible)
  ↓
Edge is already selected (they clicked it earlier), or they select it first
  ↓
User presses Enter
  ↓
onKeyDown fires → stopPropagation + setDraft(label) + setEditing(true)
  ↓
<input> replaces the <span>
  ↓
useEffect detects editing===true → focuses the input automatically
  ↓
User types, presses Enter or Escape (or blurs) → setEditing(false)
```

The `useEffect` that auto-focuses the input (`if (editing) inputRef.current?.focus()`)
was already there; our change just gives it a second trigger path (keyboard)
alongside the existing double-click path.

---

## Suggested Topics to Explore Further with an LLM

1. **`tabIndex` deep dive** — What is the difference between `tabIndex={0}`,
   `tabIndex={-1}`, and a positive value like `tabIndex={2}`? When should you use
   each? Why are positive tabIndex values generally considered an anti-pattern?

2. **ARIA roles for interactive non-button elements** — Our `<div>` is now
   interactive. Should it also have `role="button"` or some other ARIA role so
   screen readers announce it correctly? What does a screen reader say when it
   reaches a plain `<div tabIndex={0}>`?

3. **`stopPropagation` vs `preventDefault`** — These two are easy to confuse.
   Ask an LLM to explain the difference with examples. When should you use one
   vs the other vs both?

4. **WCAG 2.1 keyboard accessibility guidelines** — What are the specific success
   criteria (2.1.1 Keyboard, 2.1.2 No Keyboard Trap) that cover this kind of fix?
   How would you test a React app for keyboard accessibility compliance?

5. **React Flow edge selection and event model** — How does React Flow propagate
   selection state down to custom edge components via props? How does the event
   system interact with SVG vs DOM layers in React Flow?

6. **Focus management patterns in React** — Explore `useRef` + `.focus()`, the
   `autoFocus` attribute, and `focus-visible` CSS pseudo-class. Why is
   programmatic focus management sometimes necessary (as in this component's
   `useEffect`)?

7. **`onKeyDown` vs `onKeyUp` vs `onKeyPress`** — `onKeyPress` is deprecated.
   When should you use `onKeyDown` vs `onKeyUp`? Are there cases where the choice
   matters for user experience?
