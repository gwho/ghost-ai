# Spec Explanation: Feature 06 — Project API Routes

## What This Feature Does

This feature adds the four server-side endpoints that let the app manage projects in the database. Before this, the UI used fake ("mock") data that only lived in memory and disappeared on refresh. Now projects are real — they get saved to PostgreSQL and survive page reloads.

## The Four Endpoints

An **endpoint** is a URL your code can call to do something on the server. We have four:

| Verb | URL | What It Does |
|---|---|---|
| `GET` | `/api/projects` | Fetch all projects that belong to the current user |
| `POST` | `/api/projects` | Create a new project |
| `PATCH` | `/api/projects/[projectId]` | Rename an existing project |
| `DELETE` | `/api/projects/[projectId]` | Delete an existing project |

The `[projectId]` in the URL is a placeholder. When you call the real API, you fill it in with the actual ID, like `/api/projects/clz3abc123`.

## Why REST Verbs?

REST is a convention — a shared language for APIs. Instead of naming endpoints by what they do (`/renameProject`, `/deleteProject`), REST reuses the HTTP method (GET, POST, PATCH, DELETE) to carry the meaning. That way, the URL stays clean (`/api/projects/[id]`) and the verb tells you the intent.

- **GET** = read, never changes anything
- **POST** = create something new
- **PATCH** = partially update something (just the name in our case)
- **DELETE** = remove it

## Why Do We Check Auth In Every Handler?

The middleware file (`proxy.ts`) already blocks unauthenticated visitors from reaching any page or API route. So why do we check `userId` again inside each handler?

**Defense in depth.** If the middleware ever gets misconfigured, or someone calls the API directly from a script, we want a second wall. The check costs almost nothing and prevents any accidental data leaks.

## What Is An OwnerId?

When a user creates a project, we store their Clerk user ID as `ownerId` on the project row. This is how we know who the project belongs to.

Later, when that user wants to rename or delete the project, we:
1. Look up the project by its ID
2. Compare `project.ownerId` to the current user's ID
3. If they don't match → return `403 Forbidden`

This means even if someone knows another user's project ID, they cannot touch it.

## Status Codes — Why These Numbers?

HTTP status codes are a standardized way to say "here is what happened":

| Code | Meaning | When We Use It |
|---|---|---|
| 200 | OK | Successful GET or PATCH |
| 201 | Created | Successful POST (new project created) |
| 204 | No Content | Successful DELETE — nothing to return |
| 401 | Unauthorized | No valid login session |
| 403 | Forbidden | Logged in, but not the owner |
| 404 | Not Found | That project ID doesn't exist |

## Why Default The Name To "Untitled Project"?

The spec says: *default missing project name to `Untitled Project`*. This is a UX safety net — if someone calls `POST /api/projects` with no body, or with an empty name, we don't crash or create a nameless project. We give it a sensible default that the user can rename later.

## What Is The `params` Promise Thing?

In Next.js 16, route parameters like `[projectId]` are delivered as a `Promise`, not a plain object. That means you have to `await` them before you can read the ID:

```ts
const { projectId } = await params   // ✅ Next.js 16
// vs
const { projectId } = params         // ❌ old Next.js — would be undefined or break TypeScript
```

This is a breaking change from earlier versions. Always `await params` in dynamic route handlers.

## What Files Were Created?

- `app/api/projects/route.ts` — handles GET and POST
- `app/api/projects/[projectId]/route.ts` — handles PATCH and DELETE

These are **Route Handlers** in Next.js App Router. Each file exports named functions matching the HTTP verbs it handles (`GET`, `POST`, `PATCH`, `DELETE`). Next.js wires them automatically — no extra registration needed.
