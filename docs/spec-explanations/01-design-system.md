# Feature 01 — Design System

## 1. Beginner-Friendly Summary

This feature sets up the app's reusable UI building blocks. Instead of hand-coding every button, input, dialog, and tab from scratch, the project uses shadcn/ui components and connects them to the existing dark theme.

It also adds a small helper function called `cn()` that makes it easier to combine Tailwind CSS class names.

## 2. Purpose Of The Feature

The purpose is to create a consistent foundation for the rest of the app. Future features can use the same button, input, dialog, and tab components without repeatedly solving styling and behavior.

This keeps the app visually consistent and reduces duplicated code.

## 3. Main Requirements

- Install and configure shadcn/ui.
- Add these UI primitives:
  - Button
  - Card
  - Dialog
  - Input
  - Tabs
  - Textarea
  - ScrollArea
- Install `lucide-react` for icons.
- Create `lib/utils.ts`.
- Add a reusable `cn()` helper for merging Tailwind classes.
- Make sure generated UI components match the dark theme in `app/globals.css`.
- Confirm components import correctly.
- Confirm no default light styling appears.

## 4. Constraints And Out-Of-Scope Items

- Do not modify generated `components/ui/*` files after installation.
- Do not invent a custom component library.
- Do not build feature-specific screens yet.
- Do not change the app's overall product behavior.
- Keep the components aligned with the existing dark design tokens.

## 5. Concepts You Need To Understand

- **Design system:** A shared set of styles and components used across an app.
- **UI primitive:** A low-level reusable component, such as a button or input.
- **shadcn/ui:** A tool that adds customizable React components to your project.
- **Tailwind CSS:** Utility classes for styling directly in markup.
- **CSS variables:** Named design values, like colors, stored in `globals.css`.
- **Class merging:** Combining class strings while avoiding conflicting Tailwind classes.
- **`cn()` helper:** A common helper that merges conditional class names cleanly.
- **lucide-react:** An icon library used for consistent SVG icons.

## 6. Predicted Files, Components, And Functions

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/input.tsx`
- `components/ui/tabs.tsx`
- `components/ui/textarea.tsx`
- `components/ui/scroll-area.tsx`
- `lib/utils.ts`
- `cn()` function
- `package.json` dependency changes
- `app/globals.css` may be referenced for theme tokens

## 7. What To Pay Attention To When Reading Generated Code

- Look at how each UI component imports `cn()` from `lib/utils.ts`.
- Notice how components accept `className` so callers can add styles.
- Watch for Tailwind classes that use theme tokens instead of raw colors.
- Check that generated components are reusable and not tied to one screen.
- Notice how icon support is separate from the UI components.
- Pay attention to whether generated files are left alone after installation.

## 8. One Small Part To Reimplement Yourself Later

Reimplement a tiny version of the `cn()` helper.

Start with a function that accepts multiple class name strings and joins the truthy ones together. After that, compare it with the real helper and learn why libraries like `clsx` and `tailwind-merge` are useful.
