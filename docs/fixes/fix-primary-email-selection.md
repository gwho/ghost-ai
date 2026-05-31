# Fix: Use Primary Email Instead of First Email

## Finding

`lib/project-data.ts` selected the user's email with:

```ts
const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
```

Clerk users can have **multiple** email addresses. `emailAddresses[0]` is simply
the first in the array, which is not guaranteed to be the primary address. If
the user's primary email is at index 1 or later, the query would search for the
wrong address and silently miss shared projects.

`lib/project-access.ts` had the same `[0]` pattern in `getCurrentIdentity`, plus
an additional issue: finding text had been accidentally pasted at the top of the
file, corrupting it.

## Decision

Use `primaryEmailAddressId` (a field Clerk provides on the `User` object) to
`.find()` the correct entry, falling back to `[0]` if no primary is set. Apply
the same pattern in both files so every email lookup is consistent.

## What Changed

**`lib/project-data.ts`** — replaced `emailAddresses[0]` with the primary lookup:

```ts
const primaryAddr = user?.emailAddresses.find(
  (ea) => ea.id === user.primaryEmailAddressId,
)
const email = (primaryAddr ?? user?.emailAddresses[0])?.emailAddress?.toLowerCase()
```

**`lib/project-access.ts`** — same primary lookup applied to `getCurrentIdentity`,
plus removed the corrupted finding text that had been pasted at the top of the
file.

## Why This Approach

| Option | Why / why not |
|---|---|
| `primaryEmailAddressId` + `.find()` with `[0]` fallback (chosen) | Uses Clerk's own concept of "primary", falls back safely if none is set, and stays consistent across both files. |
| Keep `[0]` | Works when the primary happens to be first, but breaks silently when it isn't — and the ordering is not contractual. |
| Loop through all addresses and query each | Over-engineered; Clerk already marks one as primary, so we just need to read it. |

## How the Fix Works

Clerk's `User` object has:
- `emailAddresses` — an array of all verified email address objects
- `primaryEmailAddressId` — the `id` of whichever address the user designated
  as primary

We `.find()` the entry whose `id` matches `primaryEmailAddressId`. If none
matches (edge case: new account with no primary set), we fall back to `[0]`.
Then we lowercase the result so it matches the stored lowercase collaborator
emails (same normalization convention as the rest of the app).

## Beginner Model — Why the Array Order Isn't Reliable

When you add multiple emails to a service like Clerk, they go into a list. The
order might be the order you added them, or it might not — the API makes no
promise. If your code grabs `[0]`, it gets *some* email, but not necessarily the
one the user considers their "real" address.

Clerk solves this with `primaryEmailAddressId`: the user picks one address as
primary, and Clerk stores that choice as an ID you can look up. Using `.find()`
with that ID is the reliable way to get the address the user actually intends to
use.

The `?? emailAddresses[0]` fallback is a safety net — if somehow no primary is
set, you still get *an* email rather than `undefined`.

## Bonus Fix — File Corruption

`lib/project-access.ts` had a Coderabbit/review finding accidentally pasted at
the top of the file (three lines of plain text before the import). This was
removed as part of the same change.

## Validation

- `npx tsc --noEmit --pretty false` — passed
- `npm run lint -- lib/project-data.ts lib/project-access.ts` — passed
- IDE linter — no errors
