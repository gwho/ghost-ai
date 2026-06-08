# Fix: Canvas GET Stored Payload Validation

## What Was Checked

`app/api/projects/[projectId]/canvas/route.ts` already validated canvas payloads on save, but the `GET` handler only checked that a loaded blob had `nodes` and `edges` arrays of objects.

That meant malformed stored entries could still be returned to the editor if bad data already existed in Blob storage.

## What Changed

After `parseCanvasPayload(payload)`, the `GET` handler now reuses the same entry validators used by `PUT`:

```ts
if (!parsed.nodes.every(isValidNode) || !parsed.edges.every(isValidEdge)) {
  throw new Error('Saved canvas entries are invalid')
}
```

The existing `catch` path returns:

```ts
NextResponse.json({ error: 'Failed to load saved canvas' }, { status: 503 })
```

## Why This Matters

Write-time validation prevents new bad data, but read-time validation protects the editor from old or externally modified data. The editor expects node and edge objects with specific fields, so the API should not return blob contents that fail that contract.

## AI Discussion Topics

- Why stored data still needs validation on read.
- The difference between payload-level validation and entry-level validation.
- When to return `503` for corrupted backing storage versus `400` for bad client input.
- How shared validators prevent GET and PUT from drifting apart.
