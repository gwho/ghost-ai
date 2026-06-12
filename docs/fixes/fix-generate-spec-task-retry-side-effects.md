# Fix: generate-spec task retry could duplicate persisted specs

## Finding Verification

The finding was still valid in current code.

`trigger/generate-spec.ts` configured `generateSpec` with `retry: { maxAttempts: 2 }`. Later in the same task attempt it generated a fresh `specId`, uploaded Markdown to Vercel Blob at `specs/{projectId}/{specId}.md`, and inserted a `ProjectSpec` row.

That means a production retry after a partial persistence failure could run those side effects again with a different `specId`, leaving extra blobs or rows for one user action.

## Fix

The task now uses:

```ts
retry: { maxAttempts: 1 }
```

Trigger.dev treats `maxAttempts` as total attempts, so `1` means no whole-task retry. This is intentionally explicit because the project-level `trigger.config.ts` has a default retry policy; omitting the task retry would risk inheriting that default.

The existing `generateWithRetry()` loop remains in place. It retries only the transient Gemini generation call with `wait.for`, before any Blob upload or Prisma write occurs.

## Why This Is Minimal

This fix avoids changing the task payload, API route contract, Prisma schema, or spec UI. It only prevents Trigger.dev from replaying the non-idempotent persistence section.

The tradeoff is that Blob or Prisma failures after generation now fail the run instead of retrying automatically. That is safer than silently creating duplicate artifacts. A future improvement could make persistence idempotent by generating a stable `specId` before task start and using upsert semantics.

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint trigger/generate-spec.ts
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "In Trigger.dev, what is the difference between operation-level retries inside a task and retrying the entire task run?"
2. Ask: "How would you design an idempotent Blob plus database persistence flow for generated artifacts?"
3. Ask: "Why can a retry after a partial failure be more dangerous than no retry for non-idempotent side effects?"
4. Ask: "What would change if `specId` were created in the API route before triggering the task?"
