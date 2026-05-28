# Fix: Missing `Description` or `aria-describedby` for DialogContent

## What the warning said

```
Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
```

Radix UI prints this to the browser console when a `<DialogContent>` mounts
without an accessible description attached to it.

## Why Radix requires a description

A modal dialog is a focus trap — when it opens, keyboard and screen-reader users
are locked inside until it closes. Assistive technologies (screen readers) need
to know _what the dialog is for_ at the moment it gains focus. The accessible
name comes from `<DialogTitle>`; the accessible description is the extra context
that helps users decide what to do.

If a dialog has no description, screen reader users hear the title ("New
Project") but get no hint about what's expected of them. Radix emits the warning
to remind you to either provide that context or explicitly declare that no
description is needed.

## What caused it

`CreateProjectDialog` had a `<DialogTitle>` ("New Project") but no
`<DialogDescription>`:

```tsx
<DialogHeader>
  <DialogTitle>New Project</DialogTitle>
  {/* no description — warning fires here */}
</DialogHeader>
```

The other two dialogs already had conditional `<DialogDescription>` elements:
- **Rename**: `Rename "<project name>"`
- **Delete**: `This will permanently delete "<project name>". This cannot be undone.`

Those descriptions are conditionally rendered on `targetProject`, but
`targetProject` is always set before the dialog's `open` state switches to
`"rename"` or `"delete"`, so they are always present when the dialog is visible.

## The fix

Added a `<DialogDescription>` to `CreateProjectDialog`:

```tsx
<DialogHeader>
  <DialogTitle>New Project</DialogTitle>
  <DialogDescription>Give your new project a name to get started.</DialogDescription>
</DialogHeader>
```

One line, in `components/editor/project-dialogs.tsx`.

## The two escape hatches Radix offers

Radix gives you two ways to handle this:

| Approach | When to use |
|---|---|
| Add `<DialogDescription>` | When you can write a meaningful description — always preferred for accessibility |
| Pass `aria-describedby={undefined}` to `DialogContent` | When the dialog is self-explanatory and adding a description would be redundant or misleading |

`aria-describedby={undefined}` tells Radix "I know there's no description; I'm opting out intentionally." It silences the warning without adding visible text. We didn't use this here because a short description genuinely helps the Create dialog.

## Beginner model — what is `aria-describedby`?

HTML has a family of `aria-*` attributes (Accessible Rich Internet Applications)
that tell screen readers things the visual design communicates but the HTML
structure alone doesn't.

`aria-describedby` points to the ID of an element that describes the current
element. Radix Dialog uses it to link `<DialogContent>` to
`<DialogDescription>` behind the scenes — when the dialog opens, the screen
reader reads the title, then immediately reads the description text.

When you pass `aria-describedby={undefined}`, you're explicitly disconnecting
that link. Radix respects the override and stops warning because you've signalled
intentional awareness, not oversight.
