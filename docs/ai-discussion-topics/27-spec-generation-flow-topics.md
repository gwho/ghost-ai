# AI Discussion Topics — Feature 27: Spec Generation Flow

Use these questions with an AI assistant to deepen your understanding of the patterns introduced in this feature.

---

## Architecture & Design

1. This feature splits spec generation into an API route and a background task. What would break if you ran the Gemini call directly inside the Next.js route handler instead?

2. `roomId` is used as the `projectId` in this system. Why is it safer to call `getProjectAccess(roomId)` rather than accepting a separate `projectId` field from the request body? What attack does this prevent?

3. The token route returns `404` rather than `403` when a `TaskRun` is not found or doesn't belong to the authenticated user. Why might you want to hide whether the run exists at all?

---

## Trigger.dev Patterns

4. `generate-spec.ts` uses `schemaTask` while `design-agent.ts` uses `task`. What does `schemaTask` give you that `task` doesn't? When would you choose one over the other?

5. The `generate-spec` task calls `metadata.set('status', 'generating')` before the Gemini call and `metadata.set('status', 'complete')` after. How would a frontend component use this metadata to show a loading state? Look at how `useRealtimeRun` works with `run.metadata`.

6. The task returns `{ spec: result.text }` but does not store the Markdown anywhere. How would a frontend component retrieve the generated spec once the run completes? What property on the run object holds the task's return value?

7. Why does the spec API route not use an idempotency key (unlike the design route which does)? What would happen if a user double-clicked "Generate Spec" without idempotency?

---

## Error Handling & Resilience

8. The spec API route has two separate try/catch blocks — one for `tasks.trigger` and one for `prisma.taskRun.create`. Why are they separate? What is the client supposed to do differently in each failure case?

9. If `tasks.trigger` succeeds but `prisma.taskRun.create` fails, the route returns `202 { runId, trackingUnavailable: true }`. The client now has a `runId` but cannot get a token. How would you design the frontend to handle this gracefully?

10. The task has `retry: { maxAttempts: 2 }`. If the Gemini call fails on the first attempt and succeeds on the second, does the frontend `runId` change? What happens to the `metadata.status` between retry attempts?

---

## Security

11. The token route scopes the public token to `read.runs: [runId]`. What would a malicious user be able to do with this token? What would they NOT be able to do?

12. Walk through the full ownership chain: user triggers a spec → TaskRun record is created → user requests a token. At which steps does the system check that the requesting user is authorized? Are there any gaps?

---

## Future Extensibility

13. A future feature will save the generated spec to Vercel Blob. Where in the current code would you add that storage call — inside the Trigger.dev task or in a new API route? What are the trade-offs of each approach?

14. If you wanted to let collaborators (not just the project owner) generate specs, what would you need to change? Which files would be affected?
