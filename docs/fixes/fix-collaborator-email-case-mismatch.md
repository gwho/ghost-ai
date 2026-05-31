# Fix: Collaborator Email Case Mismatch

## Finding

In `lib/project-data.ts`, `getEditorProjects` looked up shared projects using the
current user's raw Clerk email:

```ts
const email = user?.emailAddresses[0]?.emailAddress
// ...
prisma.projectCollaborator.findMany({
  where: { email },
  // ...
})
```

Collaborator rows are stored **lowercase** everywhere they are written:

- `app/api/projects/[projectId]/collaborators/route.ts` saves
  `body.email.trim().toLowerCase()`.
- `lib/project-access.ts` lowercases the identity email.

So the query value and the stored value could disagree on casing.

## What was wrong

Email is case-insensitive in practice, but a database string comparison is not.
If a user's Clerk primary email returned as `Jesse@Example.com` but the
collaborator row was saved as `jesse@example.com`, then `where: { email }` would
not match. The user would silently not see projects that were actually shared
with them.

## The fix

Normalize the email to lowercase at the source, so every downstream use (here,
the `where: { email }` lookup) compares against the same normalized value:

```ts
const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
```

One line, in `lib/project-data.ts`.

## Why this approach

| Option | Why / why not |
|---|---|
| Lowercase at the source (chosen) | Fixes the lookup with one change, and any future use of `email` in this function is automatically normalized too. |
| Lowercase inside `where: { email: email.toLowerCase() }` | Also works, but only fixes this one call site and has to be repeated if `email` is reused. |
| Case-insensitive DB query (`mode: 'insensitive'`) | Heavier, relies on collation/index behavior, and is inconsistent with how the rest of the app already standardizes on lowercase. |

The codebase had already decided that **lowercase is the canonical form** for
stored emails (writes lowercase, access checks lowercase). The read path simply
wasn't following that same rule, so the smallest correct fix is to make the read
path obey the existing convention.

The optional chaining (`?.`) is kept so that when there is no email, `email`
stays `undefined` and the existing ternary still falls back to
`Promise.resolve([])` instead of querying.

## Beginner model — why casing breaks matching

To a person, `Jesse@Example.com` and `jesse@example.com` are the same address.
To a database, they are two different strings, the same way `"A"` and `"a"` are
different characters to a computer.

When you write `where: { email }`, Prisma asks the database for rows where the
stored text is *exactly equal* to what you passed. Exactly equal means the same
letters **and** the same upper/lower case. So if you store one casing and search
with another, the match fails even though the emails are "the same" to a human.

The standard fix for this is **normalization**: pick one canonical form (here,
all lowercase), convert to it both when you save and when you search, and then
the two will always line up. This app already normalizes on save, so the bug was
just a missing normalization on the search side.

## Validation

- `npx tsc --noEmit --pretty false` — passed
- `npm run lint -- lib/project-data.ts` — passed

## Note for future debugging

Keep recording fixes like this: capture the **what** (the actual change), the
**how** (where and the exact edit), the **why** (the reasoning and the
alternatives considered), and the **decision made**, with a short beginner-friendly
explanation, in `docs/fixes/`.
