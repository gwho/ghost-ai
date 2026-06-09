# Feature 28: Spec Persistence + Download — How It Works

## The Problem Before This Feature

When a user clicks "Generate Spec," a Trigger.dev task calls the Gemini AI model and gets back a Markdown document. The task returned that text — but nobody saved it. It lived only in the Trigger.dev run result, which is temporary. You could read it via realtime tracking while the task ran, but as soon as you refreshed the page, it was gone.

## What Changed

Three new things were added:

### 1. A new database table: `ProjectSpec`

```sql
CREATE TABLE "ProjectSpec" (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,   -- which project this spec belongs to
  filePath  TEXT NOT NULL,   -- the Vercel Blob URL where the Markdown lives
  createdAt TIMESTAMP ...
);
```

This table stores **metadata only** — not the actual Markdown text. The text lives in Vercel Blob. This is the same pattern used for canvas snapshots.

### 2. The task now saves the spec after generating it

`trigger/generate-spec.ts` was extended. After the AI returns the spec text:

1. A random ID is created: `crypto.randomUUID()`
2. The Markdown is uploaded to Vercel Blob at `specs/{projectId}/{specId}.md`
3. A `ProjectSpec` row is written to the database linking the spec ID to the project and the Blob URL
4. The task returns `{ spec, specId, specUrl }` instead of just `{ spec }`

The spec is now durably stored and will survive page refreshes.

### 3. A download route

`GET /api/projects/{projectId}/specs/{specId}/download`

When called, it:
1. Checks the user is logged in (Clerk auth)
2. Confirms the user has access to the project (`getProjectAccess`)
3. Looks up the `ProjectSpec` record — confirms the spec belongs to that project (prevents guessing other project's spec IDs)
4. Fetches the Markdown from Vercel Blob
5. Returns it as a file download with `Content-Disposition: attachment`

The browser will download a `spec-{specId}.md` file when this route is hit.

## Important Concepts

### Why store the Blob URL, not the Markdown?

Large text in a relational database is slow to query and bloats the table. Vercel Blob is designed for file storage. The database becomes a fast index ("which specs exist and where?") while Blob handles the actual content.

### Why check project membership AND spec ownership?

Checking `getProjectAccess(projectId)` proves the user can read this project. Checking `projectSpec.findFirst({ where: { id: specId, projectId } })` proves the spec actually belongs to that project — it prevents an attacker from using a valid project they have access to in order to download a spec from a different project.

### Why generate the `specId` in the task?

The task generates both the blob path and the Prisma ID from the same UUID. This avoids a two-step flow (create record first, then upload). The task is the source of truth for the spec's identity.

### `metadata.set('status', 'saving')` — a new status

Before feature 28, the task set status to `'generating'` while calling the AI, then `'complete'` when done. Now it also sets `'saving'` between the AI call and the Prisma write. Any realtime subscriber watching the run will see this intermediate state.

## Files You'd Look At

| File | What it does |
|---|---|
| [prisma/models/project-spec.prisma](../../prisma/models/project-spec.prisma) | Defines the `ProjectSpec` model |
| [prisma/migrations/20260609000000_add_project_spec/migration.sql](../../prisma/migrations/20260609000000_add_project_spec/migration.sql) | Creates the table in PostgreSQL |
| [trigger/generate-spec.ts](../../trigger/generate-spec.ts) | Generates spec and saves it |
| [app/api/projects/[projectId]/specs/[specId]/download/route.ts](../../app/api/projects/%5BprojectId%5D/specs/%5BspecId%5D/download/route.ts) | Secure download endpoint |
