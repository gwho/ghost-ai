# Spec Explanation — Feature 08: Editor Workspace Shell

## Why this spec exists

The editor home (`/editor`) shows a project list and landing message. But once a user clicks into a project, the app needs a workspace — a route that checks access, shows the project context, and lays out the surfaces that will eventually hold the canvas and AI chat. This spec builds that shell without any real canvas or AI logic.

## Key concepts

### Server components and access control

`/editor/[roomId]/page.tsx` is a server component. This means:
- It runs on the server before any HTML is sent to the browser
- It can call `auth()` (Clerk) and Prisma directly — no API round trip needed
- Access checks happen before the user sees anything

The access check sequence: is the user signed in? → does this project exist? → are they the owner or a collaborator? Three gates, each returning early if not met.

### `lib/project-access.ts` — why a separate helper

Access checks will be needed in multiple places (workspace page, future Liveblocks token endpoint, future mutation guards). Extracting them into `lib/project-access.ts` keeps each route handler thin and makes the rules easy to read and test independently.

`getProjectAccess` does one Prisma query (with collaborators included) and returns either `{ project, isOwner }` or `null`. The caller decides what to do with `null` — redirect, show AccessDenied, or return 403.

### `AccessDenied` component

Intentionally generic — the same component covers "project not found" and "not authorized." Showing distinct messages would let an unauthorized user probe whether a project ID exists.

### `WorkspaceShell` — client component

The workspace bar needs interactivity (AI sidebar toggle), so this is a client component. It's kept thin — no business logic, just layout state. When Liveblocks is added, the canvas area becomes its own component; the shell doesn't change.

### Active project highlighting in the sidebar

`ProjectSidebar` is already a client component. Adding `usePathname()` lets it derive the active project ID from the URL (`/editor/<id>`) without prop drilling from the layout. The match regex `^\/editor\/([^/]+)` captures the first path segment after `/editor/` and ignores anything deeper (future sub-routes within a workspace).

### Why the workspace bar is inside `<main>`, not in `EditorNavbar`

`EditorNavbar` is rendered by `EditorShell` in the layout — it doesn't know which project is active. Rather than wiring project context through the layout chain, the workspace bar lives in the page's own component tree, which already has access to the project. This is simpler and keeps the layout generic.
