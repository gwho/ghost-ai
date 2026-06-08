# Fix: AI Design Token Route Run ID Validation

## What Was Checked

`app/api/ai/design/token/route.ts` parsed JSON and immediately destructured `runId` from the body before checking that the parsed value was a JSON object.

It also only checked whether `runId` was truthy, so non-string values could reach the Prisma query.

## What Changed

The route now treats the parsed body as `unknown` until it passes request-boundary validation:

```ts
if (!body || typeof body !== 'object' || Array.isArray(body)) {
  return NextResponse.json({ error: 'Missing or invalid runId' }, { status: 400 })
}

const { runId } = body as Record<string, unknown>
if (typeof runId !== 'string' || runId.trim() === '') {
  return NextResponse.json({ error: 'Missing or invalid runId' }, { status: 400 })
}
```

Only after those checks does the route call:

```ts
prisma.taskRun.findUnique({ where: { runId } })
```

The existing ownership check remains unchanged.

## Why This Matters

`req.json()` proves only that the request body is valid JSON. It does not prove the JSON is an object or that fields have the expected types.

For this endpoint, `runId` authorizes access to a scoped Trigger.dev realtime token. The database lookup should only happen after the route knows it has a non-empty string run ID.

## AI Discussion Topics

- Why parsed JSON should usually start as `unknown` at API boundaries.
- How empty strings differ from missing fields during validation.
- Why authorization lookups should happen after input validation.
- Why arrays need an explicit guard even though `typeof [] === 'object'`.
- When to return `400` versus `404` in authenticated token routes.
