# Plan: Feature 22 — Design Agent API

## Goal

Wire up the backend scaffolding for AI-driven canvas generation. No AI logic yet. After this feature: a submitted prompt triggers a durable Trigger.dev background task, the run is recorded in Prisma, and the frontend can obtain a scoped token to subscribe to run updates.

---

## What Already Existed

- `trigger/generate-canvas-design.ts` — a Trigger.dev v4 task stub with placeholder output. Used as the pattern reference for `design-agent.ts`.
- `lib/prisma.ts` — Prisma client singleton; `prisma.taskRun` is accessible immediately after `prisma generate`.
- `lib/project-access.ts` — not used in these routes; ownership is enforced via the `TaskRun.userId` check in the token route.
- `@trigger.dev/sdk` (v4.4.6) — already installed; `tasks.trigger()` and `auth.createPublicToken()` are the two SDK calls needed.

---

## New Files

### `prisma/models/task-run.prisma`

```prisma
model TaskRun {
  id        String   @id @default(cuid())
  runId     String   @unique
  projectId String
  userId    String
  createdAt DateTime @default(now())

  @@index([runId])
  @@index([userId, projectId])
}
```

Run after creating:
```bash
npx prisma migrate dev --name add-task-run
```

---

### `trigger/design-agent.ts`

Minimal task that accepts `{ prompt, roomId }`, logs the input, and returns a stub. Follows the same `task()` + `retry` pattern as `generate-canvas-design.ts`.

---

### `app/api/ai/design/route.ts`

**POST** — triggers the task, records the run, returns `{ runId }`:
1. `auth()` → 401 if not authenticated.
2. Parse `{ prompt, roomId, projectId }` from body → 400 if missing.
3. `tasks.trigger<typeof designAgent>('design-agent', { prompt, roomId })` → gets `handle.id`.
4. `prisma.taskRun.create({ runId: handle.id, projectId, userId })`.
5. Return `{ runId: handle.id }` with status 201.

---

### `app/api/ai/design/token/route.ts`

**POST** — verifies ownership, issues a scoped public token:
1. `auth()` → 401 if not authenticated.
2. Parse `{ runId }` from body → 400 if missing.
3. `prisma.taskRun.findUnique({ where: { runId } })` → 404 if not found or `userId` mismatch.
4. `triggerAuth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: '1h' })`.
5. Return `{ token }`.

Note: `auth` is imported from both Clerk and Trigger.dev SDK — the Trigger.dev one is aliased as `triggerAuth`.

---

## Modified Files

### `app/api/projects/[projectId]/canvas/route.ts`

Fixed a pre-existing TS error: lines 117–122 referenced bare `nodes`/`edges` variables that were not in scope (they exist inside `payload` from `parseCanvasPayload`). Removed the redundant array check (already performed inside `parseCanvasPayload`) and switched subsequent calls to `payload.nodes`/`payload.edges`.

---

## Verification Checklist

- [ ] `npm run build` passes — both `/api/ai/design` and `/api/ai/design/token` appear in Route output
- [ ] `POST /api/ai/design` with `{ prompt, roomId, projectId }` + valid session → returns `{ runId }`
- [ ] Run appears in Trigger.dev dashboard
- [ ] `TaskRun` row created in DB with correct `runId`, `projectId`, `userId`
- [ ] `POST /api/ai/design/token` with `{ runId }` + same user → returns `{ token }`
- [ ] `POST /api/ai/design/token` with different user → returns 404
- [ ] `trigger/design-agent.ts` exports `designAgent` task with id `design-agent`
