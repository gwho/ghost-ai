# Fix: `enrichWithClerk` Map Key Not Normalized to Lowercase

## Summary

`enrichWithClerk` stored map keys using the raw email string returned by Clerk.
Collaborator emails are persisted lowercase (normalized at POST), so `clerkMap.get(r.email)`
would miss any entry where Clerk returned a different casing — silently dropping the
`name` and `avatarUrl` fields from the enriched response.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `app/api/projects/[projectId]/collaborators/route.ts` | 26 | Map key used raw `ea.emailAddress` instead of lowercased | Fixed |

---

## Step 1 — Verification

```ts
// Line 26 before the fix
map.set(ea.emailAddress, { name, avatarUrl })
```

Two checks confirmed the bug:

1. **How is the map key set?** `ea.emailAddress` verbatim — whatever casing Clerk returns.

2. **How is the map read?**
   - GET (line 47): `clerkMap.get(r.email)` — `r.email` is from the DB, which is always lowercase.
   - POST (line 92): `clerkMap.get(email)` — `email` was normalized to lowercase at line 67.

   If Clerk returns `Alice@Example.com` and the DB stores `alice@example.com`, both
   read sites pass a lowercase key and get `undefined` back. The spread `...undefined`
   silently adds nothing, so `name` and `avatarUrl` are absent from the response with
   no error or warning.

Finding confirmed valid.

---

## The Bug Explained

### Why emails can have inconsistent casing

Email addresses are technically case-insensitive in the local part (before `@`). Most
providers treat them as lowercase, but the RFC does not require it, and identity
providers like Clerk may return whatever casing the user originally registered with
or whatever the underlying identity system reports.

The project defensively normalizes at ingestion (POST lowercases before writing to DB)
but forgot to apply the same normalization when building the enrichment map.

### What silently broke

```
DB email:    "alice@example.com"       ← stored lowercase
Clerk email: "Alice@Example.com"       ← returned as-is by Clerk API

map key set: "Alice@Example.com"
map key get: "alice@example.com"       ← Map lookup is case-sensitive → miss
```

`Map.get` uses `SameValueZero` equality (equivalent to `===` for strings). String
comparison in JavaScript is case-sensitive, so `"Alice@Example.com" !== "alice@example.com"`.

The consequence: every collaborator whose Clerk account has any uppercase in their
email address would appear in the GET response with `id` and `email` only — no display
name, no avatar.

---

## The Fix

Lowercase the key when inserting into the map.

### Before

```ts
for (const ea of u.emailAddresses) {
  map.set(ea.emailAddress, { name, avatarUrl })
}
```

### After

```ts
for (const ea of u.emailAddresses) {
  map.set(ea.emailAddress.toLowerCase(), { name, avatarUrl })
}
```

No call-site changes are needed because both read sites already pass a lowercase key:
- `clerkMap.get(r.email)` — DB value, always lowercase
- `clerkMap.get(email)` — normalized at request-input time (line 67)

---

## What Did Not Change

- The `enrichWithClerk` signature and return type are identical.
- All GET/POST logic outside the map-building loop is untouched.
- No other files required changes.

---

## Beginner Mental Model: Normalize at the Boundary, Not the Usage

This is a classic **normalization boundary** mistake. The project correctly normalized
at one boundary (writing to the DB) but missed the other boundary (reading from an
external API). The principle:

> **Normalize data at every boundary where you don't control the casing.**

In this codebase, two boundaries produce email strings:
1. **User input** (POST body) → normalized with `.trim().toLowerCase()` ✓
2. **Clerk API response** → was not normalized ✗ (now fixed)

A useful mental checklist: whenever you use an external value as a Map/object key,
ask "could this value arrive in different forms that should be treated as equal?"
For emails, phone numbers, usernames, and slugs the answer is almost always yes.

The fix is always to normalize at the point you receive the external value, so the
rest of the code can assume a consistent format throughout.

---

## Files Changed

| File | Line | Change |
|------|------|--------|
| `app/api/projects/[projectId]/collaborators/route.ts` | 26 | `map.set(ea.emailAddress, ...)` → `map.set(ea.emailAddress.toLowerCase(), ...)` |
