# Fix: `ProjectListItem` Not Keyboard-Accessible (`project-sidebar.tsx`)

## Summary

The outer `<div>` in `ProjectListItem` had an `onClick` handler but no way for
keyboard or assistive-technology users to focus or activate it. The fix replaces
the `<div onClick>` navigation with an absolutely-positioned `<Link>` that covers
the full row, while the rename/delete buttons sit above it via CSS stacking.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `components/editor/project-sidebar.tsx` | 26 | Clickable `<div>` with no keyboard support | Fixed |

---

## Step 1 — Verification

```tsx
// Before — lines 26-31
<div
  className="group flex items-center ... cursor-pointer"
  onClick={() => router.push(`/editor/${project.id}`)}
>
```

Confirmed three missing accessibility requirements:
1. **No `tabIndex`** — keyboard users can't Tab to the item at all.
2. **No `role`** — screen readers don't know this element is interactive.
3. **No `onKeyDown`** — even if focused somehow, pressing Enter or Space does nothing.

Finding confirmed valid.

---

## The Bug Explained

Browsers only make certain HTML elements keyboard-focusable and activatable by
default: `<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`. A plain `<div>`
is not in that list — it is invisible to Tab navigation and to most screen readers
unless you explicitly opt it in.

For sighted mouse users the component worked fine. For everyone else:
- **Keyboard-only users** (who navigate with Tab, Enter, Space) could not reach
  any project in the list.
- **Screen reader users** heard the project name but had no indication it was
  clickable and no way to activate it.

---

## Why the First Attempted Fix Was Incomplete

The first instinct was to add `role="button"`, `tabIndex={0}`, and an `onKeyDown`
handler:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={() => router.push(...)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") router.push(...)
  }}
>
  <span>Project name</span>
  <div>
    <button>Rename</button>   {/* ← nested interactive element */}
    <button>Delete</button>   {/* ← nested interactive element */}
  </div>
</div>
```

This fixed the original problem (keyboard users can now reach and activate the row),
but it introduced a different violation: **interactive elements nested inside another
interactive element**.

### Why nesting interactive elements is a problem

Think of the accessibility tree like a map that screen readers use to understand a
page. When a screen reader sees `role="button"` on the outer div, it announces the
whole thing — including its children — as a single button. The rename and delete
`<button>` elements inside it then become buttons-inside-a-button, which is
structurally contradictory. A button cannot contain another button any more than a
checkbox can contain another checkbox.

The HTML5 spec has the same rule for real elements:
- `<button>` cannot contain `<button>`
- `<a>` cannot contain `<a>` or `<button>`

The ARIA spec mirrors this for roles: `role="button"` must not have interactive
descendants. Browsers and screen readers handle this inconsistently — some skip the
inner buttons, some confuse the focus order, some announce the item twice.

In short: the first fix solved "can't be reached" but created "can't be correctly
understood once reached."

---

## The Right Fix: Stretched Link Pattern

The root tension is: **one visual row needs two different interactive behaviors**
(navigate to project, and open rename/delete dialogs). You cannot have two
interactive elements that perfectly overlap — but you can layer them with CSS.

The stretched link pattern:

```
┌─────────────────────────────────────────────┐
│  <div> (container, position: relative)      │
│  ┌───────────────────────────────────────┐  │
│  │ <Link> (position: absolute, inset: 0) │  │  ← covers entire row
│  └───────────────────────────────────────┘  │
│  <span class="relative">Project name</span> │  ← sits above Link (z-index)
│  <div class="relative">                     │  ← sits above Link (z-index)
│    <button>Rename</button>                  │  ← real buttons, not nested in Link
│    <button>Delete</button>                  │
│  </div>                                     │
└─────────────────────────────────────────────┘
```

### How CSS stacking makes it work

`position: relative` on an element without an explicit `z-index` still creates a
stacking context. In practice, elements that come *later* in the HTML and have
`position: relative` are painted *on top of* earlier elements. Because the `<Link>`
is the first child and the `<span>` and button `<div>` come after it, they naturally
render above the link — and clicks on them reach the buttons, not the link underneath.

### Why this solves both problems

| Problem | Old div+onClick | role="button" fix | Stretched link |
|---------|----------------|-------------------|----------------|
| Keyboard-focusable | No | Yes | Yes (native `<a>`) |
| Screen-reader role | No role | `role="button"` | `role="link"` (native `<a>`) |
| Enter key navigates | No | Yes (manual handler) | Yes (native `<a>`) |
| Space key activates | No | Yes (manual handler) | No (correct — links don't use Space) |
| Browser history / prefetch | No | No | Yes (Next.js `<Link>`) |
| Nested interactive controls | No nesting | **Yes — violation** | **No — buttons are siblings of link** |
| `e.stopPropagation()` needed | Yes | Yes | **No — clicks on buttons never reach the link** |

The `<Link>` is a real anchor (`<a>`) rendered by Next.js. It gets everything a
native link provides for free: Tab focusability, Enter-key activation, screen-reader
"link" announcement, browser prefetching, right-click → Open in new tab, and
correct history behavior. No manual keyboard handler is needed.

The rename/delete buttons are **siblings** of the `<Link>` inside the container
`<div>`, not descendants of it. There is no nesting violation. Clicking a button
also does not bubble up to the link because the link is behind them in z-order and
mouse events only travel up the DOM tree (not down through stacking layers).

---

## The Fix in Code

### Before

```tsx
import { usePathname, useRouter } from "next/navigation"

function ProjectListItem({ project, isActive }) {
  const { openRename, openDelete } = useProjectDialogsContext()
  const router = useRouter()

  return (
    <div
      className={`group flex items-center justify-between px-2 py-1.5
        rounded-xl hover:bg-elevated cursor-pointer
        ${isActive ? "bg-elevated" : ""}`}
      onClick={() => router.push(`/editor/${project.id}`)}
    >
      <span className="text-sm text-copy-primary truncate">{project.name}</span>
      {project.isOwned && (
        <div className="flex items-center gap-0.5 ...">
          <button onClick={(e) => { e.stopPropagation(); openRename(project) }}>
            <Pencil />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openDelete(project) }}>
            <Trash2 />
          </button>
        </div>
      )}
    </div>
  )
}
```

### After

```tsx
import Link from "next/link"
import { usePathname } from "next/navigation"

function ProjectListItem({ project, isActive }) {
  const { openRename, openDelete } = useProjectDialogsContext()

  return (
    <div
      className={`group relative flex items-center justify-between px-2 py-1.5
        rounded-xl hover:bg-elevated
        ${isActive ? "bg-elevated" : ""}`}
    >
      <Link
        href={`/editor/${project.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={project.name}
      />
      <span className="relative text-sm text-copy-primary truncate">
        {project.name}
      </span>
      {project.isOwned && (
        <div className="relative flex items-center gap-0.5 ...">
          <button onClick={() => openRename(project)} aria-label={`Rename ${project.name}`}>
            <Pencil />
          </button>
          <button onClick={() => openDelete(project)} aria-label={`Delete ${project.name}`}>
            <Trash2 />
          </button>
        </div>
      )}
    </div>
  )
}
```

Notable side-effects of the fix:
- `useRouter` and `router.push` removed — no longer needed.
- `e.stopPropagation()` removed from both button handlers — no longer needed because
  clicks on the buttons never reach the link (they're layered above it, not inside it).
- `cursor-pointer` removed from the container — the `<Link>` renders as `<a>`, which
  already has the pointer cursor by default.

---

## Beginner Takeaway

> **Use real HTML elements for interactive things whenever possible.**
> `<a>` for navigation, `<button>` for actions. ARIA roles are a patch for when
> you genuinely can't use the real element — they don't give you keyboard support,
> browser history, or prefetching for free the way native elements do.

When you find yourself adding `role="button"` + `tabIndex` + `onKeyDown` to a `<div>`,
stop and ask: "Is there a real HTML element I could use instead?" Most of the time
there is, and using it will produce less code and better accessibility.

The one tricky case — which this component hits — is when you need a large clickable
area that also contains smaller interactive controls. The stretched link pattern is
the established answer: use a real `<a>` for the large target, layer smaller controls
on top with CSS, and let each element be exactly what it is.

---

## Files Changed

| File | Change |
|------|--------|
| `components/editor/project-sidebar.tsx` | Container div gets `relative`; `<Link>` added as `absolute inset-0` first child; span and button wrapper get `relative`; `useRouter` and `stopPropagation` removed |
