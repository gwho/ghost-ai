# Fix: `getCurrentIdentity` Used First Email Instead of Primary (`lib/project-access.ts`)

## Summary

`getCurrentIdentity` returned `emailAddresses[0]` — the first address in Clerk's
array — instead of the user's designated primary email. The array order is not
guaranteed, so a user with multiple addresses could get the wrong one used for
access checks and sharing. Fixed to look up the primary address via
`primaryEmailAddressId`, and normalize it to lowercase at the source so every
downstream consumer receives a consistently cased value.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `lib/project-access.ts` | 14 | `emailAddresses[0]` instead of primary email; no normalization | Fixed |
| `lib/project-access.ts` | 34 | Redundant `.toLowerCase()` removed (normalization now at source) | Cleaned up |

---

## Verification

```ts
// Line 14 before the fix
return { userId, email: user?.emailAddresses[0]?.emailAddress }
```

Two problems confirmed:

1. **`emailAddresses[0]` is not the primary email.** The Clerk `User` object has two
   separate fields:
   - `emailAddresses: EmailAddress[]` — all addresses attached to the account
   - `primaryEmailAddressId: string | null` — the ID of whichever one the user set
     as primary

   The array is not sorted with the primary first. Its order reflects when each
   address was added or how Clerk internally organizes them — not which one the user
   considers their main address.

2. **No normalization.** The raw `emailAddress` string from Clerk is returned as-is.
   The previous fix (`fix-project-access-email-case.md`) patched this downstream with
   `.toLowerCase()` at the comparison site, but normalizing at the source is cleaner
   and eliminates the risk of any comparison site forgetting to do it.

---

## The Fix

### Before

```ts
export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return { userId, email: user?.emailAddresses[0]?.emailAddress }
}
```

### After

```ts
export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (ea) => ea.id === user.primaryEmailAddressId,
  )?.emailAddress?.toLowerCase()
  return { userId, email: primaryEmail }
}
```

The `.find` walks `emailAddresses` looking for the entry whose `id` matches
`primaryEmailAddressId`. If no match is found (or the user has no addresses),
`.find` returns `undefined` and optional chaining short-circuits to `undefined` —
the same safe fallback the old code had when `emailAddresses[0]` was absent.

### Downstream cleanup

The previous fix for the case-sensitivity bug added `.toLowerCase()` at the
comparison site (`getProjectAccess` line 34):

```ts
// Before this fix
? project.collaborators.some((c) => c.email === email.toLowerCase())
```

Because `email` is now guaranteed lowercase from `getCurrentIdentity`, the call-site
normalization is redundant. It was removed:

```ts
// After this fix
? project.collaborators.some((c) => c.email === email)
```

This keeps the code honest: the normalization contract lives in one place
(`getCurrentIdentity`), and comparison sites don't need to remember to apply it.

---

## Beginner Mental Model: Normalize at the Source, Not at Every Use

This fix and the previous one (`fix-project-access-email-case.md`) together
illustrate a principle: **normalize data as close to where it enters the system as
possible.**

```
External source         Entry point              Internal use
─────────────────────   ──────────────────────   ──────────────────────────
Clerk currentUser()  →  getCurrentIdentity()  →  getProjectAccess()
                        (normalize HERE)          (just compare — trust the source)
```

When normalization lives at the entry point, every caller can trust the format.
When it's spread across call sites, each caller has to remember the rule — and
when one forgets, you get a bug.

Compare:

```ts
// Normalization scattered at every call site — fragile
email.toLowerCase()   // ← in getProjectAccess
identity.email.toLowerCase()  // ← in the POST handler
ea.emailAddress.toLowerCase() // ← in enrichWithClerk
```

vs.

```ts
// Normalization at the source — clear contract
getCurrentIdentity() always returns lowercase email
→ all callers can compare directly without worrying about casing
```

The ideal: one place in the code is responsible for the invariant "all emails we
work with internally are lowercase." That place is wherever external email strings
first enter the system. Here it's `getCurrentIdentity` for the current user, and
the POST handler for invited collaborator emails.

---

## Clerk User Object Cheat Sheet

```
user.emailAddresses          → EmailAddress[]  (all addresses, unordered)
user.primaryEmailAddressId   → string | null   (ID of the primary one)

EmailAddress {
  id: string              ← matches primaryEmailAddressId
  emailAddress: string    ← the actual email string
}

// Get primary email safely:
user.emailAddresses.find((ea) => ea.id === user.primaryEmailAddressId)?.emailAddress
```

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `lib/project-access.ts` | 14–15 | Replaced `emailAddresses[0]` with `.find` by `primaryEmailAddressId`; added `.toLowerCase()` |
| `lib/project-access.ts` | 34 | Removed redundant `.toLowerCase()` — normalization now guaranteed at source |
