# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 18 — Starter Templates (complete)

## Current Goal

- Feature 19 — next planned feature.

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
- 12-shape-panel: components/editor/shape-panel.tsx — floating pill toolbar at bottom-center of canvas with 6 draggable shape buttons (rectangle, diamond, circle, pill, cylinder, hexagon) using Lucide icons; onDragStart sets application/ghost-shape dataTransfer payload with shape name and default dimensions. components/editor/canvas-node.tsx — custom node renderer registered as nodeTypes.canvasNode; renders every shape as a bordered rectangle with label centered and 4 Handle connection points; applies fill/text color from NODE_COLORS. canvas-flow.tsx refactored — split into CanvasFlow (outer, adds ReactFlowProvider) and CanvasFlowInner (inner, uses both useLiveblocksFlow and useReactFlow); onDragOver + onDrop handlers on wrapper div convert screen position to canvas coordinates via screenToFlowPosition and call onNodesChange([{ type: 'add', item }]); node IDs use shape-timestamp-counter format. Build clean.
- 13-node-shape: canvas-node.tsx replaced placeholder renderer with shape-specific CSS (rectangle/pill/circle) and SVG (diamond/hexagon/cylinder) rendering that scales with node size and brightens borders on selection. shape-panel.tsx gained a custom drag ghost preview — the browser default drag image is suppressed and a semi-transparent shape ghost follows the cursor during drag, cleared on drop or cancel.
- 14-node-editing: canvas-node.tsx gained NodeResizer (from @xyflow/react) on all 6 shapes — shows subtle accent-primary handles when selected, enforces minWidth 80 / minHeight 40. Added inline label editing: double-click opens a textarea overlay in the label area; onChange calls updateNodeData (syncs via Liveblocks); blur or Escape closes editing. nodrag/nopan classes + onMouseDown stopPropagation prevent canvas drag/pan during text interaction. Build clean.
- 15-node-color-toolbar: canvas-node.tsx gained a NodeToolbar (from @xyflow/react) with 8 color swatches rendered above selected nodes. Each swatch maps to a NODE_COLORS pair — clicking calls updateNodeData({ color: fill }) which Liveblocks auto-syncs to all collaborators. Active swatch shows a text-color outline ring; hover shows a tight rgba glow from the swatch text color. nodrag/nopan + stopPropagation prevent toolbar interactions from dragging or panning the canvas. Build clean.
- 16-edge-behavior: components/editor/canvas-edge.tsx created — custom edge renderer using getSmoothStepPath for right-angle routing; inline SVG marker per edge (id=canvas-arrow-${id}) keeps arrowhead colour in sync with hover/select state; wide invisible stroke (strokeWidth=16, strokeOpacity=0) provides an easy click/hover target; EdgeLabelRenderer positions a label div at the path midpoint; double-click opens an auto-sized input that syncs via updateEdgeData (Liveblocks auto-broadcasts); saved labels render as pill badges; faint "label" hint appears on active unlabelled edges; nodrag/nopan + stopPropagation prevent canvas drag during editing. canvas-flow.tsx registers canvasEdge edgeType and sets defaultEdgeOptions to type canvasEdge. types/canvas.ts gained EdgeData interface (label?: string). globals.css gained handle fade-in CSS — handles hidden by default, fade in on node hover and during connection mode. Build clean.
- 17-canvas-ergonomics: hooks/useKeyboardShortcuts.ts created — attaches a window keydown listener; editable-field guard skips shortcuts inside INPUT/TEXTAREA/contentEditable; supports +/= zoom in, - zoom out, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y redo; effect cleanup removes listener on unmount or dependency change. components/editor/canvas-controls.tsx created — floating pill bar at bottom-left with Minus/Maximize2/Plus zoom buttons (useReactFlow internally) and Undo2/Redo2 history buttons; undo/redo disabled + dimmed when canUndo/canRedo is false; all zoom calls use { duration: 200 } for smooth animation. canvas-flow.tsx updated — useHistory/useCanUndo/useCanRedo imported from @liveblocks/react; useReactFlow result stored as reactFlow variable passed to useKeyboardShortcuts; CanvasControls rendered above ShapePanel. Build clean.
- 18-starter-templates: components/editor/starter-templates.ts created — CanvasTemplate interface (id, name, description, nodes, edges); CANVAS_TEMPLATES array with three templates (Microservices Architecture, CI/CD Pipeline, Event-Driven System) built with makeNode/makeEdge helpers using shared CanvasNode/CanvasEdge types and NODE_COLORS palette. components/editor/starter-templates-modal.tsx created — Dialog with scrollable 2-column card grid; each card shows a TemplatePreview (HTML canvas element drawing edges as lines and nodes as filled rounded rectangles via bounding-box scale calculation, no React Flow instance); Import button calls onImport then closes modal. canvas-flow.tsx updated — CanvasFlowProps interface added (isTemplatesOpen, onTemplatesOpenChange); loadTemplate callback clears existing nodes/edges via remove changes then adds template nodes/edges via add changes, then calls fitView({ duration: 200 }); StarterTemplatesModal rendered inside CanvasFlowInner. canvas-wrapper.tsx updated — forwards isTemplatesOpen/onTemplatesOpenChange props to CanvasFlow. workspace-shell.tsx updated — isTemplatesOpen state; Templates navbar button (LayoutTemplate icon) opens modal; CanvasWrapper receives new props. Build clean.
- refactor-hook-separation: Extracted `use-project-actions.ts` monolith into three focused hooks — `hooks/use-project-dialogues.ts` (dialog UI state, slug preview), `hooks/use-project-actions.ts` (project mutations, API calls, navigation only), and `hooks/use-project-share.ts` (clipboard copy, collaborator CRUD). Share dialog logic moved from inline in `share-dialog.tsx` into the new share hook. `project-dialogs-context.tsx` composes both hooks and spreads into the same context shape — no consumer changes. This PR scope also includes collaborative canvas runtime dependencies (`@liveblocks/client`, `@liveblocks/react`, `@liveblocks/react-flow`, `@xyflow/react`) and collaborative canvas behavior delivered in Features 10–12 (Liveblocks auth/session, shared React Flow canvas shell, and shape-panel drag/drop node creation). Validation: `npm run lint` currently fails in `app/api/liveblocks-auth/route.ts` due a pre-existing syntax error; `npm run build` also fails there and on blocked Google Fonts fetch in this environment. Doc at `docs/refactors/refactor-hook-separation.md`.

## In Progress

- None.

## Next Up

- Feature 19 — next planned feature.

## Open Questions

- Add unresolved product or implementation questions here.

## Architecture Decisions

- **RSC-first rendering** — Default to React Server Components throughout; `"use client"` is added only for browser interactivity, hooks, or real-time state. Client-only code is extracted into dedicated shell components (`editor-shell.tsx`, `editor-home-actions.tsx`) so route-level files stay server components.

- **Clerk middleware at root** — `proxy.ts` handles route protection declaratively (public: `/sign-in`, `/sign-up`; all else protected). Auth identity is resolved server-side via `auth()` in every route handler — never trusted from the client.

- **Centralised access control in `lib/project-access.ts`** — `getCurrentIdentity()` and `getProjectAccess()` are the single source of truth for auth and ownership resolution. Route handlers and server components call these helpers rather than re-implementing ownership logic inline.

- **Prisma multi-file schema** — Schema split across `prisma/schema.prisma` (datasource/generator) and `prisma/models/project.prisma` (models) via `prisma.config.ts`. Keeps model definitions isolated and independently extensible as the schema grows.

- **Prisma client routing on `DATABASE_URL` prefix** — `lib/prisma.ts` branches on whether `DATABASE_URL` starts with `prisma+postgres://` (Prisma Accelerate/cloud) or not (local `@prisma/adapter-pg`). One client file handles both environments without separate config branches.

- **Storage split: PostgreSQL for metadata, Vercel Blob for artifacts** — Project records, collaborator rows, and spec references live in PostgreSQL. Canvas snapshots (`canvas/{projectId}.json`) and generated specs (`specs/{projectId}/{specId}.md`) live in Vercel Blob; the database stores only the blob URL. Prevents large generated content from bloating relational rows.

- **`ProjectDialogsProvider` context composing focused hooks** — Dialog UI state (`use-project-dialogues.ts`), project mutations (`use-project-actions.ts`), and share/collaborator logic (`use-project-share.ts`) are kept in separate single-responsibility hooks. The context provider composes all three and spreads a unified shape — consumers need no changes when the internals are refactored.

- **Canvas state owned by Liveblocks, not local React state** — `useLiveblocksFlow` wraps React Flow so nodes and edges live in the shared Liveblocks room. All mutations (`updateNodeData`, `updateEdgeData`, `onNodesChange`) broadcast to collaborators automatically without any manual sync logic in components.

- **Liveblocks room token gated behind project membership** — `POST /api/liveblocks-auth` calls `getProjectAccess()` before issuing any session token. Users outside the owner/collaborator set receive a 403 and are never admitted to the room, regardless of room ID guessing.

- **Deterministic cursor colour via djb2 hash** — `getCursorColor()` in `lib/liveblocks.ts` maps a Clerk user ID to one of 10 palette entries via a djb2 hash. Colour is stable across sessions and requires no per-user storage.

- **Custom `canvasNode` and `canvasEdge` renderers registered via `nodeTypes`/`edgeTypes`** — All shape rendering, inline editing, colour toolbar, resize handles, and arrowhead sync are encapsulated in dedicated renderer files (`canvas-node.tsx`, `canvas-edge.tsx`) rather than patched into React Flow's defaults. New shape behaviour is added in one place.

- **Per-edge inline SVG arrowhead marker** — Each edge embeds its own `<marker>` element keyed to `canvas-arrow-${id}`. This keeps arrowhead colour in sync with hover/select state without a shared global marker that cannot be individually styled.

- **Handle visibility via CSS, not JS state** — Connection handles are hidden by default and revealed on node hover or during connection mode via `globals.css` rules. No component-level state or event listeners are needed to show/hide handles.

## Session Notes

### Docs layer — where to find past decisions
- `docs/spec-explanations/` — beginner-friendly write-ups for every completed feature (01–17, plus 18-starter-templates-explanation.md). Read one before touching a feature's code.
- `docs/fixes/` — one file per bug fix, explaining what broke, why, and the reusable lesson. Consult before debugging recurring categories (email case, Liveblocks auth, Prisma adapter config).
- `docs/plans/` — implementation plans written before each feature was built. Useful for understanding the intended design before a feature was refined.
- `docs/refactors/` — rationale for structural refactors (e.g. hook separation in `refactor-hook-separation.md`).
- `docs/spec-to-code-mapping.md` — maps each product feature from `context/project-overview.md` to the files that implement it.

### Duplicate " 2" files — do not edit
Several directories contain macOS Finder duplicates with a ` 2` suffix in the filename (e.g. `lib/liveblocks 2.ts`, `hooks/use-project-dialogues 2.ts`, `components/editor/canvas-node 2.tsx`). These are stale copies and cause TypeScript type conflicts. Always edit the canonical file (no suffix). The duplicates need a cleanup pass — until that happens, ignore them entirely.

### Non-standard package versions
The versions in use have breaking changes compared to common training data:
- **Next.js 16** — consult `node_modules/next/dist/docs/` before writing any routing, middleware, or server-component code. AGENTS.md requires this.
- **Prisma 7** — multi-file schema support via `prisma.config.ts` is a Prisma 7 feature; client is generated at `lib/generated/prisma` (non-default path).
- **@liveblocks 3.x** — API surface differs from 1.x/2.x; `useLiveblocksFlow` is the correct React Flow integration hook.
- **@xyflow/react 12.x** — replaces the old `reactflow` package; import from `@xyflow/react`, not `reactflow`.

### Build and lint environment notes
- Google Fonts is unreachable in this dev environment — `npm run build` fails on the font fetch. This is an environment constraint, not a code bug.
- Past entries (refactor-hook-separation) noted a syntax error in `app/api/liveblocks-auth/route.ts`; the file appears clean as of Feature 16. Run `npm run build` to confirm current build state before starting a new feature.

### Email case sensitivity — recurring bug category
Clerk email addresses have been the source of multiple collaborator-access bugs. Emails from Clerk `emailAddresses` can be mixed-case; the database normalises to lowercase. Always `.toLowerCase()` when comparing or querying. See `docs/fixes/fix-collaborator-email-case-mismatch.md` and related entries for the full history.

### AI Copilot sidebar — started but not formally tracked
`components/editor/ai-copilot-sidebar.tsx` exists and has a " 2" duplicate, suggesting it was under active development. It is not yet listed in Completed and has no spec-explanation entry. Check the file state before assuming it is production-ready.
