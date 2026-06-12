# Fix: generate-spec fails with Gemini high-demand error

## What Broke

Clicking "Generate Spec" in the AI sidebar caused the task to fail immediately with:

```
AI_RetryError: Failed after 3 attempts. Last error: This model is currently experiencing high demand.
```

The Trigger.dev dashboard showed "Error (retrying skipped)" — the task was not re-attempted.

## Why It Broke

Two problems compounded each other:

**Problem 1 — The Gemini model was rate-limited**

The `gemini-2.5-flash-lite` model returned an error meaning "I'm too busy right now, try again in a moment." This is a *transient* error — it's temporary and usually resolves within seconds to minutes.

The AI SDK (`generateText`) already has a built-in retry mechanism. It tried the request 3 times with short delays, but the model was still overloaded each time.

**Problem 2 — Trigger.dev task retries are disabled in development**

`trigger.config.ts` contains this setting:

```ts
retries: {
  enabledInDev: false,  // <-- retries turned off in dev
  ...
}
```

This means that even though the task has `retry: { maxAttempts: 2 }` configured, Trigger.dev will not re-run the task on failure when you're developing locally. "Retrying skipped" in the logs is exactly this — Trigger.dev saw the failure, checked the config, and decided not to retry.

The combination means: the AI SDK's 3 quick retries all fail → the task errors out → Trigger.dev would retry the whole task but doesn't in dev mode → user sees "Spec generation failed."

## The Fix

The fix adds a **retry loop inside the task itself**, independent of Trigger.dev's task-level retry config. This works the same way in both development and production.

**`trigger/generate-spec.ts`** — wrap the `generateText` call:

```ts
import { schemaTask, metadata, wait } from '@trigger.dev/sdk'  // added: wait

const GENERATE_RETRY_DELAY_SECONDS = [10, 20, 40]

// Inside run():
const generateWithRetry = async () => {
  for (let attempt = 0; attempt <= GENERATE_RETRY_DELAY_SECONDS.length; attempt++) {
    try {
      return await generateText({ model, system, prompt })
    } catch (err) {
      const msg = String(err).toLowerCase()
      const isTransient = ['high demand', 'rate limit', '429', '503', 'overloaded'].some(
        (s) => msg.includes(s),
      )
      if (!isTransient || attempt === GENERATE_RETRY_DELAY_SECONDS.length) throw err
      await wait.for({ seconds: GENERATE_RETRY_DELAY_SECONDS[attempt] })
    }
  }
  throw new Error('generate-spec: retry loop exited without result')
}

const result = await generateWithRetry()
```

This gives **4 total attempts** (the original call + 3 retries) with increasing waits:
- Wait 10 seconds before retry 1
- Wait 20 seconds before retry 2
- Wait 40 seconds before retry 3

If the error is *not* a transient high-demand error (e.g., a programming mistake in the prompt), the loop throws immediately without waiting.

## Why `wait.for` Instead of `setTimeout`

Trigger.dev's `wait.for` is special — it **checkpoints** the task. That means:

- The task is paused and its state is saved
- No compute time is charged during the wait
- If the machine restarts during the wait, the task picks up where it left off

`setTimeout` would keep the task's process alive during the delay, consuming billable compute time. For a 40-second delay, that's 40 seconds of wasted compute. `wait.for` costs nothing.

## Beginner Model: Why Transient vs Non-Transient Matters

Imagine asking someone a question. Sometimes they say "I'm busy, ask me again in a minute" (transient — worth retrying). Sometimes they say "I don't understand what you're saying" (non-transient — retrying immediately won't help; you need to rephrase).

The fix checks the error message to distinguish these cases:
- "high demand", "rate limit", "429", "503", "overloaded" → wait and retry
- Everything else → fail immediately so the developer sees the real problem

Without this distinction, retrying on every error could mask programming bugs (e.g., an invalid model name would retry 4 times instead of failing instantly with a clear error).

## Secondary Issue: "Failed to Load Specs"

The screenshot also showed "Failed to load specs. Please try again." This is a **separate, unrelated error** — the `GET /api/projects/[projectId]/specs` endpoint returned an error at the same moment the spec generation was starting (likely a transient database latency spike). The Retry button in the UI handles this case — clicking it re-fetches the list.

No code change was needed for this because it is not a bug in the application logic; it is a transient infrastructure condition.

## AI Discussion Topics

1. **Why does `enabledInDev: false` exist?** What would the developer experience be like if Trigger.dev retried failed tasks in dev mode with 10-minute delays? When might you want to enable it in dev?

2. **What is the difference between task-level retries (Trigger.dev) and operation-level retries (inside the `run` function)?** Which layer is more appropriate for each type of failure?

3. **What is a checkpoint in Trigger.dev?** How does `wait.for` differ from a regular JavaScript `sleep` in terms of compute billing and resilience?

4. **Why check the error message string for keywords like "high demand" instead of checking an error code?** What are the risks of string-matching error messages? What would a more robust approach look like?

5. **The AI SDK has its own internal retry (3 attempts). Now we have an outer retry (4 attempts). That could mean up to 12 total model calls. Is this acceptable? When does over-retrying become a problem?**

6. **What is an `AI_RetryError` vs a simple `Error`?** How does the Vercel AI SDK wrap provider errors, and why might checking `String(err).toLowerCase()` be more reliable than `err instanceof AI_RetryError`?

7. **The loop ends with `throw new Error('retry loop exited without result')`. This line is unreachable. Why write it?** What would TypeScript infer as the return type of `generateWithRetry` without it?
