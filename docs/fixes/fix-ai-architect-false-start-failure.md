# Fix: AI Architect False "Failed to Start" Feedback

## What Was Broken

The AI Architect tab posted:

```text
Failed to start AI design run. Please try again.
```

for prompts where the canvas graph still appeared later.

That message was false. The design run had started; only a later feedback/tracking step failed.

## Root Cause

`components/editor/ai-sidebar.tsx` wrapped the design start request and Trigger realtime token request in one broad `try/catch`.

The important sequence was:

```text
POST /api/ai/design       -> Trigger task starts and returns runId
POST /api/ai/design/token -> UI gets a public token for useRealtimeRun
```

If the second request failed, returned an unexpected shape, or the realtime tracking setup later became unavailable, the catch block still posted "Failed to start." But once `/api/ai/design` returns a valid `runId`, Trigger.dev has already enqueued the `design-agent` task. The later token/subscription path only controls progress observation.

This matches the symptom: the background task continued, then Liveblocks `mutateFlow` updated the canvas a few moments later.

After refreshing the browser, the issue still reproduced. That exposed a second backend root cause in `app/api/ai/design/route.ts`:

```ts
const handle = await tasks.trigger(...)
await prisma.taskRun.create(...)
return NextResponse.json({ runId: handle.id }, { status: 201 })
```

The task was started before the `TaskRun` row was written. The repository had `prisma/models/task-run.prisma` and a generated Prisma client containing `TaskRun`, but no migration file creating the actual `TaskRun` table. If `prisma.taskRun.create()` fails after `tasks.trigger()` succeeds, the route returns an error response even though the design agent is already running.

## What Changed

All implementation changes are in `components/editor/ai-sidebar.tsx`.

### 1. API responses are validated

The client now checks that:

- `/api/ai/design` returns `{ runId: string }`
- `/api/ai/design/token` returns `{ token: string }`

Unexpected response shapes fail explicitly instead of silently passing bad values into `useRealtimeRun`.

### 2. A run becomes active after `runId`

As soon as the design route returns a valid `runId`, the sidebar:

- stores the run ID
- turns on loading state
- updates AI thinking presence
- shows "AI design run started..."

The UI no longer waits for the realtime token before acknowledging that the task started.

### 3. Token failures no longer say "failed to start"

If token setup fails after the run starts, the sidebar posts:

```text
Design run started, but realtime tracking is unavailable. Watching canvas status instead.
```

That is accurate: the task is running, but the Trigger realtime observer is degraded.

### 4. Liveblocks status is now a fallback completion path

The design agent already broadcasts `ai-status` events through Liveblocks. The sidebar now treats `complete` and `error` events as fallback terminal signals when Trigger realtime tracking is unavailable.

A `completionHandledRef` guard prevents duplicate final messages if both Trigger realtime and Liveblocks status report completion.

### 5. The design route now distinguishes trigger failure from persistence failure

`POST /api/ai/design` now:

- validates request field types before starting work
- verifies project access before starting work
- returns `502` only when `tasks.trigger()` itself fails
- returns `202` with `{ runId, trackingUnavailable: true }` when the Trigger run starts but `TaskRun` persistence fails

The client recognizes `trackingUnavailable` and skips the token request, showing the degraded tracking message immediately.

### 6. The missing migration was added

Added:

```text
prisma/migrations/20260608000000_add_task_run/migration.sql
```

This creates the `TaskRun` table and indexes expected by the token route.

The migration was applied to the configured Prisma Postgres database with:

```bash
npx prisma migrate deploy
```

## Why This Fixes It

Trigger.dev and Liveblocks are doing two different jobs:

- Trigger.dev starts and runs the durable AI task.
- Liveblocks carries collaborative canvas updates and room-scoped status broadcasts.

The old UI conflated "task did not start" with "tracking token/subscription was not available." The fix makes those states separate, so a started run gets started-run feedback and can still complete through the Liveblocks status path.

## Files Modified

- `components/editor/ai-sidebar.tsx`
- `app/api/ai/design/route.ts`
- `prisma/migrations/20260608000000_add_task_run/migration.sql`

## Validation

- `npx eslint components/editor/ai-sidebar.tsx` passes.
- `npx eslint components/editor/ai-sidebar.tsx app/api/ai/design/route.ts` passes.
- `npx tsc --noEmit --pretty false` passes.
- `npx prisma migrate status` reports the database schema is up to date.
- `npm run build` fails because the environment cannot fetch Google Fonts (`Geist`, `Geist Mono`), matching the known project note.
- `npm run lint` fails because generated `.trigger/tmp` output is linted and contains third-party/generated violations.
