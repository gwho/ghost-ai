# Spec Explanation: Feature 22 — Design Agent API

## What This Feature Does

Before Feature 22, the AI sidebar could accept a prompt from the user but had nowhere to send it. There was no backend to receive the request.

Feature 22 adds the backend plumbing:

1. **POST `/api/ai/design`** — receives a prompt from the client, fires a Trigger.dev background task, saves a record of the run to Postgres, and returns a run ID.
2. **`TaskRun` database model** — a thin record that links a Trigger.dev run ID to the user who requested it and the project it belongs to.
3. **POST `/api/ai/design/token`** — accepts a run ID, verifies the caller owns it, and returns a short-lived Trigger.dev "public token" the frontend can use to subscribe to run progress in real time.
4. **`trigger/design-agent.ts`** — the actual background task. For now it just logs the prompt and returns a stub. AI logic comes later.

No nodes are generated yet. This feature is purely about making the backend wiring correct.

---

## Why Background Tasks Instead of a Normal API Response?

A typical API route is expected to finish in under a few seconds. Generating architecture diagrams with an AI model can take 10–30 seconds or more. If that work ran inside a route handler:

- The HTTP connection would time out
- Retries would be impossible without re-running the whole AI call
- There'd be no way to track progress or stream partial updates

Trigger.dev solves this by moving the slow work into a **durable background task**:

```
Client → POST /api/ai/design
             ↓
        tasks.trigger() — enqueues the work
             ↓
        return { runId }   ← instant response
                  ↓
         (background) design-agent task runs
```

The route returns immediately. The client uses the `runId` to poll or subscribe to the task's progress separately.

**Analogy:** When you submit a large order for printing, the print shop doesn't make you wait at the counter for an hour. They give you a claim ticket (the `runId`) and you come back later. Background tasks work the same way.

---

## The TaskRun Model — Why Store It at All?

Trigger.dev already knows about the run internally. Why do we store it in Prisma too?

The token route needs to answer: **"Does this user own this run?"** Trigger.dev has no concept of your app's users — it only knows about runs. Prisma is where your app stores ownership information.

```
TaskRun {
  runId     → the Trigger.dev run ID
  projectId → which Ghost AI project requested this
  userId    → which Clerk user submitted the prompt
  createdAt → when
}
```

When the frontend calls `POST /api/ai/design/token`, the route:
1. Looks up the `TaskRun` by `runId`
2. Checks that `taskRun.userId === userId` (from Clerk auth)
3. Only if that passes, issues the token

Without this table, any user could request a token for any run — including runs they didn't start.

---

## What Is a Public Token?

Trigger.dev tasks run in Trigger.dev's cloud, not in your Next.js server. For the browser to subscribe to a run's updates, it needs a credential.

But you can't hand the browser your server-side `TRIGGER_SECRET_KEY` — that would expose full API access to anyone who opens DevTools.

Instead, you issue a **scoped public token**:

```ts
const token = await triggerAuth.createPublicToken({
  scopes: { read: { runs: [runId] } },
  expirationTime: '1h',
})
```

This token:
- Is **read-only** — the holder can observe the run, not trigger or cancel it
- Is **scoped** — only valid for this one run ID
- **Expires** — useless after 1 hour

The frontend receives this token and passes it to a Trigger.dev React hook (`useRealtimeRun`) to subscribe to the run. It never sees the secret key.

**Analogy:** A concert venue sells a general-admission ticket and a backstage pass. The public token is the general-admission ticket — it lets you in to watch, not to run the show.

---

## Why Two `auth` Imports?

The token route imports `auth` from two different packages:

```ts
import { auth } from '@clerk/nextjs/server'       // resolves the current user
import { auth as triggerAuth } from '@trigger.dev/sdk'  // issues the Trigger.dev token
```

Both packages export a function called `auth`, so one must be aliased to avoid a name collision. The alias `triggerAuth` makes the intent of each call obvious at the call site.

---

## The Canvas Route Fix (Bonus)

Feature 22 also fixed a pre-existing TypeScript error in `app/api/projects/[projectId]/canvas/route.ts`.

The `PUT` handler called `parseCanvasPayload(body)` — a function that internally validates the body and returns `{ nodes, edges }` if valid, or `null` if not. The result was stored in `payload`. But then the code immediately checked:

```ts
if (!Array.isArray(nodes) || !Array.isArray(edges)) { ... }  // ❌ nodes/edges not in scope
```

`nodes` and `edges` don't exist in scope at that point — they live inside `payload`. The fix:

1. Remove the redundant array check (it's already done inside `parseCanvasPayload`)
2. Use `payload.nodes` and `payload.edges` in subsequent validation calls

This is a classic case of **dead code that references the wrong scope** — the variables existed inside the helper function but were never extracted into the handler.

---

## Prop / Data Flow

```
Client submits prompt
  → POST /api/ai/design
      → tasks.trigger() → Trigger.dev enqueues 'design-agent'
      → prisma.taskRun.create()
      → return { runId }
  → Client stores runId
  → POST /api/ai/design/token
      → prisma.taskRun.findUnique({ runId })
      → check userId ownership
      → triggerAuth.createPublicToken({ runs: [runId] })
      → return { token }
  → Client uses token + runId with useRealtimeRun()
```

---

## Token Quick Reference

| Class | CSS Variable | Value |
|---|---|---|
| `text-copy-muted` | `--text-muted` | `#808090` |
| `text-brand` | `--accent-primary` | `#00c8d4` |
| `bg-surface` | `--bg-surface` | `#111114` |
| `border-surface-border` | `--border-default` | `#2a2a30` |

---

## AI Discussion Topics

### Background tasks and architecture
- Why can't a long-running AI call live inside a Next.js route handler? What happens to the HTTP connection after ~30 seconds?
- What is a "durable" task? Why does Trigger.dev retry a failed task automatically, while a plain `fetch()` would not?
- In the flow diagram above, the route returns `{ runId }` before the AI task finishes. How does the frontend know when the task is done? What mechanism would you use?
- What would happen if two users submitted the same prompt at the same time? Would they share a task run or each get their own? Why?

### Database ownership model
- Why is the `TaskRun` record stored in Prisma instead of just relying on Trigger.dev's own records?
- The token route checks `taskRun.userId !== userId` before issuing a token. What attack does this prevent?
- Could you skip the `TaskRun` table and embed ownership in the run's metadata inside Trigger.dev? What would be the trade-offs?
- What indexes were added to `TaskRun`? Why is a compound index on `[userId, projectId]` useful — what query would benefit from it?

### Scoped tokens and security
- What is the difference between a secret key and a public token? Why does the browser receive the token but never the secret key?
- The token expires in 1 hour. What would happen if the token had no expiration? What if it expired in 1 minute?
- The token is scoped to `read: { runs: [runId] }`. What would the token grant if the scope were `read: { tasks: ['design-agent'] }` instead?
- "Least privilege" is a security principle: give a credential only the access it needs, nothing more. How does the public token apply this principle?

### TypeScript and scope
- The canvas route had `nodes` referenced outside its scope. What is "scope" in JavaScript/TypeScript? Draw the scope boundary for the `parseCanvasPayload` function.
- Why did TypeScript catch this bug but JavaScript would have silently produced `undefined`? What is the value of a type system in this scenario?
- The fix removed the redundant array check. How did you know the check was redundant? Read `parseCanvasPayload` and trace the code path.
