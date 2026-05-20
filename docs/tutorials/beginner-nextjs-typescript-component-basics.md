# Beginner Next.js, React, and TypeScript Component Basics

This note gives the minimum background needed before reading `components/editor/project-sidebar.tsx`.

## Next.js Basics

Next.js is a React framework. In this project, UI is built from React components, usually written in `.tsx` files.

A component is a function that returns UI:

```tsx
function Sidebar() {
  return <aside>Projects</aside>
}
```

The returned HTML-like syntax is called JSX. In TypeScript React files, it becomes TSX.

## Server vs Client Components

Modern Next.js defaults components to Server Components. That means they run on the server unless told otherwise.

This file starts with:

```tsx
"use client"
```

That tells Next.js:

> This component runs in the browser.

You need `"use client"` when a component uses browser interactivity, such as:

```tsx
onClick={onClose}
```

Without `"use client"`, click handlers and interactive state would not work.

## TypeScript Basics

TypeScript is JavaScript with types.

This part:

```tsx
interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}
```

defines the shape of the props the component expects.

It means:

- `isOpen` must be `true` or `false`.
- `onClose` must be a function.
- The function takes no arguments and returns nothing important.

Then the component receives those props here:

```tsx
export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps)
```

So if another component uses `ProjectSidebar`, it must pass:

```tsx
<ProjectSidebar isOpen={true} onClose={someFunction} />
```

## Props

Props are inputs passed into a component.

For this sidebar:

- `isOpen` controls whether the sidebar is visible.
- `onClose` is called when the user clicks the close button.

Think of props as function parameters for UI.

## Imports

Imports bring in code from other files or packages:

```tsx
import { X, Plus } from "lucide-react"
```

This imports two icons.

```tsx
import { Button } from "@/components/ui/button"
```

This imports the project's reusable button component.

The `@/` path means "from the project root."

## Tailwind Classes

Most visual styling is inside `className`:

```tsx
className="fixed top-14 left-0 w-72 bg-surface"
```

These are Tailwind CSS utility classes.

Examples:

- `fixed` means positioned relative to the browser window.
- `w-72` means fixed width.
- `bg-surface` means use the app's surface background color.
- `border-r` means right border.

This project uses custom theme tokens like `bg-surface`, `text-copy-muted`, and `border-surface-border`.

## Conditional Styling

This file has a key pattern:

```tsx
isOpen ? "translate-x-0" : "-translate-x-full"
```

This is a ternary expression.

It means:

```txt
if isOpen is true:
  use "translate-x-0"
else:
  use "-translate-x-full"
```

In plain English:

- Open sidebar: keep it in place.
- Closed sidebar: move it fully off-screen to the left.

## Event Handlers

This line:

```tsx
onClick={onClose}
```

means:

> When the button is clicked, run the `onClose` function.

The sidebar itself does not decide what "close" means. Its parent component owns that logic.

That is a common React pattern:

- Parent owns state.
- Child receives state and callbacks through props.

## Check Your Understanding

Before continuing through `project-sidebar.tsx`, answer this:

In your own words, what do you think `isOpen` and `onClose` are responsible for in this component?
