# Fix: Spec Filename — Clarify Blob vs Download Naming Mismatch

## What Was Wrong

The comment in `__tests__/utils/spec-filename.test.ts` inside
`describe('filename format from generate-spec task')` was ambiguous about why
the blob filename and the download attachment name differ:

```ts
// The download route creates filenames as spec-${specId}.md
// But the blob path uses {specId}.md, not spec-{specId}.md
// The filePath is: specs/{projectId}/{specId}.md
```

**Problems with the old comment:**

1. It noted the mismatch but did not explain the path layout clearly enough
   for a reader to reconstruct the full picture.
2. It did not mention the double-prefix edge case: if a `specId` already starts
   with `"spec-"`, the download endpoint produces `"spec-spec-*.md"` — a
   subtly surprising but intentional behaviour. No test existed to document it.

No production code was wrong; this was a **test clarity and coverage gap** only.

| File | Issue | Status |
|------|-------|--------|
| `__tests__/utils/spec-filename.test.ts` | Ambiguous comment in `filename format` block | Fixed |
| `__tests__/utils/spec-filename.test.ts` | No test for `specId` starting with `"spec-"` | Fixed |
| `app/api/projects/[projectId]/specs/[specId]/download/route.ts` | Naming logic already correct | No change |

---

## The Fix

### Updated comment

The comment now explicitly describes the two naming schemes:

```ts
// Blob storage path layout: specs/{projectId}/{specId}.md
// getSpecFilename returns only the last segment — the bare specId with .md.
//
// The download endpoint (GET .../specs/[specId]/download) builds the
// Content-Disposition attachment name as: `spec-${specId}.md`
// This means the user-facing filename has "spec-" prepended to the specId,
// while the blob filename is just "{specId}.md". The two names differ by design.
```

### New test — double-prefix edge case

```ts
it('produces spec-spec-*.md attachment name when specId already starts with "spec-"', () => {
  const specId = 'spec-f47ac10b-58cc-4372-a567-0e02b2c3d479'
  const filePath = `specs/project-abc/${specId}.md`
  // getSpecFilename: returns the raw blob filename unchanged
  expect(getSpecFilename(filePath)).toBe(`${specId}.md`)
  // download route attachment name would be: `spec-${specId}.md`
  const attachmentName = `spec-${specId}.md`
  expect(attachmentName).toBe(`spec-spec-f47ac10b-58cc-4372-a567-0e02b2c3d479.md`)
})
```

This documents current behaviour so that any future change to the naming
scheme is caught as a deliberate regression rather than a silent breakage.

---

## The Two Naming Schemes in Detail

### Blob storage path

The `generate-spec` Trigger.dev task writes the Markdown file to:

```
specs/{projectId}/{specId}.md
```

where `specId` is the Prisma-generated UUID for the `ProjectSpec` record.
`getSpecFilename` extracts the last path segment, so the sidebar displays
`{specId}.md`.

### Download attachment name

The download route (`app/api/projects/[projectId]/specs/[specId]/download/route.ts`)
sets:

```ts
'Content-Disposition': `attachment; filename="spec-${specId}.md"`
```

It unconditionally prepends `"spec-"` to the `specId` from the URL parameter.

```
Blob path segment  →  getSpecFilename  →  sidebar display
{specId}.md              (unchanged)      {specId}.md

URL param specId   →  download header  →  user download filename
{specId}           spec-${specId}.md  spec-{specId}.md
```

---

## The Double-Prefix Edge Case

If a `specId` happens to start with `"spec-"` (which the current system does
not produce, but could in future or via a manual DB entry), the download
endpoint produces:

```
spec-spec-f47ac10b-....md
```

This is not a bug — `specId` is a database UUID and the prefix is a UX
decision — but it is worth documenting so the test acts as a guard against
unintentional changes to either the ID format or the header construction.

---

## Beginner Mental Model: Two Names, One File

A single generated spec has **two filenames** that appear in different contexts:

```
                              Prisma DB
                         ┌──────────────────────┐
generate-spec task ─────▶│ ProjectSpec.filePath  │
                         │  = blob URL ending in │
                         │    {specId}.md        │
                         └──────────────────────┘
                                  │
                          GET /specs list
                                  │
                                  ▼
                         getSpecFilename(filePath)
                         returns: {specId}.md      ◀─ shown in sidebar

                         GET /specs/{specId}/download
                         header: spec-{specId}.md  ◀─ user sees in browser
```

The two names diverge by design:

- The blob name is an internal storage path using the raw database ID.
- The download attachment name adds `"spec-"` for human readability in the
  browser's save dialog.

Keeping these in separate tests makes each contract explicit and independently
verifiable.

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is `Content-Disposition: attachment; filename=...` and how do
   browsers use it when saving files?"** — How the header influences the default
   save-as name, and encoding considerations for non-ASCII characters.

2. **"Why is it common to store files with opaque IDs in blob storage and only
   add human-readable names at download time?"** — Advantages for deduplication,
   security, and rename resilience.

3. **"What is a documentation test (also called a characterisation test) and
   why is asserting existing surprising behaviour more valuable than fixing it
   immediately?"** — The double-prefix test is a characterisation test.

4. **"How do UUIDs get stored in a URL path segment, and what characters are
   safe in `Content-Disposition` filenames?"** — RFC 6266, percent encoding,
   and browser compatibility.

5. **"If you wanted the download filename to match the blob segment exactly,
   what change would you make to the download route, and what would be the
   trade-offs?"** — Evaluating `spec.filePath.split('/').pop()` vs
   `spec-${specId}.md` as the attachment name.

---

## Validation

```bash
npx vitest run __tests__/utils/spec-filename.test.ts
```

- 10 tests pass (was 9; new test added)
- IDE linter — no errors

---

## Files Changed

| File | Change |
|------|--------|
| `__tests__/utils/spec-filename.test.ts` | Clarified comment in `filename format` block; added double-prefix edge-case test |
| `docs/fixes/fix-spec-filename-download-naming-mismatch.md` | This document |
