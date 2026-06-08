# Fix: AI Design Route Body Guard

## What Was Checked

The reported issue was still present in `app/api/ai/design/route.ts`: the route parsed JSON and immediately destructured `prompt`, `roomId`, and `projectId`.

That crashes when valid JSON is `null`, because JavaScript cannot destructure properties from `null`.

## What Changed

The parsed request body is now treated as `unknown` until it passes a boundary check:

```ts
if (!body || typeof body !== 'object' || Array.isArray(body)) {
  return NextResponse.json(
    { error: 'Request body must be a JSON object' },
    { status: 400 },
  )
}
```

Only after that guard does the route destructure and validate `prompt`, `roomId`, and `projectId` as strings.

## Why This Matters

`req.json()` validates JSON syntax, not the shape of the parsed value. These are all valid JSON values:

```json
null
[]
"prompt"
42
```

API routes should validate external input before trusting it. Treating parsed JSON as `unknown` makes that rule explicit and prevents accidental property access on unsafe values.

## AI Discussion Topics

- Why `JSON.parse("null")` succeeds but object destructuring still crashes.
- The difference between syntax validation and schema validation in API routes.
- When to use simple type guards versus Zod schemas for request bodies.
- Why arrays pass `typeof value === "object"` and usually need their own guard.
- How to keep backend route handlers thin while still validating user input.
