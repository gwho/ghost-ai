# Feature 08 — Editor Workspace Shell

## What was built

`/editor/[roomId]` — a server-rendered workspace route with access control, a workspace-specific layout, and active project highlighting in the sidebar.

## Files created

| File | Purpose |
|---|---|
| `lib/project-access.ts` | Server helpers: `getCurrentIdentity()` (Clerk userId + email) and `getProjectAccess(projectId)` (owner or collaborator check via Prisma) |
| `components/editor/access-denied.tsx` | Server component shown when a project is missing or the user lacks access — centered lock icon, message, back link |
| `components/editor/workspace-shell.tsx` | Client component rendering the workspace layout — project name bar, Share and AI toggle buttons, canvas placeholder, collapsible right AI sidebar placeholder |
| `app/editor/[roomId]/page.tsx` | Server component — auth guard (redirect to /sign-in), access gate (render AccessDenied), then WorkspaceShell |

## Files modified

| File | Change |
|---|---|
| `components/editor/project-sidebar.tsx` | Added `usePathname()` to derive the active project ID from the URL; `ProjectListItem` now accepts `isActive` prop and applies `bg-elevated` highlight |

## Files deleted

| File | Reason |
|---|---|
| `lib/prisma 2.ts` | macOS Finder duplicate accidentally committed; caused TypeScript type conflict at build time |
| `prisma/schema 2.prisma` | Same — macOS duplicate of `prisma/schema.prisma` |

## Access model

`getProjectAccess` covers two access paths:
1. Owner: `project.ownerId === userId`
2. Collaborator: any `ProjectCollaborator` row where `email` matches the user's primary Clerk email

If the project is not found or neither condition is true, the function returns `null` and `AccessDenied` renders.

## Layout structure

```
[Global navbar — EditorNavbar, 56px]     ← from EditorShell (layout.tsx)
[Workspace bar — project name | share | AI toggle]
[Canvas placeholder | AI sidebar (conditionally shown)]
```

The workspace bar and body live inside `<main className="pt-14 h-full">` from EditorShell.

## Scope boundaries (not yet built)

- No Liveblocks canvas
- No real sharing behavior
- No AI chat — right panel is a placeholder only
