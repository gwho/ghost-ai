# Fix: Case-Sensitive Collaborator Email Check in `getProjectAccess` (`lib/project-access.ts`)

## Summary

`getProjectAccess` compared the current user's Clerk email against stored
collaborator emails using strict equality (`===`). Because collaborator emails are
stored lowercase on invite but Clerk can return any casing, a mixed-case Clerk email
would silently deny access to a legitimate collaborator. Added `.toLowerCase()` to
normalize the Clerk-sourced email before the comparison.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `lib/project-access.ts` | 34 | `c.email === email` — no normalization on `email` | Fixed |

---

## Verification

```ts
// Line 33-35 before the fix
const isCollaborator = email
  ? project.collaborators.some((c) => c.email === email)
  : false
```

Two facts confirmed the bug:

1. **`c.email` is always lowercase.** The POST handler at
   `app/api/projects/[projectId]/collaborators/route.ts` line 67 normalizes on write:
   ```ts
   const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
   ```
   Every collaborator record in the DB has a lowercase email.

2. **`email` here is raw from Clerk.** It comes from `getCurrentIdentity()` (line 14):
   ```ts
   return { userId, email: user?.emailAddresses[0]?.emailAddress }
   ```
   No `.toLowerCase()` is applied. Clerk returns whatever casing the user registered
   with or whatever their identity provider reports.

If Clerk returns `Alice@Example.com` and the DB stores `alice@example.com`,
`"alice@example.com" === "Alice@Example.com"` is `false` — access denied.

---

## The Fix

```ts
// Before
? project.collaborators.some((c) => c.email === email)

// After
? project.collaborators.some((c) => c.email === email.toLowerCase())
```

Only `email` needs normalizing — `c.email` is already guaranteed lowercase by the
write path. Normalizing both sides would also be correct but is redundant.

---

## Why This Matters Beyond a Theoretical Edge Case

This is a **security-adjacent bug**. The check on line 37 —
`if (!isOwner && !isCollaborator) return null` — is the access gate for the entire
project. Returning `null` means "no access." A collaborator who should have read
access gets a 401 instead. Depending on how Clerk or an upstream identity provider
handles casing, this could affect every user whose email has any uppercase in it.

---

## The Normalization Boundary Pattern (Revisited)

This is the same class of bug fixed in `enrichWithClerk`
(`fix-enrichwithclerk-email-case.md`): email strings come from two sources that
don't agree on casing, and the comparison fails silently.

| Location | Email source | Normalized? |
|----------|-------------|-------------|
| DB (`c.email`) | Written via POST handler | Yes — `.toLowerCase()` at write time |
| `email` in `getProjectAccess` | Clerk `currentUser()` | **No — fixed here** |
| `enrichWithClerk` map key | Clerk `getUserList()` | Fixed in prior commit |
| `project-data.ts` query | Clerk `currentUser()` | Uses DB `WHERE email = ?` — DB value is lowercase so Prisma comparison is case-sensitive on the DB side; same latent risk |

The recurring pattern: any place that receives an email from Clerk and compares or
queries it against DB data needs `.toLowerCase()` applied to the Clerk-side value.
The DB side is already normalized; the Clerk side is not.

---

## Beginner Mental Model: Normalize at Every Comparison, Not Just at Storage

You might think: "we normalize when we store, so everything in the DB is consistent —
why do we need to normalize again when reading?"

The answer is that **normalization at storage only makes the stored values consistent
with each other.** It does nothing for values coming from outside the DB after that
point. When you later compare a stored value against a fresh external value (from an
API, from user input, from a cookie), the fresh value hasn't been through your
normalization step.

Think of it like a dress code: you enforce it at the door (storage), so everyone
inside the room (the DB) is dressed the same way. But when you need to check whether
a specific person is in the room, you have to normalize *their* appearance too before
comparing — not just assume they match the format inside.

The safe rule: **wherever two strings from different sources are compared with `===`,
ask whether both sides are guaranteed to have the same casing.** If not, `.toLowerCase()`
both before comparing.

---

## Files Changed

| File | Line | Change |
|------|------|--------|
| `lib/project-access.ts` | 34 | `c.email === email` → `c.email === email.toLowerCase()` |
