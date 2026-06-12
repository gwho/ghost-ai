# Feature 28: Spec Persistence + Download — Implementation Plan

## What We're Building

The spec generation task already produces Markdown text from a canvas, but that text is never saved anywhere. This feature closes the loop:

1. Upload the generated Markdown to Vercel Blob (the same storage used for canvas snapshots)
2. Record the Blob URL in a new `ProjectSpec` Prisma model
3. Expose a secure download route so users can retrieve their spec as a `.md` file

No UI is added in this feature — that comes later. This is purely backend plumbing.

## Why It's Done This Way

### Storage split: Prisma for metadata, Blob for content

Spec files can be large. Storing them in PostgreSQL would bloat the database and slow queries. Instead:

- **PostgreSQL** stores a small `ProjectSpec` row: `id`, `projectId`, `filePath` (the Blob URL), `createdAt`
- **Vercel Blob** stores the actual Markdown content at `specs/{projectId}/{specId}.md`

This mirrors exactly how canvas snapshots already work (`canvas/{projectId}.json`).

### Spec ID generated in the task, not the route

The `specId` is a `crypto.randomUUID()` generated inside `trigger/generate-spec.ts`. This means the blob path and the Prisma record share the same ID — no second round-trip needed.

### Access check before blob fetch

The download route never exposes a Blob URL directly. It:
1. Resolves the project from the URL parameter via `getProjectAccess`
2. Queries `ProjectSpec` to confirm the spec belongs to that project
3. Only then fetches the blob

This prevents URL guessing and unauthorised access.

## Files Changed

### New
- `prisma/models/project-spec.prisma` — `ProjectSpec` model
- `prisma/migrations/20260609000000_add_project_spec/migration.sql` — SQL for the new table
- `app/api/projects/[projectId]/specs/[specId]/download/route.ts` — secure download endpoint

### Modified
- `trigger/generate-spec.ts` — after `generateText`, upload to Blob and create `ProjectSpec` record
- `prisma/models/project.prisma` — added `specs ProjectSpec[]` reverse relation to `Project`

## Key Code Patterns

### Blob upload in the task
```ts
const specId = crypto.randomUUID()
const blob = await put(
  `specs/${projectId}/${specId}.md`,
  result.text,
  { access: 'private', contentType: 'text/markdown; charset=utf-8', addRandomSuffix: false }
)
await prisma.projectSpec.create({
  data: { id: specId, projectId, filePath: blob.url }
})
return { spec: result.text, specId, specUrl: blob.url }
```

### Download route
```ts
const access = await getProjectAccess(projectId)            // membership check
const spec = await prisma.projectSpec.findFirst(...)        // ownership proof
const blobResult = await get(spec.filePath, { access: 'private' })
return new NextResponse(text, {
  headers: {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="spec-${specId}.md"`,
  },
})
```

## Verification Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx eslint trigger/generate-spec.ts app/api/projects/\[projectId\]/specs/\[specId\]/download/route.ts` passes
- [ ] `ProjectSpec` type is visible in `lib/generated/prisma/index.d.ts`
- [ ] Migration SQL creates the table with correct columns and foreign key
- [ ] Download route returns `Content-Disposition: attachment` header
