# Feature 27 — Spec Generation Flow

## What Changed

Three new files were added — no existing files were modified.

| File | Role |
|------|------|
| `trigger/generate-spec.ts` | Durable background task that calls Gemini and returns Markdown |
| `app/api/ai/spec/route.ts` | HTTP endpoint that starts a spec run and saves ownership |
| `app/api/ai/spec/token/route.ts` | HTTP endpoint that issues a scoped read token for the run |

## The Problem Being Solved

Generating a technical spec from a canvas takes time — potentially 10–30 seconds of AI work. You cannot do that inside a Next.js API route handler because serverless functions time out after a few seconds.

The solution is to split the work into two phases:
1. **Start phase** — the API route validates the request, kicks off a background task, and returns a `runId` immediately (usually in under a second)
2. **Work phase** — the Trigger.dev task runs in the background, calls Gemini, and stores its result when done

The frontend uses the `runId` to watch progress and retrieve the output once complete.

## Why `schemaTask` Instead of `task`

`design-agent.ts` uses `task` with a plain TypeScript type for its payload:
```ts
task({ run: async (payload: { prompt: string; roomId: string }) => { ... } })
```

`generate-spec.ts` uses `schemaTask` with a Zod schema:
```ts
schemaTask({ schema: SpecPayloadSchema, run: async (payload) => { ... } })
```

The difference: `schemaTask` automatically validates and parses the payload before your `run` function sees it. If the payload doesn't match the schema, the task fails immediately with a clear error — no manual `if typeof` checks inside the run body.

This matters more here than in the design agent because the spec task accepts arrays (`chatHistory`, `nodes`, `edges`) where types can't be checked with a single `typeof`.

## Why `roomId === projectId`

In this system, the Liveblocks room ID is always equal to the project ID. When the client opens a workspace at `/editor/[roomId]`, that `roomId` is the same string as the Prisma `Project.id`.

The spec says "do not trust a client-supplied `projectId`". This means the API route accepts only `roomId` from the client and derives the project from it — it never reads a `projectId` field from the request body. This prevents a client from triggering a spec run against a project they don't own by guessing another project's ID.

```ts
// GOOD — project resolved from authenticated roomId
const access = await getProjectAccess(roomId)

// BAD — never do this
const access = await getProjectAccess(body.projectId)
```

## How the Token Route Enforces Ownership

The `TaskRun` table links `runId → userId + projectId`. When a client requests a token:

1. `prisma.taskRun.findUnique({ where: { runId } })` — finds the record
2. `taskRun.userId !== userId` — checks the owner matches the authenticated user
3. If either fails → `404` (not `403`, to avoid leaking whether the run exists)

Only the user who started the run can get a read token for it. This prevents one user from watching another user's spec generation even if they somehow obtained the `runId`.

## What `metadata.set` Does

Inside the task, two metadata updates happen:

```ts
metadata.set('status', 'generating')   // immediately on start
// ... Gemini call ...
metadata.set('status', 'complete')     // after result is ready
```

These are visible to anyone subscribed to the run via the Trigger.dev Realtime API. The frontend (when it implements the Specs tab) can use `useRealtimeRun` and read `run.metadata.status` to show a progress indicator while waiting.

## What the Task Returns

```ts
return { spec: result.text }
```

The task output is plain Markdown text in a `spec` property. The spec intentionally does not store this output — storing to Vercel Blob is left for a future feature. For now, the client retrieves the output from `run.output.spec` once the run completes.

## Reusable Lessons

**1. Thin API routes, thick background tasks.** API routes should validate, authorize, enqueue, and return. Long-running work belongs in Trigger.dev tasks.

**2. `schemaTask` is the right choice when payloads contain arrays or nested objects.** It runs Zod validation for free and gives typed access to `payload` inside `run`.

**3. Always persist `TaskRun` after a successful trigger — before returning the response.** If persistence fails after the task has already started, return `202` with `trackingUnavailable: true` so the client knows the task is running even though token-based tracking won't work.

**4. Derive project access from authenticated identifiers.** `roomId` is supplied by the client but validated against the authenticated user via `getProjectAccess`. Never use a client-supplied `projectId` directly.

**5. Scoped public tokens expire.** The 1h expiry means a leaked token becomes useless quickly. Always scope tokens to the minimum read surface (`runs: [runId]`).
