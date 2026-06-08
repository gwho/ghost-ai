# Plan: Fix AI Architect False Start Failure Feedback

## Problem

Submitting an AI Architect prompt posts "Failed to start AI design run. Please try again." even though the architecture graph appears on the canvas a few moments later.

That means the Trigger.dev task is being enqueued and the Liveblocks canvas mutation is succeeding. The broken part is the client feedback path after task start, not the design agent itself.

## Analysis

The sidebar currently treats the whole sequence as one operation:

1. Write the user prompt to the Liveblocks architect feed.
2. `POST /api/ai/design`.
3. Read `runId`.
4. `POST /api/ai/design/token`.
5. Read Trigger public token.
6. Mount `useRealtimeRun`.

If any step after `/api/ai/design` succeeds throws, the catch block posts the same "Failed to start" message. That is misleading because `/api/ai/design` returning a valid `runId` means Trigger.dev has already accepted the run.

After the first client-side fix, the issue still reproduced. The server route showed why:

1. `tasks.trigger()` starts the Trigger.dev run.
2. `prisma.taskRun.create()` runs after the task starts.
3. The `TaskRun` migration was missing from `prisma/migrations`, so persistence can fail after the run has already started.
4. The route returned an error response, so the client still had no `runId` to classify the run as started.

Best-practice split:

- Trigger.dev: task start is proven by a valid run handle. Realtime token/subscription setup is a separate observation path.
- Liveblocks: canvas mutation and `ai-status` broadcasts are independent collaborative signals. They can be used as a fallback completion signal when Trigger realtime tracking is unavailable.

## Implementation

1. Validate response shapes at the client boundary.
   - Confirm `/api/ai/design` returns a string `runId`.
   - Confirm `/api/ai/design/token` returns a string `token`.

2. Mark the design run as active immediately after a valid `runId`.
   - Set `runId`, loading state, and thinking presence before requesting the realtime token.
   - Show "AI design run started..." instead of waiting for token setup.

3. Split start failure from tracking failure.
   - If `/api/ai/design` fails before a `runId`, keep the existing failure message.
   - If token creation/fetch/shape validation fails after a `runId`, show a tracking warning instead of "failed to start."

4. Use Liveblocks `ai-status` as a fallback completion signal.
   - On `complete` or `error`, call the same completion handler used by Trigger realtime tracking.
   - Guard completion with a ref so Trigger and Liveblocks cannot post duplicate final messages.

5. Harden `/api/ai/design`.
   - Validate request fields before triggering the task.
   - Verify project access before triggering the task.
   - If `tasks.trigger()` fails, return a real start failure.
   - If `TaskRun` persistence fails after `tasks.trigger()` succeeds, return `{ runId, trackingUnavailable: true }` with `202 Accepted`.

6. Add the missing migration.
   - Create `prisma/migrations/20260608000000_add_task_run/migration.sql`.

## Verification

- `npx eslint components/editor/ai-sidebar.tsx` passes.
- `npx eslint components/editor/ai-sidebar.tsx app/api/ai/design/route.ts` passes.
- `npx tsc --noEmit --pretty false` passes.
- `npx prisma migrate deploy` applied `20260608000000_add_task_run`; `npx prisma migrate status` reports the database schema is up to date.
- `npm run build` remains blocked by the known Google Fonts network fetch in this environment.
- `npm run lint` remains blocked by generated `.trigger/tmp` files being included in ESLint.
