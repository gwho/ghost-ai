# Spec To Code Mapping

This guide maps the original three feature specs to the generated code. Use it to practice reading code by asking: "Where did this requirement land, and how can I prove it works?"

## Feature 01 — Design System

| Spec requirement | File/function/component implementing it | Beginner-friendly explanation | How to manually verify it | Concept it teaches |
|---|---|---|---|---|
| Install and configure shadcn/ui | `components/ui/*` | The app now has reusable UI primitives instead of hand-built one-off elements. | Check that `components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `tabs.tsx`, `textarea.tsx`, and `scroll-area.tsx` exist. | Component library setup |
| Add Button | `components/ui/button.tsx`, `Button` | `Button` wraps a normal button with consistent sizes, variants, and theme classes. | Search for `<Button` in `components/editor/project-sidebar.tsx`; it is used for `New Project`. | Reusable components |
| Add Dialog | `components/ui/dialog.tsx`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | Dialog pieces exist for future modals, even though no real dialog feature is built yet. | Open `components/ui/dialog.tsx` and confirm title, description, footer, overlay, and content exports exist. | Composition |
| Add Tabs | `components/ui/tabs.tsx`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Tabs let the sidebar switch between `My Projects` and `Shared` sections. | Open the sidebar and click both tab labels. The visible placeholder text should change. | Tabbed UI state |
| Add Input, Textarea, ScrollArea, Card | `components/ui/input.tsx`, `textarea.tsx`, `scroll-area.tsx`, `card.tsx` | These are ready for future forms, scrollable panels, and content containers. | Confirm the files exist and import without errors during build/lint. | Prepared primitives |
| Install lucide-react | `package.json`, imports from `lucide-react` | Icons come from one shared icon library. | Look for imports like `PanelLeftOpen`, `X`, `Plus`, `Cpu`, `Share2`, and `FileText`. | Icon libraries |
| Create reusable `cn()` helper | `lib/utils.ts`, `cn()` | `cn()` combines class names and resolves Tailwind conflicts. | Read `lib/utils.ts`; it calls `clsx()` first and `twMerge()` second. | Utility functions |
| Components match dark theme | `app/globals.css`, `components/ui/*` | Components use semantic tokens like `bg-primary`, `text-muted-foreground`, and `border-border`. | Inspect UI files for theme classes instead of hardcoded light colors. Run the app and confirm no default white/light theme appears. | Design tokens |

## Feature 02 — Editor Chrome

| Spec requirement | File/function/component implementing it | Beginner-friendly explanation | How to manually verify it | Concept it teaches |
|---|---|---|---|---|
| Create editor navbar | `components/editor/editor-navbar.tsx`, `EditorNavbar` | This is the fixed bar across the top of the editor. | Visit `/editor` and look for a top bar. | Layout components |
| Fixed-height top navbar | `EditorNavbar` `nav` classes: `fixed`, `top-0`, `h-14` | The navbar stays pinned to the top and has a stable height. | Scroll or inspect the element; it should remain at the top and be 56px tall. | Fixed positioning |
| Left, center, and right sections | `EditorNavbar` has three child `div`s | The first holds the toggle, the middle expands, and the right holds account UI. | Read the JSX children inside `<nav>`. | Layout structure |
| Left section contains sidebar toggle | `EditorNavbar` button with `onClick={onToggleSidebar}` | Clicking the button asks the parent layout to open or close the sidebar. | Click the top-left icon on `/editor`; the sidebar should slide in or out. | Event handlers |
| Use `PanelLeftOpen` / `PanelLeftClose` based on state | `EditorNavbar` conditional render using `isSidebarOpen` | The icon changes depending on whether the sidebar is open. | Open and close the sidebar and watch the icon swap. | Conditional rendering |
| Right section empty for now | Original Feature 02 implemented this as an empty right section; Feature 03 later replaced it with `UserButton` | Specs are cumulative: Feature 03 intentionally changes the Feature 02 placeholder. | Open `editor-navbar.tsx`; the right section now contains `<UserButton />`. | Iterative features |
| Dark background with subtle bottom border | `EditorNavbar` classes `bg-surface border-b border-surface-border` | The navbar uses app theme tokens, not raw colors. | Inspect the navbar class string. | Theme-based styling |
| Create project sidebar | `components/editor/project-sidebar.tsx`, `ProjectSidebar` | This is the sliding panel for project navigation. | Visit `/editor` and open the sidebar. | Sidebar component |
| Sidebar floats above editor canvas | `ProjectSidebar` uses `fixed top-14 left-0 z-40` | Fixed positioning removes it from normal page layout. | Open the sidebar; the main editor content should not move sideways. | Overlay layout |
| Sidebar slides in from the left | `ProjectSidebar` conditional classes `translate-x-0` and `-translate-x-full` | The sidebar is moved on and off screen with CSS transforms. | Toggle the sidebar and watch it animate. | CSS transforms |
| Accepts `isOpen` and `onClose` props | `ProjectSidebarProps`, `ProjectSidebar({ isOpen, onClose })` | The parent controls whether the sidebar is open; the sidebar can request closing. | Read the props interface and the function parameters. | Controlled components |
| Header with `Projects` title and close button | First header `div` in `ProjectSidebar` | The sidebar has a title and an X button. | Open the sidebar and click the X button. | Component anatomy |
| shadcn Tabs: `My Projects` and `Shared` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` in `ProjectSidebar` | The sidebar has two sections, even though both are empty for now. | Click `My Projects` and `Shared`. | UI primitives in feature code |
| Both tabs show empty placeholder state | `No projects yet.`, `No shared projects yet.` | The UI communicates that there is no project data yet. | Switch tabs and read each empty message. | Empty states |
| Full-width `New Project` button with `Plus` icon | `Button` plus `Plus` in sidebar footer | The button is visually ready for a future create-project action. | Look at the bottom of the sidebar. | Call-to-action controls |
| Editor layout owns sidebar state | `app/editor/layout.tsx`, `useState(false)` | The layout tracks whether the sidebar is open and passes that state to children. | Read `EditorLayout`; follow `isSidebarOpen` into both navbar and sidebar. | State lifting |

## Feature 03 — Auth

| Spec requirement | File/function/component implementing it | Beginner-friendly explanation | How to manually verify it | Concept it teaches |
|---|---|---|---|---|
| Install `@clerk/ui` | `package.json` dependency | Clerk's UI theme package is available so the app can use Clerk's dark theme. | Check `package.json` for `@clerk/ui`. | Dependency management |
| Wrap root layout with `ClerkProvider` | `app/layout.tsx`, `ClerkProvider` | Clerk auth state becomes available throughout the app. | Open `app/layout.tsx`; `ClerkProvider` wraps `<html>`. | React providers |
| Use Clerk dark theme | `app/layout.tsx`, `theme: dark` | Clerk forms start from Clerk's dark visual theme. | Find `import { dark } from "@clerk/ui/themes"` and `theme: dark`. | Third-party theming |
| Override Clerk variables with CSS variables | `app/layout.tsx`, `appearance.variables` | Clerk styling points to the app's design tokens like `var(--bg-base)`. | Confirm values are CSS variables, not hex colors. | CSS variable theming |
| Create sign-in page using Clerk component | `app/sign-in/[[...sign-in]]/page.tsx`, `SignInPage`, `<SignIn />` | The app uses Clerk's built-in sign-in form instead of rebuilding auth manually. | Visit `/sign-in`; a Clerk sign-in form should render. | Vendor components |
| Create sign-up page using Clerk component | `app/sign-up/[[...sign-up]]/page.tsx`, `SignUpPage`, `<SignUp />` | The app uses Clerk's built-in registration form. | Visit `/sign-up`; a Clerk sign-up form should render. | Vendor components |
| Large screens use two-panel layout | Sign-in/sign-up page root layout with hidden left panel and right form panel | On desktop, the left side explains the product and the right side shows the form. | Open `/sign-in` or `/sign-up` at desktop width. | Responsive layout |
| Small screens show form only | Left panel class `hidden md:flex` | The descriptive panel disappears until the screen reaches the `md` breakpoint. | Resize browser below tablet width; only the form side should remain. | Responsive breakpoints |
| Text-only feature list | Current code uses icon-enhanced feature rows in sign-in/sign-up pages | This is a small difference from the original spec: the generated code added icons to the feature list. | Read the `features` array and mapped `<Icon />` usage. | Spec drift detection |
| No hardcoded colors in auth pages | Auth page classes such as `bg-surface`, `text-copy-primary`, `bg-brand-dim` | The pages use named theme classes backed by CSS variables. | Search auth pages for raw hex colors like `#`. | Design token discipline |
| Use `proxy.ts`, not `middleware.ts` | `proxy.ts` | Next.js 16 route protection lives in `proxy.ts`. | Confirm `proxy.ts` exists at the project root and there is no `middleware.ts`. | Framework file conventions |
| Define public auth routes from env vars | `proxy.ts`, `signInPath`, `signUpPath`, `createRouteMatcher` | The app reads sign-in/sign-up paths from environment config, with fallbacks. | Read `proxy.ts`; look for `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL`. | Environment configuration |
| Protect everything else by default | `proxy.ts`, `auth.protect()` inside `if (!isPublicRoute(request))` | Any route that is not sign-in or sign-up requires authentication. | While signed out, visit `/editor`; it should redirect to sign-in. | Route guards |
| Authenticated `/` redirects to `/editor` | `app/page.tsx`, `if (userId) redirect("/editor")` | The home route sends logged-in users straight to the editor. | Sign in, then visit `/`; it should go to `/editor`. | Server-side redirects |
| Unauthenticated `/` redirects to sign-in | `app/page.tsx`, fallback redirect to sign-in URL | Logged-out users are sent to the sign-in page. | Sign out, then visit `/`; it should go to `/sign-in`. | Auth-aware routing |
| Add `UserButton` to editor navbar | `components/editor/editor-navbar.tsx`, `<UserButton />` | The right side of the navbar now shows Clerk's account menu. | Sign in and visit `/editor`; look at the right side of the navbar. | Auth UI integration |
| Keep Clerk default profile flows | `UserButton`, `SignIn`, `SignUp` from `@clerk/nextjs` | The app relies on Clerk's built-in account UI instead of custom profile code. | Click the user button and confirm Clerk's default menu appears. | Avoiding unnecessary custom code |

## One Small Reimplementation Exercise

Reimplement the sidebar open/close interaction from Feature 02.

Goal: build a tiny practice component with one button and one sliding panel.

What to practice:

1. Create a boolean state named `isOpen`.
2. Click a button to toggle `isOpen`.
3. Render a panel whose class changes based on `isOpen`.
4. Use `translate-x-0` when open.
5. Use `-translate-x-full` when closed.
6. Add a close button inside the panel that sets `isOpen` back to `false`.

Why this exercise is the right size: it teaches state, props, events, conditional rendering, and CSS transforms without needing Clerk, routing, APIs, or project data.
