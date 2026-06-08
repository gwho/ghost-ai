# Fix: Add aria-label to Edge Label Inline Input

## What Was Wrong

In `components/editor/canvas-edge.tsx`, when a user double-clicks (or presses
Enter on) an edge, the label span is replaced by an `<input>` for inline
editing. That input had no accessible name:

```tsx
// BEFORE — screen readers have nothing to announce
<input
  ref={inputRef}
  value={draft}
  onChange={...}
  onBlur={...}
  onKeyDown={...}
  ...
/>
```

A screen reader encountering this element would say something like *"edit
text"* or just *"blank"* — giving the user no context about what they are
editing or where on the canvas they are.

## Why It Matters

Every interactive form control must have an **accessible name** — a short
string the browser exposes to assistive technology (screen readers, voice
control software, braille displays). Without one:

- Screen-reader users hear a meaningless announcement.
- Voice-control users (e.g. Dragon NaturallySpeaking) cannot reliably target
  the field by speaking its label.
- Automated accessibility audits (axe, Lighthouse) flag it as a WCAG 2.1
  **Level A** failure (criterion 4.1.2 Name, Role, Value).

## The Fix

Added a single `aria-label` attribute:

```tsx
// AFTER
<input
  ref={inputRef}
  aria-label="Edit edge label"
  value={draft}
  onChange={...}
  ...
/>
```

### Why a static string, not a dynamic one?

The finding suggested a dynamic option like `` `Edit edge label ${id}` ``.
Dynamic labels are useful when a page contains many similar controls that need
to be distinguished by voice-control users ("click Edit edge label xy7"). In
this component only one input is ever rendered at a time (the one currently
being edited), so a static label is sufficient and cleaner.

### Why not `placeholder` instead?

`placeholder` is not an accessible name. Screen readers treat it as a hint,
not a label, and many do not announce it at all. `aria-label` is the correct
attribute when there is no visible `<label>` element to point to.

### Why not `<label htmlFor>`?

A visible `<label>` paired with `htmlFor` is the gold-standard HTML pattern
and would also work. It was skipped here because the input is a floating
inline editor on a canvas — adding a visible label element would break the
compact visual design. `aria-label` is the accepted alternative when a
visible label is not appropriate.

### i18n note

The codebase has no i18n utilities. If one is added in the future (e.g.
`next-intl` or `react-i18next`), replace the string with a translation call
such as `t('canvas.edge.editLabel')` and delete this note.

---

## Suggested Topics to Explore Further with an LLM

1. **The three ways to give a control an accessible name** — `aria-label`,
   `aria-labelledby`, and `<label htmlFor>` all assign a name, but with
   different trade-offs. Ask an LLM to compare them, explain when each is
   appropriate, and describe what the browser's "accessibility name
   computation" algorithm does when multiple methods are present on one element.

2. **WCAG 2.1 criterion 4.1.2 — Name, Role, Value** — This is one of the most
   commonly failed success criteria. Ask for a plain-English explanation of
   what it requires, why it exists, and how to test for it manually with a
   screen reader.

3. **`aria-label` vs `placeholder`** — Many developers assume `placeholder`
   is accessible. Ask an LLM to explain why it is not a substitute for an
   accessible name, and why placeholder text creates additional problems for
   users with cognitive disabilities.

4. **Dynamic vs static `aria-label`** — When should an `aria-label` include
   dynamic content (e.g. a row number, item name, or ID)? Ask for examples
   where a static label is fine and examples where omitting context creates
   real confusion for screen-reader users.

5. **Voice control software and accessible names** — Tools like Dragon
   NaturallySpeaking and Apple's Voice Control let users interact with UIs
   by speaking control names. Ask an LLM to explain how these tools use the
   accessibility tree and what breaks when controls lack names.

6. **Testing accessibility in a Next.js / React app** — Ask about the
   `@testing-library/jest-dom` `getByRole` query (which requires an
   accessible name), the `axe-core` library, and how to run Lighthouse
   accessibility audits — all practical ways to catch missing `aria-label`
   issues in CI.

7. **Canvas and SVG accessibility** — React Flow renders to SVG. Ask an LLM
   about the general challenges of making SVG-based UIs accessible, what
   roles (`role="img"`, `role="graphics-document"`) and attributes
   (`aria-label` on `<svg>`) are recommended, and what the current browser
   and screen-reader support looks like.
