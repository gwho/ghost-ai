# Fix: AI Design Route Idempotency Key

## What Was Checked

`app/api/ai/design/route.ts` was still starting the Trigger.dev `design-agent` task with:

```ts
await tasks.trigger<typeof designAgent>('design-agent', { prompt, roomId })
```

That meant a client retry could enqueue more than one AI design run for the same prompt.

## What Changed

The route now imports `idempotencyKeys` from `@trigger.dev/sdk`, creates a stable global key from the run-start inputs, and passes that key into `tasks.trigger`:

```ts
const idempotencyKey = await idempotencyKeys.create(
  ['ai-design-start', userId, projectId, roomId, prompt],
  { scope: 'global' },
)

await tasks.trigger(
  'design-agent',
  { prompt, roomId },
  { idempotencyKey, idempotencyKeyTTL: '1h' },
)
```

## Why This Matters

Task-start endpoints are vulnerable to duplicate work because browsers and clients may retry after timeouts, network drops, or ambiguous responses. Without an idempotency key, the backend cannot tell whether the second request is a retry or a new request.

The key uses stable retry material:

- `userId`
- `projectId`
- `roomId`
- `prompt`

That means the same user retrying the same design request within the TTL resolves to the same Trigger.dev run instead of creating another one.

The TTL is `1h`, which is long enough to cover normal retry windows without blocking a user forever from intentionally submitting the same prompt later.

## AI Discussion Topics

- How idempotency differs from debouncing.
- Why POST routes often need idempotency even when the client "should not" retry.
- What inputs belong in an idempotency key.
- Why backend-generated keys are safer than trusting arbitrary client retry keys.
- How TTL choice affects duplicate prevention versus legitimate repeat actions.
