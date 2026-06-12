# Fix: specs list route returned 401 for missing or forbidden projects

## Finding Verification

The finding was still valid in current code.

`app/api/projects/[projectId]/specs/route.ts` called `getProjectAccess(projectId)` directly and returned:

```ts
NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

for every null result.

`getProjectAccess()` returns `null` for three different cases:

- The requester is unauthenticated.
- The project does not exist.
- The requester is authenticated but is not the owner or collaborator.

Returning `401` for all three made the response ambiguous and inconsistent with `POST /api/ai/spec`, which returns `401` only for missing auth and `404` when project access is missing.

## Fix

The route now explicitly resolves identity first:

```ts
const identity = await getCurrentIdentity()
if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

Then it passes that known identity into `getProjectAccess()`:

```ts
const access = await getProjectAccess(projectId, identity)
if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

This keeps unauthenticated requests as `401`, while missing projects and forbidden projects return `404`.

## Why This Is Minimal

No database query shape changed. The spec list still returns the same `{ specs }` response for authorized users.

Passing `identity` into `getProjectAccess()` also avoids resolving Clerk identity twice. The helper already accepts a known identity for exactly this case.

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint app/api/projects/[projectId]/specs/route.ts
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "What is the practical difference between HTTP 401, 403, and 404 for authenticated project resources?"
2. Ask: "Why do APIs sometimes return 404 instead of 403 for resources a user is not allowed to access?"
3. Ask: "How does passing an already-resolved identity into an access helper reduce duplicate auth work?"
4. Ask: "What response-shape consistency should route handlers preserve across related endpoints?"
