# Fix: Canvas autosave fails after first save — missing allowOverwrite

## What Broke

Every canvas autosave after the first one failed with:

```text
Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.
  at async PUT (app/api/projects/[projectId]/canvas/route.ts:141:16)
```

The terminal showed `PUT /api/projects/[projectId]/canvas 500` repeatedly every ~2 seconds (the autosave interval).

## Why It Broke

The canvas autosave route in `app/api/projects/[projectId]/canvas/route.ts` saves the canvas to Vercel Blob at a fixed path:

```ts
canvas/{projectId}.json
```

The first time a project's canvas is saved, this path doesn't exist yet — the `put` call creates it and succeeds. Every subsequent save tries to upload to the **same path** on an existing blob.

Vercel Blob's default behavior is to **reject** writes to an existing path unless you explicitly opt into overwriting. This is a safety mechanism — it prevents you from accidentally overwriting files you didn't mean to change. Since the code didn't pass `allowOverwrite: true`, Vercel Blob threw an error on every save after the first.

The first save worked because the blob didn't exist yet. The bug was invisible during initial testing and only appeared in real use when the user had already used the workspace before.

## The Fix

**`app/api/projects/[projectId]/canvas/route.ts`**, line 141:

```ts
// Before
const blob = await put(
  `canvas/${projectId}.json`,
  serialized,
  { access: 'private', contentType: 'application/json', addRandomSuffix: false },
)

// After
const blob = await put(
  `canvas/${projectId}.json`,
  serialized,
  { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true },
)
```

One option added. This tells Vercel Blob: "If a blob at this path already exists, replace it."

## Why `addRandomSuffix: false` + `allowOverwrite: true` Together

These two options serve different purposes but work together for the canvas use case:

- `addRandomSuffix: false` — keeps the path deterministic (`canvas/abc123.json` always). Without this, every save would generate a new unique URL like `canvas/abc123-a7f2c9.json`, leaving orphaned old blobs.
- `allowOverwrite: true` — permits replacing the file at that deterministic path. Without this, the second save to the same path fails.

Together they implement an "upsert" pattern for blob storage: always write to the same path, always replace what was there.

## Beginner Model: Why Blob Storage Rejects Overwrites by Default

Blob storage (like Vercel Blob, S3, or Google Cloud Storage) is not a traditional filesystem. In a filesystem, writing to a file path replaces the old file automatically. In blob storage, each write is more like creating an object — and objects at the same path are treated as distinct.

Blob providers default to rejecting overwrites because:
1. **Accident prevention**: If you accidentally reuse a path, you don't silently lose data
2. **Content-addressable patterns**: Many blob workflows use unique paths per upload (hashed content, UUID filenames) and never need to overwrite
3. **CDN cache invalidation complexity**: Overwriting a blob while a CDN caches the old content can cause stale-cache bugs

For the canvas use case, overwriting is intentional and correct — we want one canonical snapshot per project.

## AI Discussion Topics

1. **Why does Vercel Blob (and S3-style storage) reject overwrites by default, while a regular filesystem silently replaces files?** What design philosophy drives this difference?

2. **The canvas is saved as one blob per project (`canvas/{projectId}.json`). What are the trade-offs of this "one file per project" approach vs. storing each canvas version as a separate blob with a timestamp?**

3. **What happens to old blob URLs stored in the database (`canvasJsonPath`) when a blob is overwritten?** Does the URL change? Why or why not?

4. **The autosave fires every ~2 seconds after a canvas change. Since each save now successfully overwrites the previous blob, the database `canvasJsonPath` is updated to the same URL every time. Is this a problem? What optimizations could reduce unnecessary database writes?**

5. **Blob overwrites bypass Vercel Blob's normal immutability guarantees. What could go wrong if two simultaneous autosaves from two different collaborators both try to overwrite `canvas/{projectId}.json` at the same time?** How would you prevent this in production?

6. **The bug was invisible during initial testing because the first save always succeeds. What testing practice would catch this class of "works once, fails on repeat" bug?**
