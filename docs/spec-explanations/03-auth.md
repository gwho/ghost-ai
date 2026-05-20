# Feature 03 — Auth

## 1. Beginner-Friendly Summary

This feature connects Clerk authentication to the app. It adds sign-in and sign-up pages, protects private routes, redirects users based on whether they are logged in, and adds a user menu to the editor navbar.

After this feature, users must sign in before using the editor.

## 2. Purpose Of The Feature

The purpose is to make the app user-aware. Ghost AI needs to know who is using the app before it can safely support private projects, ownership, collaboration, and account settings.

Authentication is the foundation for later features that depend on user identity.

## 3. Main Requirements

- Install `@clerk/ui`.
- Wrap the root layout with `ClerkProvider`.
- Use Clerk's `dark` theme from `@clerk/ui/themes`.
- Override Clerk appearance variables with existing CSS variables.
- Do not hardcode colors in Clerk styling.
- Create a sign-in page using Clerk's `SignIn` component.
- Create a sign-up page using Clerk's `SignUp` component.
- Use a two-panel layout on large screens.
- Show only the form on small screens.
- Create `proxy.ts` at the project root.
- Use `proxy.ts`, not `middleware.ts`.
- Define public routes from existing sign-in and sign-up env vars.
- Protect everything except public auth routes.
- Update `/` so authenticated users redirect to `/editor`.
- Update `/` so unauthenticated users redirect to `/sign-in`.
- Add Clerk's `UserButton` to the editor navbar right section.
- Keep Clerk's default user menu and profile flows.
- Use existing Clerk env vars and do not invent new names.
- Confirm `npm run build` passes.

## 4. Constraints And Out-Of-Scope Items

- Do not rebuild Clerk's sign-in or sign-up form manually.
- Do not heavily customize Clerk internals.
- Do not use hardcoded colors for auth pages or Clerk appearance.
- Do not use `middleware.ts` for route protection in Next.js 16.
- Do not make auth pages into oversized hero or marketing pages.
- Do not use gradients, feature cards, or scroll-heavy layouts.
- Do not add project ownership logic yet.
- Do not add database logic yet.

## 5. Concepts You Need To Understand

- **Authentication:** Proving who a user is.
- **Clerk:** A third-party service that provides auth components and session handling.
- **Provider:** A React wrapper that makes auth data available to the app.
- **Route protection:** Blocking private pages from unauthenticated users.
- **Redirect:** Sending the user to another URL automatically.
- **Environment variables:** Configuration values stored outside source code.
- **`proxy.ts`:** A Next.js 16 request gate that can run before pages load.
- **Public route:** A route anyone can visit, like `/sign-in`.
- **Protected route:** A route that requires a logged-in user.
- **Catch-all route:** A route folder like `[[...sign-in]]` that supports nested Clerk auth paths.
- **Server component:** A component that can read auth state on the server before rendering.

## 6. Predicted Files, Components, And Functions

- `proxy.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/sign-in/[[...sign-in]]/page.tsx`
- `app/sign-up/[[...sign-up]]/page.tsx`
- `components/editor/editor-navbar.tsx`
- `.env.local`
- `ClerkProvider`
- `SignIn`
- `SignUp`
- `UserButton`
- `clerkMiddleware`
- `createRouteMatcher`
- `auth`
- `redirect`

## 7. What To Pay Attention To When Reading Generated Code

- Check that `ClerkProvider` wraps the app high enough in `app/layout.tsx`.
- Look at how Clerk's theme uses CSS variables instead of raw color values.
- Notice how `proxy.ts` decides which routes are public.
- Confirm that protected routes call Clerk's auth protection logic.
- Study why sign-in and sign-up folders use `[[...sign-in]]` and `[[...sign-up]]`.
- Look at how `/` redirects instead of rendering a page.
- Check that `UserButton` is placed in the navbar's right section.
- Watch for separation between Clerk-managed UI and app-managed layout.
- Confirm the auth pages stay minimal and do not become landing pages.

## 8. One Small Part To Reimplement Yourself Later

Reimplement the `/` redirect logic in a small practice file.

Practice writing a function that checks whether a `userId` exists. If it exists, redirect to `/editor`; otherwise, redirect to `/sign-in`. This is small, but it teaches the core decision behind authenticated routing.
