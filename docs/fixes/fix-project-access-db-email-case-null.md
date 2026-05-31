# Fix: Collaborator DB Email Case + Null Guard in `getProjectAccess`

## What Was Wrong

In `lib/project-access.ts` line 38, the collaborator check compared `c.email`
(from the database) against `email` (from the current user's Clerk identity)
using strict equality:

```ts
const isCollaborator = email
  ? project.collaborators.some((c) => c.email === email)
  : false
```

Two problems:

1. **Case mismatch.** `email` (the identity side) is already lowercased on
   line 17 via `.toLowerCase()`. But `c.email` comes straight from the
   database. If a collaborator row has a mixed-case email
   (e.g. `Alice@Example.com`), then `"Alice@Example.com" === "alice@example.com"`
   is `false` — a legitimate collaborator is silently denied access.

2. **No null guard.** If `c.email` is `null` or `undefined` in the database
   (e.g. a bad migration, a manual insert, or a future schema change that makes
   the field optional), calling `c.email.toLowerCase()` would throw at runtime.
   Even without the explicit `.toLowerCase()`, a `null` comparison to a string
   always returns `false` — which is the correct behavior — but the code didn't
   make this edge case intentional or visible.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `lib/project-access.ts` | 38 | `c.email === email` — no normalization on DB side, no null guard | Fixed |

---

## How It Was Found

A prior fix (`fix-project-access-email-case.md`) normalized the **Clerk side**
(`email.toLowerCase()`). Since then, `getCurrentIdentity()` was updated to
lowercase the identity email at the source (line 17). That made the old
per-comparison `.toLowerCase()` on `email` redundant — it was simplified back to
`c.email === email`.

But this left the **DB side** (`c.email`) unnormalized. The roles flipped: the
identity email is now guaranteed lowercase, but the DB email is not.

---

## The Fix

```ts
// Before
? project.collaborators.some((c) => c.email === email)

// After
? project.collaborators.some((c) => c.email?.toLowerCase() === email)
```

One change, two effects:

| Token | What it does |
|-------|-------------|
| `c.email?.` | Optional chaining — if `c.email` is `null` or `undefined`, the expression short-circuits to `undefined` instead of throwing. `undefined === "alice@example.com"` is `false`, so the collaborator row is safely skipped. |
| `.toLowerCase()` | Normalizes the DB-side email to lowercase so it matches the already-lowercase identity email. |

---

## Why This Approach (Decisions Made)

### Decision 1: Normalize the DB side, not the identity side

The identity email is already lowercased at the source in `getCurrentIdentity()`
(line 17). Lowercasing it again at comparison time would be redundant. So we
normalize the side that _isn't_ guaranteed lowercase — `c.email` from the DB.

### Decision 2: Use optional chaining (`?.`) instead of a separate null check

Three options were considered:

| Option | Example | Trade-off |
|--------|---------|-----------|
| Optional chaining (chosen) | `c.email?.toLowerCase()` | Concise, idiomatic, safe — returns `undefined` on null |
| Explicit guard | `c.email && c.email.toLowerCase()` | More verbose, same result |
| Filter first | `.filter(c => c.email).some(...)` | Extra iteration, moves the guard away from the comparison |

Optional chaining is the standard TypeScript idiom for "call this method only if
the value exists." It keeps the guard and the comparison on the same line, making
the intent obvious.

### Decision 3: Don't normalize on write AND read — isn't that redundant?

Yes, if you trust that every write path lowercases correctly, the read-side
normalization is technically redundant. But:

- The DB has no `UNIQUE` constraint enforcing lowercase.
- Future write paths (admin tools, data migrations, direct SQL) may skip
  normalization.
- The cost of `.toLowerCase()` on a short string is negligible.

This is **defensive programming**: protect the read path against upstream
invariants you can't enforce at the point of use. A one-liner `.toLowerCase()`
is cheap insurance against an entire class of silent access-denial bugs.

---

## Relationship to Prior Fixes

This is the same email-casing pattern documented in several prior fixes:

| Fix doc | What it normalized | Direction |
|---------|-------------------|-----------|
| `fix-project-access-email-case.md` | Clerk identity email | Clerk → DB comparison |
| `fix-enrichwithclerk-email-case.md` | Clerk enrichment map key | Clerk → DB lookup |
| `fix-collaborator-enrich-key-case.md` | DB email used as map key | DB → Clerk map lookup |
| **This fix** | DB collaborator email | DB → Clerk comparison |

The recurring lesson: **wherever two email strings from different sources meet,
normalize both sides.** It doesn't matter which side "should" already be clean.

---

## Beginner Mental Model: Why Bugs Come Back in a Different Direction

You might wonder: "We already fixed the email case bug in this exact file — how
is it broken again?"

The earlier fix lowercased the **Clerk side** because at that time,
`getCurrentIdentity()` returned the raw email. Then a separate improvement moved
the `.toLowerCase()` into `getCurrentIdentity()` itself (line 17) — the right
thing to do, because it normalizes the email once at the source instead of at
every call site.

But when the call-site `.toLowerCase()` was cleaned up (since it was now
redundant), the **DB side** was left bare. The comparison went from
`c.email === email.toLowerCase()` back to `c.email === email` — which looks
fine, because `email` is lowercase... but `c.email` might not be.

This is a common pattern in real codebases:

1. **Bug A** is found: X is not normalized. Fixed by normalizing X.
2. A refactor moves the normalization of X upstream (closer to the source).
3. The per-comparison normalization of X is removed (redundant now).
4. Nobody notices that **Y** (the other side) was never normalized — it was
   never a problem before because X was being normalized at the comparison site,
   which happened to make the comparison work.
5. **Bug B** emerges: the same comparison, same line, same file — but the
   unnormalized side has flipped from X to Y.

The takeaway: **when you move normalization upstream, audit every downstream
comparison to make sure the _other_ side is also safe.** Or better yet,
normalize both sides at every comparison — the performance cost is zero, and you
never have to worry about which side is "guaranteed" clean.

---

## Validation

- IDE linter — no errors on `lib/project-access.ts`
- TypeScript — `c.email?.toLowerCase()` is valid because optional chaining on
  a `string | null | undefined` returns `string | undefined`, and
  `string | undefined === string` is a valid comparison.

---

## Files Changed

| File | Line | Change |
|------|------|--------|
| `lib/project-access.ts` | 38 | `c.email === email` → `c.email?.toLowerCase() === email` |
