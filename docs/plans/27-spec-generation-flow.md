# Plan: Feature 27 — Spec Generation Flow

## Context

Features 22–26 established the full AI design pipeline (prompt → Trigger.dev task → Liveblocks canvas mutation → realtime tracking in the sidebar). Feature 27 extends this pattern to spec generation: a user can request an AI-generated Markdown technical spec from the current canvas state and chat history. This feature covers the backend only — the Trigger.dev task, the spec trigger route, and the token route for realtime tracking.

---

## Files created

| File | Role |
|------|------|
| `trigger/generate-spec.ts` | Trigger.dev `schemaTask` — generates the spec using Gemini, uploads to Vercel Blob, creates a `ProjectSpec` record |
| `app/api/ai/spec/route.ts` | `POST /api/ai/spec` — authenticates user, validates payload, triggers the task, saves a `TaskRun` record, returns `runId` |
| `app/api/ai/spec/token/route.ts` | `POST /api/ai/spec/token` — verifies `TaskRun` ownership, issues a scoped Trigger.dev public read token (1 h) |

---

## Key design decisions

### 1. `schemaTask` with Zod validation
The task uses `schemaTask` instead of `task` so Zod validates the payload before `run()` executes. Invalid payloads are rejected cleanly at the Trigger.dev layer, not inside the task body.

### 2. `roomId` is trusted as `projectId`
The spec route resolves project access from `roomId` (which equals `projectId` in this system) using `getProjectAccess()`. A client-supplied `projectId` is never trusted — this mirrors the design agent route pattern.

### 3. TaskRun persisted after a successful trigger
If `tasks.trigger()` succeeds but the Prisma `TaskRun.create()` fails, the route returns `202 { runId, trackingUnavailable: true }` instead of 500. The spec run still proceeds; only realtime tracking via the token route is unavailable. This prevents a Prisma transient failure from cancelling an already-started run.

### 4. Metadata updates for realtime progress
The task calls `metadata.set('status', 'generating' | 'saving' | 'complete')` at each stage. These updates power the `useRealtimeRun` subscription in the sidebar (Feature 29) so users see live progress.

### 5. Private blob access
The spec is uploaded to Vercel Blob with `access: 'private'`. The blob URL is stored in `ProjectSpec.filePath` but never returned directly to the client — access always goes through the authenticated download route (Feature 28).

---

## Verification checklist

- [ ] `POST /api/ai/spec` returns `{ runId }` for a valid authenticated request
- [ ] A `TaskRun` record is created for the authenticated user
- [ ] `POST /api/ai/spec/token` only returns a token for the run owner
- [ ] `generate-spec` runs through Trigger.dev and uploads a `.md` file to Vercel Blob
- [ ] A `ProjectSpec` row is created with the blob URL in `filePath`
- [ ] TypeScript and lint pass
