# AI Discussion Topics: AI Architect False Start Failure

Use these prompts to reason about the bug and the fix.

## 1. Task Start vs. Task Tracking

**Question:** In a Trigger.dev flow, why is receiving a `runId` enough to treat the task as started? What separate failures can still happen after that?

**What to understand:** Starting a durable task and subscribing to its progress are different operations. A tracking token can fail while the task keeps running.

## 2. Liveblocks as a Fallback Signal

**Question:** Why can the sidebar use Liveblocks `ai-status` broadcasts as a completion fallback when Trigger realtime tracking is unavailable?

**What to understand:** The design agent already broadcasts room-scoped status events, and every connected client inside the `RoomProvider` can receive them independently.

## 3. Avoiding Duplicate Completion Messages

**Question:** If both `useRealtimeRun` and Liveblocks `ai-status` can report completion, why do we need a `completionHandledRef` guard?

**What to understand:** Multiple asynchronous channels can deliver the same terminal fact. UI completion handlers should be idempotent.

## 4. Response Shape Validation

**Question:** Why should the client validate that `/api/ai/design` returns `{ runId: string }` and `/api/ai/design/token` returns `{ token: string }` instead of trusting `response.ok`?

**What to understand:** HTTP success only proves a status code. It does not prove the JSON contract is correct.

## 5. User Feedback Precision

**Question:** What is the practical difference between "Failed to start AI design run" and "Design run started, but realtime tracking is unavailable"?

**What to understand:** Accurate status text helps users trust the system and helps developers debug the correct boundary.

## 6. Post-Trigger Persistence Failure

**Question:** What can go wrong when an API route calls `tasks.trigger()` before writing its local `TaskRun` database record?

**What to understand:** External side effects cannot be rolled back by local database failures. If the task starts and the database insert fails, the UI needs a degraded-but-started response, not a generic failure.

## 7. Migrations vs. Generated Prisma Client

**Question:** Why can `prisma.taskRun.create()` exist in TypeScript while the database still has no `TaskRun` table?

**What to understand:** Prisma client generation reflects the schema files. The actual database only changes when migrations are applied.
