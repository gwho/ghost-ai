# Plan: Feature 27 — Spec Generation Flow

## What We're Building

This feature adds the backend pipeline that converts a completed architecture canvas into a Markdown technical specification. It has three parts that work together:

```
Browser → POST /api/ai/spec → Trigger.dev background task (generate-spec)
                ↓
          TaskRun saved to DB
                ↓
Browser → POST /api/ai/spec/token → scoped read token
                ↓
Frontend polls run status via Trigger.dev Realtime
```

## Why Three Separate Pieces?

**The API route (`POST /api/ai/spec`)** is a thin handler. It authenticates the user, validates the request, and hands off to Trigger.dev. It never does the actual AI work — that would time out in a serverless function.

**The Trigger.dev task (`generate-spec`)** is a durable background job. It can run for minutes without timing out. It calls Gemini, tracks progress via metadata, and returns the generated Markdown.

**The token route (`POST /api/ai/spec/token`)** gives the frontend a short-lived, read-only credential scoped to one specific run. Without it, the frontend would need your full Trigger.dev secret key to watch run status — which would be a security hole.

## Files Created

### `trigger/generate-spec.ts`

Uses `schemaTask` (Zod-validated payload) rather than the bare `task`. This means Trigger.dev automatically validates the incoming payload before the `run` function executes — no manual parsing needed inside the task.

Input schema:
- `projectId` — the project this spec belongs to (derived from roomId on the API side)
- `roomId` — the Liveblocks room (same as projectId in this system)
- `chatHistory` — array of chat messages from the design discussion
- `nodes` — canvas nodes (components)
- `edges` — canvas edges (connections between components)

The task builds a plain-text prompt from the canvas data, sends it to Gemini with a detailed system prompt, sets `metadata.status` to `'generating'` and then `'complete'` for realtime tracking, and returns `{ spec: result.text }` as plain Markdown.

### `app/api/ai/spec/route.ts`

- Authenticates with Clerk (`auth()`)
- Validates body: `roomId` (string), `chatHistory` (array), `nodes` (array), `edges` (array)
- Resolves project access from `roomId` via `getProjectAccess(roomId)` — never trusts a client-supplied projectId
- Triggers `generate-spec` task
- Persists a `TaskRun` record linking `runId → userId + projectId` for ownership tracking
- Returns `{ runId }` with 201, or `{ runId, trackingUnavailable: true }` with 202 if DB persistence fails after the task has already started

### `app/api/ai/spec/token/route.ts`

- Authenticates with Clerk
- Looks up `TaskRun` by `runId`
- Returns 404 if not found or owned by a different user
- Issues a Trigger.dev public token scoped to `read.runs[runId]` with 1h expiry
- Returns `{ token }`

## Key Constraints (Scope Limits)

- No frontend changes — this feature is backend-only
- No spec storage — the task returns Markdown but does not write to Vercel Blob
- No new AI abstraction — uses Gemini directly via `@ai-sdk/google` exactly as `design-agent.ts` does
- No client-trusted projectId — project is always resolved from `roomId`

## Patterns Reused

| Pattern | Source |
|---------|--------|
| `auth()` Clerk check | `app/api/ai/design/route.ts` |
| `getProjectAccess(roomId)` | `lib/project-access.ts` |
| `tasks.trigger<typeof ...>()` + TaskRun persist | `app/api/ai/design/route.ts` |
| `triggerAuth.createPublicToken(...)` | `app/api/ai/design/token/route.ts` |
| `schemaTask` + Zod schema | CLAUDE.md Trigger.dev examples |
| `google('gemini-2.5-flash-lite')` via `generateText` | `trigger/design-agent.ts` |
| `metadata.set(...)` for progress | CLAUDE.md advanced task examples |
