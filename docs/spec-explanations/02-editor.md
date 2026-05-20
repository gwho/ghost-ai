# Feature 02 — Editor Chrome

## 1. Beginner-Friendly Summary

This feature builds the basic frame around the editor screen. It adds a fixed top navbar and a floating project sidebar that can slide in and out.

Think of it as the app shell for the editor. The actual diagram canvas and project data are not part of this feature yet.

## 2. Purpose Of The Feature

The purpose is to give every future editor screen a stable layout. The navbar and sidebar will be reused later when the app adds projects, diagrams, AI tools, collaboration, and export features.

This feature focuses on structure and interaction, not real project content.

## 3. Main Requirements

- Create `components/editor/editor-navbar.tsx`.
- The navbar must have a fixed height.
- The navbar must have left, center, and right sections.
- The left section contains a sidebar toggle button.
- The toggle button uses `PanelLeftOpen` and `PanelLeftClose` icons.
- The right section stays empty for now.
- The navbar uses a dark background and subtle bottom border.
- Create `components/editor/project-sidebar.tsx`.
- The sidebar floats above the editor canvas.
- Opening the sidebar must not push page content.
- The sidebar slides in from the left.
- The sidebar accepts `isOpen: boolean` and `onClose: () => void` props.
- The sidebar has a header with a `Projects` title and close button.
- The sidebar uses shadcn `Tabs` for `My Projects` and `Shared`.
- Both tabs show empty placeholder states.
- A full-width `New Project` button appears at the bottom with a `Plus` icon.
- Existing dialog styling should be ready for future dialogs.

## 4. Constraints And Out-Of-Scope Items

- Do not build real project loading yet.
- Do not build actual dialogs yet.
- Do not add persistence or backend behavior.
- Do not make the sidebar push the editor content.
- Do not fill the right navbar section yet.
- Keep styling connected to the existing dark theme tokens.

## 5. Concepts You Need To Understand

- **App chrome:** The persistent frame around a screen, such as navbar and sidebar.
- **Props:** Values passed into a React component, like `isOpen` and `onClose`.
- **Controlled state:** A parent component owns state and passes it down to children.
- **Fixed positioning:** CSS positioning that keeps an element attached to the viewport.
- **Z-index:** Controls which elements appear on top of others.
- **CSS transform:** Used to move the sidebar without changing page layout.
- **Client component:** A Next.js component that can use browser interactivity like clicks.
- **Tabs:** UI that switches between different content panels.

## 6. Predicted Files, Components, And Functions

- `components/editor/editor-navbar.tsx`
- `components/editor/project-sidebar.tsx`
- `EditorNavbar` component
- `ProjectSidebar` component
- `EditorNavbarProps` interface
- `ProjectSidebarProps` interface
- Possible editor route layout such as `app/editor/layout.tsx`
- Possible editor page such as `app/editor/page.tsx`
- Existing `components/ui/tabs.tsx`
- Existing `components/ui/button.tsx`
- Existing `components/ui/dialog.tsx`

## 7. What To Pay Attention To When Reading Generated Code

- Check where `"use client"` is used and why.
- Find which component owns the `isSidebarOpen` state.
- Notice how the navbar only triggers the state change but does not own the whole layout.
- Look at how `isOpen` changes the sidebar's CSS classes.
- Confirm the sidebar uses `fixed` positioning so it does not push content.
- Watch how icon components from `lucide-react` are used inside buttons.
- Check whether buttons include accessible labels or visible text.
- Notice how empty states are placeholders, not real project data.

## 8. One Small Part To Reimplement Yourself Later

Reimplement the sidebar open and close behavior.

Build a tiny component with one button and one panel. Use a boolean state like `isOpen`, then switch between `translate-x-0` and `-translate-x-full`. This will help you understand how state controls visual behavior.
