# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 11 — Base Canvas (complete)

## Current Goal

- Feature 12 — next planned feature.

## Completed

- 01-design-system: shadcn/ui configured (base-nova style, @base-ui/react), all 7 UI primitive components added to components/ui/, lucide-react installed, lib/utils.ts cn() helper created, globals.css fully configured with project dark theme tokens and Tailwind v4 @theme mapping, html element marked dark.
- 02-editor: components/editor/editor-navbar.tsx (fixed navbar, PanelLeftOpen/Close toggle), components/editor/project-sidebar.tsx (fixed overlay sidebar, Tabs: My Projects + Shared, New Project button). Dialog pattern confirmed ready via existing components/ui/dialog.tsx wired to design tokens.
- 03-auth: ClerkProvider added to root layout with dark theme (@clerk/ui/themes) and CSS variable overrides. proxy.ts created at root for route protection (public: /sign-in, /sign-up; all else protected). Sign-in and sign-up pages use two-panel layout (left: logo/tagline/features, right: Clerk form; small screens: form only). / redirects authenticated → /editor, unauthenticated → /sign-in. UserButton added to editor navbar right section. Build verified passing.
- 04-project-dialogs: Editor home screen with New Project button. Create/Rename/Delete dialogs with dedicated useProjectDialogs hook and ProjectDialogsProvider context. Sidebar project items with rename/delete actions (owned projects only); shared projects show no actions. Mobile backdrop scrim added to layout. All mock data — no persistence. Build clean, zero lint/TS errors.
- 05-prisma: Prisma 7 schema with multi-file support (prisma.config.ts + prisma/schema.prisma + prisma/models/project.prisma). Project and ProjectCollaborator models with correct relations, indexes, and cascade delete. lib/prisma.ts singleton branches on DATABASE_URL prefix (prisma+postgres:// → accelerateUrl, otherwise → @prisma/adapter-pg). Generated client at lib/generated/prisma. Migration applied to Prisma Postgres cloud DB. Build clean.
- 06-project-apis: REST route handlers for GET/POST /api/projects and PATCH/DELETE /api/projects/[projectId]. Auth via Clerk auth(), 401 for unauthenticated, 403 for non-owner mutations. Default project name "Untitled Project". Backend only — no UI wiring. Build clean.
- 07-wire-editor-home: lib/project-data.ts getEditorProjects() server helper (owned + shared via Clerk email). hooks/use-project-actions.ts replaces mock hook — real fetch/PATCH/DELETE calls, router.push on create, router.refresh on rename/delete, redirect to /editor if deleting active workspace. app/editor/layout.tsx converted to server component; client shell extracted to components/editor/editor-shell.tsx. app/editor/page.tsx converted to server component; New Project button extracted to editor-home-actions.tsx. Sidebar and dialogs typed against ProjectItem. Build clean.
- 08-editor-workspace-shell: lib/project-access.ts with getCurrentIdentity() and getProjectAccess() helpers. components/editor/access-denied.tsx (lock icon, back link). app/editor/[roomId]/page.tsx server component — redirects unauthenticated to /sign-in, renders AccessDenied for missing/unauthorized projects, renders WorkspaceShell. components/editor/workspace-shell.tsx client component — workspace bar with project name, Share and AI toggle buttons; canvas placeholder; collapsible right AI sidebar placeholder. project-sidebar.tsx updated with usePathname() to highlight the active project. Removed accidentally committed macOS duplicates lib/prisma 2.ts and prisma/schema 2.prisma (were causing TypeScript type conflict). Build clean.
- 09-share-dialog: REST endpoints GET/POST /api/projects/[projectId]/collaborators and DELETE /api/projects/[projectId]/collaborators/[collaboratorId] — owner-only mutations, Clerk Backend API enrichment of collaborator emails with display name and avatar. components/editor/share-dialog.tsx client component — project link copy with "Copied!" feedback, invite by email input (owner only), collaborator list with avatar/initials, remove button (owner only), collaborator read-only view. WorkspaceShell updated with isOwner prop and wired Share button. Build clean.
- 10-liveblocks-setup: liveblocks.config.ts typed with Presence (cursor x/y + isThinking) and UserMeta (name, avatar, color). lib/liveblocks.ts — lazy-initialized cached @liveblocks/node client (getLiveblocksClient()) + getCursorColor() helper that deterministically maps a user ID to one of 10 palette colors via djb2 hash. POST /api/liveblocks-auth — requires Clerk auth, verifies project membership via getProjectAccess(), calls getOrCreateRoom() to ensure the room exists, returns a prepareSession token with name/avatar/color attached. Returns 403 for unauthorized access. @liveblocks/node installed. Build clean.
- 11-base-canvas: types/canvas.ts with NodeData (label, color, shape), CanvasNode, CanvasEdge types, NODE_COLORS (8 dark fill/text pairs), and NODE_SHAPES (rectangle, diamond, circle, pill, cylinder, hexagon). components/editor/canvas-flow.tsx — client component using useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true }) with ReactFlow, dot-pattern Background, MiniMap, and ConnectionMode.Loose. components/editor/canvas-wrapper.tsx — LiveblocksErrorBoundary (class component) wrapping LiveblocksProvider + RoomProvider (initialPresence cursor: null) + ClientSideSuspense. workspace-shell.tsx updated to render CanvasWrapper instead of the canvas placeholder. Build clean.
- refactor-hook-separation: Extracted `use-project-actions.ts` monolith into three focused hooks — `hooks/use-project-dialogues.ts` (dialog UI state, slug preview), `hooks/use-project-actions.ts` (project mutations, API calls, navigation only), and `hooks/use-project-share.ts` (clipboard copy, collaborator CRUD). Share dialog logic moved from inline in `share-dialog.tsx` into the new share hook. `project-dialogs-context.tsx` composes both hooks and spreads into the same context shape — no consumer changes. Build clean. Doc at `docs/refactors/refactor-hook-separation.md`.

## In Progress

- None.

## Next Up

- Feature 12 — next planned feature.

## Open Questions

- Add unresolved product or implementation questions here.

## Architecture Decisions

- Add decisions that affect the system design or data model.

## Session Notes

- Added beginner tutorial at `docs/tutorials/beginner-nextjs-typescript-component-basics.md` while studying `components/editor/project-sidebar.tsx`.
