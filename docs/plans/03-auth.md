# Feature 03 — Auth Implementation Plan & Learning Guide

This document records how auth was implemented in Ghost AI and explains every decision in beginner-friendly terms. Read it to understand not just what the code does, but *why* it was written that way.

---

## What We Built

Clerk was already installed (`@clerk/nextjs@7.3.5`) but nothing was wired up. We connected it to the app by:

1. Installing `@clerk/ui@1.11.0` (theme support)
2. Adding env vars for Clerk's sign-in/sign-up routes
3. Creating `proxy.ts` for route protection
4. Wrapping the root layout with `ClerkProvider`
5. Making `/` redirect based on auth state
6. Creating two-panel sign-in and sign-up pages
7. Adding `UserButton` to the editor navbar

---

## Files Changed

| File | What Changed |
|---|---|
| `.env.local` | Added 4 Clerk URL env vars |
| `proxy.ts` *(new)* | Route protection — all routes protected except sign-in/sign-up |
| `app/layout.tsx` | Wrapped with `ClerkProvider` using dark theme + CSS variable overrides |
| `app/page.tsx` | Replaced placeholder with auth-aware redirect logic |
| `app/sign-in/[[...sign-in]]/page.tsx` *(new)* | Sign-in page — two-panel layout |
| `app/sign-up/[[...sign-up]]/page.tsx` *(new)* | Sign-up page — two-panel layout |
| `components/editor/editor-navbar.tsx` | Added `UserButton` to right section |
| `context/progress-tracker.md` | Marked feature 03 complete |

---

## Problems Encountered & How We Fixed Them

### Problem 1: `@clerk/ui` install failed

**What happened:** Running `npm install @clerk/ui` failed with:
```
No matching version found for @clerk/shared@^4.12.1
```

**Why it failed:** The latest `@clerk/ui` (e.g., 1.12.0) depends on `@clerk/localizations@^4.6.4`. npm resolved that to `@clerk/localizations@4.6.5`, which requires `@clerk/shared@^4.12.1`. But `@clerk/shared@4.12.1` hadn't been published to npm yet — only canary versions existed.

**The fix:** Install `@clerk/localizations@4.6.4` alongside `@clerk/ui@1.11.0` to pin the resolution:
```bash
npm install @clerk/localizations@4.6.4 @clerk/ui@1.11.0 --legacy-peer-deps
```

**Lesson:** When an npm install fails with "No matching version found", the culprit is often a *transitive dependency* (a dependency of a dependency), not the package you're installing directly. Read the debug log carefully — it usually names the exact package and version range that can't be resolved.

---

### Problem 2: Wrong Clerk appearance variable names

**What happened:** The plan used variable names like `colorInputBackground`, `colorText`, `colorTextSecondary`, `colorInputText`. TypeScript reported:
```
Object literal may only specify known properties, but 'colorInputBackground' does not exist in type 'Variables'
```

**Why it happened:** Clerk's `Variables` type has specific, documented names that don't match intuitive guesses.

**The fix:** Read the actual type from `node_modules/@clerk/ui/dist/internal/appearance.d.ts` to find the correct names:

| Wrong name (guessed) | Correct name |
|---|---|
| `colorInputBackground` | `colorInput` |
| `colorText` | `colorForeground` |
| `colorTextSecondary` | `colorMutedForeground` |
| `colorInputText` | `colorInputForeground` |

**Lesson:** When working with third-party APIs, don't guess property names — look them up in the type definitions. In VS Code you can hover over the prop or press F12 to go to the definition.

---

### Problem 3: `baseTheme` isn't a valid prop

**What happened:** The plan used `appearance={{ baseTheme: dark }}`. TypeScript reported:
```
Object literal may only specify known properties, and 'baseTheme' does not exist in type 'Appearance'
```

**Why it happened:** The Clerk docs for older versions used `baseTheme`. The current SDK uses `theme`.

**The fix:**
```typescript
appearance={{ theme: dark, variables: { ... } }}
```

**Lesson:** Clerk has gone through several major SDK versions (Core 2, Core 3). Documentation and blog posts from before 2025 may reference the old API. Always verify against the installed version's type definitions — they're the ground truth.

---

## Concept Explanations (For Beginners)

### Why `proxy.ts` and not `middleware.ts`?

In Next.js, there's a special file that runs on *every request* before it reaches your pages. Think of it as a bouncer at a club entrance — it can check who's coming in and decide whether to let them through, redirect them, or block them.

Before Next.js 16, this file was called `middleware.ts`. In Next.js 16, it was renamed to `proxy.ts`. If you use the old name, Next.js silently ignores it — meaning no protection at all.

The code inside is still Clerk's `clerkMiddleware`. The filename is what changed.

**How it works in our project:**
```typescript
// proxy.ts
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()  // redirects to /sign-in if not logged in
  }
})
```

Every request hits this code first. If the route is not `/sign-in` or `/sign-up`, Clerk calls `auth.protect()`. If the user has no valid session, they're redirected to sign in.

---

### Why env vars with fallbacks?

```typescript
const signInPath = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'
```

The `??` is the **nullish coalescing operator**. It means: "use the left value if it's not null or undefined; otherwise use the right value."

Without a fallback, if `.env.local` is missing or incomplete (e.g., when a new developer clones the repo), `process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL` is `undefined`. The route matcher then looks for paths matching `"undefined(.*)"` — which never matches `/sign-in`, so the sign-in page itself gets blocked, creating an infinite redirect loop.

The fallback makes the code safe by default.

**Why `NEXT_PUBLIC_` prefix?**
All environment variables in Next.js are server-only by default — browsers can't see them. The `NEXT_PUBLIC_` prefix explicitly opts a variable into the browser bundle. Clerk's sign-in/sign-up URLs may be needed on both server and client, so the prefix is required.

---

### Why does `ClerkProvider` wrap the `<html>` tag?

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>        {/* ← outside <html> */}
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

`ClerkProvider` is a React **context provider**. Context is like a shared data store that any component in the tree below it can read from. `ClerkProvider` puts the current user's session into that store.

Why wrap `<html>` and not just `<body>`? Because Next.js can render things outside `<body>` (fonts, metadata, etc.) and those components might also need to know who's logged in. Wrapping the whole document ensures nothing is left outside the context.

---

### Why catch-all routes for auth pages? (`[[...sign-in]]`)

The folder name `[[...sign-in]]` has two parts:
- `[[...]]` — optional catch-all: matches `/sign-in` AND `/sign-in/anything/else`
- `sign-in` — just a variable name (could be anything)

Clerk's `<SignIn>` component is a multi-step flow. After you enter your email, Clerk navigates to sub-paths like `/sign-in/factor-one` (for the OTP step) or `/sign-in/sso-callback` (for Google/GitHub login). Without the catch-all, those sub-paths would hit a 404 and the sign-in flow would break.

The catch-all makes sure ALL paths under `/sign-in/` render your page file, regardless of what Clerk adds to the URL.

---

### Why CSS variables for Clerk's appearance, not hardcoded colors?

The project's color system lives in `globals.css`:
```css
:root {
  --accent-primary: #00c8d4;
  --bg-base: #080809;
  /* ... */
}
```

When we configure Clerk:
```typescript
variables: {
  colorPrimary: 'var(--accent-primary)',
  colorBackground: 'var(--bg-base)',
}
```

We're not passing `#00c8d4` — we're passing the variable *reference*. The browser resolves it at paint time.

This matters because if the design system ever changes (say the brand color shifts from teal to violet), you update one CSS variable and Clerk's forms update automatically. Hardcoding `#00c8d4` would mean Clerk's forms stay teal forever, drifting out of sync with the rest of the app.

---

### Why does the home page just redirect?

```typescript
// app/page.tsx
export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/editor')
  redirect('/sign-in')
}
```

The root `/` isn't a destination — it's a routing decision point. If you're logged in, you want the editor. If not, you want to sign in. There's no reason to show a loading screen or landing page in between.

`redirect()` sends an HTTP 307 response. The component never renders any HTML — it just tells the browser "go here instead."

`async/await` is needed because `auth()` reads from Clerk's server-side session, which is an async operation. Next.js server components can be async, which means they work like Node.js async functions running on the server.

---

## Further Reading

- [Next.js 16 proxy.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — the file convention that replaced middleware.ts
- [Clerk clerkMiddleware](https://clerk.com/docs/references/nextjs/clerk-middleware) — how route protection works
- [Clerk appearance variables](https://clerk.com/docs/customization/variables) — all valid variable names
- [Clerk custom sign-in pages](https://clerk.com/docs/references/nextjs/custom-signup-signin-pages) — why [[...sign-in]] is needed
- [Next.js environment variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) — NEXT_PUBLIC_ explained
- [MDN: Nullish coalescing ??](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- [React Context](https://react.dev/learn/passing-data-deeply-with-context) — what ClerkProvider is doing under the hood
