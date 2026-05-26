# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 07 — Wire Editor Home to Real API (complete)

## Current Goal

- Feature 08 — next planned feature.

## Completed

- 01-design-system: shadcn/ui configured (base-nova style, @base-ui/react), all 7 UI primitive components added to components/ui/, lucide-react installed, lib/utils.ts cn() helper created, globals.css fully configured with project dark theme tokens and Tailwind v4 @theme mapping, html element marked dark.
- 02-editor: components/editor/editor-navbar.tsx (fixed navbar, PanelLeftOpen/Close toggle), components/editor/project-sidebar.tsx (fixed overlay sidebar, Tabs: My Projects + Shared, New Project button). Dialog pattern confirmed ready via existing components/ui/dialog.tsx wired to design tokens.
- 03-auth: ClerkProvider added to root layout with dark theme (@clerk/ui/themes) and CSS variable overrides. proxy.ts created at root for route protection (public: /sign-in, /sign-up; all else protected). Sign-in and sign-up pages use two-panel layout (left: logo/tagline/features, right: Clerk form; small screens: form only). / redirects authenticated → /editor, unauthenticated → /sign-in. UserButton added to editor navbar right section. Build verified passing.
- 04-project-dialogs: Editor home screen with New Project button. Create/Rename/Delete dialogs with dedicated useProjectDialogs hook and ProjectDialogsProvider context. Sidebar project items with rename/delete actions (owned projects only); shared projects show no actions. Mobile backdrop scrim added to layout. All mock data — no persistence. Build clean, zero lint/TS errors.
- 05-prisma: Prisma 7 schema with multi-file support (prisma.config.ts + prisma/schema.prisma + prisma/models/project.prisma). Project and ProjectCollaborator models with correct relations, indexes, and cascade delete. lib/prisma.ts singleton branches on DATABASE_URL prefix (prisma+postgres:// → accelerateUrl, otherwise → @prisma/adapter-pg). Generated client at lib/generated/prisma. Migration applied to Prisma Postgres cloud DB. Build clean.
- 06-project-apis: REST route handlers for GET/POST /api/projects and PATCH/DELETE /api/projects/[projectId]. Auth via Clerk auth(), 401 for unauthenticated, 403 for non-owner mutations. Default project name "Untitled Project". Backend only — no UI wiring. Build clean.
- 07-wire-editor-home: lib/project-data.ts getEditorProjects() server helper (owned + shared via Clerk email). hooks/use-project-actions.ts replaces mock hook — real fetch/PATCH/DELETE calls, router.push on create, router.refresh on rename/delete, redirect to /editor if deleting active workspace. app/editor/layout.tsx converted to server component; client shell extracted to components/editor/editor-shell.tsx. app/editor/page.tsx converted to server component; New Project button extracted to editor-home-actions.tsx. Sidebar and dialogs typed against ProjectItem. Build clean.

## In Progress

- None.

## Next Up

- Feature 08 — next planned feature.

## Open Questions

- Add unresolved product or implementation questions here.

## Architecture Decisions

- Add decisions that affect the system design or data model.

## Session Notes

- Added beginner tutorial at `docs/tutorials/beginner-nextjs-typescript-component-basics.md` while studying `components/editor/project-sidebar.tsx`.
