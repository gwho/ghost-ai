# Fix: spec download route duplicated auth and returned ambiguous 401s

## Finding Verification

The finding was still valid in current code.

`app/api/projects/[projectId]/specs/[specId]/download/route.ts` first called Clerk `auth()` and then called `getProjectAccess(projectId)`. `getProjectAccess()` calls `getCurrentIdentity()` when no identity is supplied, and `getCurrentIdentity()` calls Clerk `auth()` plus `currentUser()`.

That meant the route did extra Clerk work. It also returned `401 Unauthorized` for every null access result, even though `getProjectAccess()` returns `null` for unauthenticated users, missing projects, and authenticated users who are not project members.

## Fix

The route now resolves identity once:

```ts
const identity = await getCurrentIdentity()
if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

Then it passes that identity into the access helper:

```ts
const access = await getProjectAccess(projectId, identity)
if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

So unauthenticated requests still receive `401`, while missing or forbidden project access receives `404`, matching the specs list route.

## Why This Is Minimal

The fix only changes authentication and access handling at the start of the route. The spec ownership check, Blob fetch, response headers, and Markdown response body are unchanged.

Returning `404` for missing or forbidden project access avoids leaking whether a project ID exists, while still giving clients a correct distinction between "not signed in" and "not accessible."

## Skipped Findings

No findings were skipped. The reported issue was still present and was fixed.

## Validation

Passed:

```bash
npx eslint app/api/projects/[projectId]/specs/[specId]/download/route.ts
npx tsc --noEmit --pretty false
```

## AI Discussion Topics

1. Ask: "Why is `401` about authentication, while `403` and `404` are about authorization or resource visibility?"
2. Ask: "Why do secure APIs sometimes return `404` for resources a signed-in user is not allowed to access?"
3. Ask: "How can helper functions that return `null` for multiple cases make route handlers ambiguous?"
4. Ask: "What are the performance and correctness benefits of passing a known identity into access-control helpers?"
