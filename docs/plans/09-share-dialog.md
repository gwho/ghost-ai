# Feature 09 — Share Dialog

## What was built

A functioning share dialog behind the Share button in the workspace, plus the
three API endpoints that back it.

## Files created

| File | Purpose |
|---|---|
| `app/api/projects/[projectId]/collaborators/route.ts` | GET (list collaborators, enriched with Clerk) and POST (invite by email, owner only) |
| `app/api/projects/[projectId]/collaborators/[collaboratorId]/route.ts` | DELETE (remove collaborator, owner only) |
| `components/editor/share-dialog.tsx` | Client dialog — project link copy, invite form (owners), collaborator list with avatars, remove buttons (owners) |

## Files modified

| File | Change |
|---|---|
| `components/editor/workspace-shell.tsx` | Added `isOwner` prop; added `isShareOpen` state; wired Share button `onClick`; renders `<ShareDialog>` |
| `app/editor/[roomId]/page.tsx` | Passes `isOwner={access.isOwner}` to `WorkspaceShell` |

## API design

### GET `/api/projects/[projectId]/collaborators`
- Access: owner or collaborator (via `getProjectAccess`)
- Returns `CollaboratorItem[]` sorted by `createdAt asc`
- Clerk enrichment: `clerkClient().users.getUserList({ emailAddress: emails })` then maps by email address to `{ name, avatarUrl }`

### POST `/api/projects/[projectId]/collaborators`
- Access: owner only
- Validates email format with regex
- Guards: rejects owner's own email (400), duplicate (409)
- Inserts into `ProjectCollaborator`, enriches the new row with Clerk, returns 201

### DELETE `/api/projects/[projectId]/collaborators/[collaboratorId]`
- Access: owner only
- Looks up by `id + projectId` → 404 if not found
- Deletes and returns 204

## Ownership enforcement

All three endpoints reuse `getProjectAccess(projectId)` from `lib/project-access.ts`
for the auth + membership check. POST and DELETE additionally check `isOwner === true`
before proceeding.

## Clerk enrichment helper

`enrichWithClerk(emails)` in the collaborators route batches all emails into one
`getUserList` call, then builds a `Map<email, { name?, avatarUrl? }>` by iterating
every email address on every returned Clerk user. This handles cases where the
collaborator's stored email is not their Clerk primary email.

## Avatar fallback

No shadcn `<Avatar>` component is installed. `CollaboratorAvatar` renders an
`<img>` if `avatarUrl` is present; otherwise a `<div>` showing two-letter
initials derived from the display name or email address.
