# Plan: Feature 28 — Spec Persistence and Download

## Context

Feature 27 generates a spec and uploads it to Vercel Blob, but there was no way to list or retrieve it. Feature 28 adds the data model and the download route that make the blob securely accessible, plus the listing endpoint that the UI (Feature 29) needs to enumerate all specs for a project.

---

## Files created / modified

| File | Action |
|------|--------|
| `prisma/models/project-spec.prisma` | **Created** — `ProjectSpec` model with `id`, `projectId`, `filePath`, `createdAt` |
| `prisma/migrations/20260609000000_add_project_spec/migration.sql` | **Created** — migration applying the model to the DB |
| `app/api/projects/[projectId]/specs/route.ts` | **Created** — `GET /api/projects/[projectId]/specs` listing endpoint |
| `app/api/projects/[projectId]/specs/[specId]/download/route.ts` | **Created** — `GET` download route |

---

## Key design decisions

### 1. Metadata in Postgres, content in Vercel Blob
`ProjectSpec` stores only the blob URL (`filePath`), not the spec text. The actual Markdown lives in Vercel Blob at `specs/{projectId}/{specId}.md`. This keeps the relational database lean and avoids large text in rows — the same pattern used for canvas persistence.

### 2. The download route as the only content access point
The client never receives the raw blob URL. All content access goes through `GET /api/projects/[projectId]/specs/[specId]/download`, which enforces authentication and project membership before fetching from Blob and streaming the response. This prevents unauthenticated reads even if someone guesses the blob path.

### 3. Listing endpoint returns metadata only
`GET /api/projects/[projectId]/specs` returns `{ id, filePath, createdAt }` for each spec. The UI uses `id` for download/preview calls and `createdAt` for display — the raw `filePath` URL is never rendered in the browser or stored in frontend state long-term.

### 4. Compound index on `(projectId, createdAt)`
The `ProjectSpec` model has `@@index([projectId, createdAt])`. The listing endpoint orders by `createdAt DESC`, so this index makes the query efficient even as the number of specs grows.

---

## Verification checklist

- [ ] `ProjectSpec` model has `id`, `projectId`, `filePath`, `createdAt` with correct relation
- [ ] Migration applied successfully
- [ ] `GET /api/projects/[projectId]/specs` returns spec list for project members
- [ ] `GET .../download` returns file content with `Content-Disposition: attachment`
- [ ] Unauthorized users get 401; non-members get 403
- [ ] TypeScript and lint pass
