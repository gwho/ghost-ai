# Plan: Feature 06 — Project API Routes

## Context

The database schema (Feature 05) is complete. Feature 06 builds the backend REST API for project CRUD. The UI already has mock data in `components/editor/project-dialogs.tsx` — this feature wires the persistence layer but does not connect the UI yet.

## Files Created

### `app/api/projects/route.ts`
Handles `GET` (list) and `POST` (create).

```
GET  /api/projects       → list caller's projects, ordered by createdAt desc
POST /api/projects       → create project; default name = "Untitled Project"
```

### `app/api/projects/[projectId]/route.ts`
Handles `PATCH` (rename) and `DELETE` (delete).

```
PATCH  /api/projects/[projectId]  → rename (owner only)
DELETE /api/projects/[projectId]  → delete (owner only)
```

## Auth Pattern

- `await auth()` from `@clerk/nextjs/server` is called in every handler.
- If `userId` is null → return `401`. (Belt-and-suspenders; middleware in `proxy.ts` also blocks it.)
- For `[projectId]` routes: fetch the project first. If not found → `404`. If `project.ownerId !== userId` → `403`.

## Implementation

### GET /api/projects
```ts
const { userId } = await auth()
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const projects = await prisma.project.findMany({
  where: { ownerId: userId },
  orderBy: { createdAt: 'desc' },
})
return NextResponse.json(projects)
```

### POST /api/projects
```ts
const body = await req.json().catch(() => ({}))
const name: string = (typeof body?.name === 'string' && body.name.trim()) || 'Untitled Project'
const project = await prisma.project.create({ data: { ownerId: userId, name } })
return NextResponse.json(project, { status: 201 })
```

### PATCH /api/projects/[projectId]
```ts
const project = await prisma.project.findUnique({ where: { id: projectId } })
if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
if (project.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
const body = await req.json()
const updated = await prisma.project.update({ where: { id: projectId }, data: { name: body.name } })
return NextResponse.json(updated)
```

### DELETE /api/projects/[projectId]
```ts
const project = await prisma.project.findUnique({ where: { id: projectId } })
if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
if (project.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
await prisma.project.delete({ where: { id: projectId } })
return new NextResponse(null, { status: 204 })
```

## Key Notes

- `params` in Next.js 16 App Router dynamic route handlers is a `Promise` — must be awaited: `const { projectId } = await params`
- `prisma` singleton from `lib/prisma.ts` branches on `DATABASE_URL` prefix (Prisma Postgres Accelerate vs direct `pg` adapter)
- No UI wiring in this feature — spec explicitly says backend only

## Verification

- `npm run build` — passed clean, both routes appear as `ƒ (Dynamic)`
- Manual test checklist:
  - `GET /api/projects` without auth → 401
  - `GET /api/projects` with valid Clerk session → 200, array
  - `POST /api/projects` with `{ "name": "My Project" }` → 201
  - `POST /api/projects` with no body → 201, name = "Untitled Project"
  - `PATCH /api/projects/:id` as owner → 200, updated name
  - `PATCH /api/projects/:id` as non-owner → 403
  - `DELETE /api/projects/:id` as owner → 204
  - `DELETE /api/projects/:id` as non-owner → 403
