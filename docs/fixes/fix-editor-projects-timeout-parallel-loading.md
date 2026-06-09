# Fix: Editor Projects Timeout from Sequential Loading

## What Was Broken

The editor layout logged:

```text
[editor-layout] "Timed out while loading editor projects"
```

That log comes from `app/editor/layout.tsx`, where the layout wraps
`getEditorProjects()` in a 5 second timeout. When the helper did not finish in
time, the layout rendered with empty project lists and printed the timeout.

## Root Cause

`lib/project-data.ts` did independent network/database work sequentially:

```text
auth()
currentUser()
prisma.project.findMany(ownerId)
prisma.projectCollaborator.findMany(email)
```

The owned-project query only needs `userId` from `auth()`. It does not need the
full Clerk user object. But the code waited for `currentUser()` before starting
the owned-project database query.

That made the slow path additive:

```text
Clerk currentUser latency + database latency + shared-project query latency
```

Under cold database connections or slower Clerk responses, that sum could exceed
the layout's 5 second timeout.

## What Changed

`getEditorProjects()` now starts `currentUser()` and the owned-project query at
the same time:

```ts
const [user, ownedRaw] = await Promise.all([
  currentUser(),
  prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  }),
])
```

After the user email is known, the helper still runs the shared-project query,
because that query genuinely depends on the Clerk email address.

## Why This Fix Is Minimal

The data returned by `getEditorProjects()` is unchanged:

- owned projects still come from `Project.ownerId`
- shared projects still come from collaborator email
- shared projects still exclude projects already owned by the user

Only the scheduling of independent async work changed.

## Learning Explanation

Every `await` pauses the current async function until that promise resolves. This
is correct when the next line needs the result. It is wasted time when the next
operation can run independently.

Sequential work takes roughly the sum of each step:

```text
1.5s Clerk + 2.5s DB = 4.0s
```

Parallel work takes roughly the slowest step:

```text
max(1.5s Clerk, 2.5s DB) = 2.5s
```

This matters in server-rendered layouts because the user cannot interact with
the loaded project list until the server component finishes.

## Suggested AI Discussion Topics

- How to identify independent async operations in server code.
- Why `Promise.all` changes latency from sum-of-steps to max-of-steps.
- When sequential `await` is correct and when it is a performance bug.
- How server component data fetching affects initial page render time.
- How Clerk `currentUser()` differs from `auth()` in latency and data access.
- Why timeout wrappers are useful but should not hide avoidable slow paths.
