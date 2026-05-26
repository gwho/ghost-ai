# Plan: Feature 07 — Wire Editor Home to Real Project API

## Context

Feature 06 built the project REST API. Feature 07 wires the editor home sidebar and dialogs to that API, replacing all mock data with real server-side fetching and live mutations.

The current editor layout was a `"use client"` component, which blocked server-side data fetching. The fix: convert the layout to a server component and extract client interactivity (sidebar toggle state, context provider) into a new `EditorShell` client component.

## Architecture Change

```
Before:
  app/editor/layout.tsx  →  "use client", useState, ProjectDialogsProvider (mock data)

After:
  app/editor/layout.tsx  →  server component, fetches projects, renders EditorShell
  components/editor/editor-shell.tsx  →  "use client", useState, ProjectDialogsProvider (real data)
```

## Files Created

### `lib/project-data.ts`
Server-side data helper.

```ts
export type ProjectItem = { id: string; name: string; isOwned: boolean }

export async function getEditorProjects(): Promise<{
  owned: ProjectItem[]
  shared: ProjectItem[]
}>
```

- Uses `auth()` for `userId`, `currentUser()` for `email` (needed for collaborator lookup)
- Owned: `prisma.project.findMany({ where: { ownerId: userId } })`
- Shared: `prisma.projectCollaborator.findMany({ where: { email }, include: { project } })`
- Both queries run in parallel via `Promise.all`

### `hooks/use-project-actions.ts`
Replaces `use-project-dialogs.ts`. Accepts initial server data as arguments.

```ts
export function useProjectActions(
  initialOwned: ProjectItem[],
  initialShared: ProjectItem[]
): ProjectActionsContextValue
```

Key behaviors:
- **State sync:** `useEffect` keyed on `initialOwned.map(p => p.id).join(",")` re-syncs local state after `router.refresh()` delivers new props
- **Create slug preview:** `toSlug(name) + "-" + randomSuffix()` — suffix generated fresh per `openCreate()` call, held in `useRef`
- **Create:** `POST /api/projects`, then `router.push(/editor/${project.id})`
- **Rename:** `PATCH /api/projects/${id}`, optimistic local state update, then `router.refresh()`
- **Delete:** `DELETE /api/projects/${id}`, remove from local state, then `router.push("/editor")` if `pathname === /editor/${id}`, else `router.refresh()`

### `components/editor/editor-shell.tsx`
Client component extracted from the old layout. Owns sidebar open state. Wraps `ProjectDialogsProvider` with initial data props.

### `components/editor/editor-home-actions.tsx`
Thin `"use client"` component that renders the New Project button. Needed because the home page is now a server component but the button must call `openCreate()` from context.

## Files Modified

### `app/editor/layout.tsx`
Converted to server component. Fetches projects and renders `EditorShell`.

```ts
export default async function EditorLayout({ children }) {
  const { owned, shared } = await getEditorProjects()
  return <EditorShell initialOwned={owned} initialShared={shared}>{children}</EditorShell>
}
```

### `app/editor/page.tsx`
Converted to server component. Renders static JSX + `<EditorHomeActions />`.

### `components/editor/project-dialogs-context.tsx`
- Imports `useProjectActions` instead of `useProjectDialogs`
- Provider accepts `initialOwned` and `initialShared` props

### `components/editor/project-sidebar.tsx`
- `MockProject` → `ProjectItem` (from `lib/project-data`)
- Local `ProjectItem` component renamed to `ProjectListItem` (avoids name collision with the type)

## Files Deleted

- `hooks/use-project-dialogs.ts` — fully replaced by `use-project-actions.ts`

## Key Notes

- **Server/client split:** layouts can be server components as long as client interactivity is pushed into child client components. The `EditorShell` pattern is the standard Next.js App Router way to do this.
- **State sync after refresh:** `useState` does not re-initialize from new props on re-render. We sync via `useEffect` keyed on a stable string derived from the project IDs.
- **Shared projects:** looked up by user email (stored in `ProjectCollaborator.email`), not by Clerk `userId`.
- **Room ID alignment:** project `id` (cuid) acts as the Liveblocks room ID — no separate field needed. The dialog slug preview (`{slug}-{suffix}`) is display only.

## Verification

- `npm run build` — passed clean, `/editor` appears as `ƒ (Dynamic)`
- Sidebar shows real owned/shared projects on initial load (no mock data)
- Create navigates to `/editor/{project.id}`
- Rename updates sidebar name
- Delete from the active workspace redirects to `/editor`; delete from elsewhere refreshes the sidebar
