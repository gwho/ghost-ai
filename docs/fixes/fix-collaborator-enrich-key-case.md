# Fix: Collaborator Enrichment Key Case Mismatch

## Finding

In `app/api/projects/[projectId]/collaborators/route.ts`, the GET handler built
the enriched collaborator list with:

```ts
const result: CollaboratorItem[] = rows.map((r) => ({
  id: r.id,
  email: r.email,
  ...clerkMap.get(r.email),
}))
```

`enrichWithClerk` stores its map keys as `ea.emailAddress.toLowerCase()`, but
the lookup used `r.email` directly from the database row without lowercasing.

## Is This an Active Bug?

**Not today.** The POST handler already stores emails lowercase
(`body.email.trim().toLowerCase()`), so every row in the database currently has a
lowercase email. The map key and lookup key agree, and the spread works.

The risk is **future/migration data**: if a row were manually inserted or
migrated with mixed-case email, the lookup would silently miss and the
collaborator would appear without a name or avatar — no error, just a quiet
degradation.

## Decision

Apply the defensive fix anyway. It's one `.toLowerCase()` call, costs nothing at
runtime, and eliminates an entire class of silent mismatch bugs. The POST
handler's `clerkMap.get(email)` on line 92 was already safe (email was lowercased
on line 67), so it was left unchanged.

## What Changed

```ts
// Before
const result: CollaboratorItem[] = rows.map((r) => ({
  id: r.id,
  email: r.email,
  ...clerkMap.get(r.email),
}))

// After
const result: CollaboratorItem[] = rows.map((r) => {
  const key = r.email.toLowerCase()
  return { id: r.id, email: r.email, ...clerkMap.get(key) }
})
```

`r.email` is still returned as-is (preserving whatever casing is stored), but
the *lookup key* is normalized so it always matches the lowercase map keys.

## Why This Approach

| Option | Why / why not |
|---|---|
| Lowercase the lookup key (chosen) | Minimal, defensive, zero risk of breaking existing behavior. |
| Lowercase on write only, trust the DB | Already done, but doesn't protect against manual or migrated data. |
| Case-insensitive Map wrapper | Over-engineered for one lookup. |

## Beginner Model — What "Defensive Programming" Means Here

The code already works because the data happens to always be lowercase. But
"happens to work" is fragile — it depends on every single write path lowercasing
correctly, forever. If someone adds a new write path (an admin script, a data
migration, a direct SQL insert) and forgets to lowercase, the read path silently
breaks.

Adding `.toLowerCase()` on the read side means the read path works *regardless*
of how the data got there. That's defensive programming: you don't trust
upstream invariants that you can't enforce at the point of use.

## Validation

- `npx tsc --noEmit --pretty false` — passed
- `npm run lint` — passed
- IDE linter — no errors
