# Fix: `ownedKey` Missing Project Name (`use-project-actions.ts`)

## Summary

The sync key that drives the `useEffect` re-sync for `ownedProjects` was built from
project IDs only. A server-side rename produces the same IDs with different names, so
the key was unchanged and the effect never fired — leaving the UI showing stale names
after `router.refresh()` reconciled with the server.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `hooks/use-project-actions.ts` | 59 | `ownedKey` excluded project names | Fixed |

---

## Step 1 — Verification

```ts
// Line 59 before the fix
const ownedKey = initialOwned.map((p) => p.id).join(",")
```

Checked two things:

1. **What does the key capture?** Only `p.id`. IDs are stable — they never change for
   the lifetime of a project. A rename on the server produces a `initialOwned` array
   where every ID is identical to the previous render, so `ownedKey` produces the same
   string both before and after the refresh.

2. **Does the existing effect cover it?** The effect body calls
   `setOwnedProjects(initialOwned)`, which would correctly update the local list —
   but only if the key changes. Because the key doesn't change on a rename, the effect
   is never scheduled.

Finding confirmed valid.

---

## The Bug Explained

### How the sync effect works

```ts
const ownedKey = initialOwned.map((p) => p.id).join(",")
useEffect(() => {
  setOwnedProjects(initialOwned)
}, [ownedKey])
```

React's `useEffect` re-runs whenever any value in its dependency array changes.
Here the dependency is `ownedKey` — a derived string. React compares the new value
of `ownedKey` to the previous value using `Object.is` (strict equality). If they are
the same string, the effect is skipped entirely.

The key `"abc123,def456"` looks the same before and after a rename because IDs don't
change. React sees no difference and skips the effect body, so `setOwnedProjects` is
never called and the local list stays frozen at its pre-refresh value.

### Why the optimistic update masked this locally

`handleRename` does two things:

```ts
// 1. Optimistic update — immediately correct on this client
setOwnedProjects((prev) =>
  prev.map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p))
)

// 2. Server reconciliation — re-fetches data from the server
router.refresh()
```

For the user who performed the rename, the optimistic update fires first and makes
the name change visible instantly. Then `router.refresh()` returns the authoritative
server data — but because `ownedKey` didn't change, the sync effect silently skipped
the reconciliation step.

In practice this means:

- If the server name exactly matches the optimistic name: no visible bug (the two
  agree, so skipping reconciliation is harmless).
- If they differ (e.g., server trims whitespace, applies a slug, or the rename
  partially failed): the UI shows the wrong name with no way to recover short of a
  full page reload.
- For any other client (a collaborator viewing the same project list) who did not
  perform the rename: their next `router.refresh()` also fails to propagate the
  new name for the same reason.

---

## The Fix

Include the project name in the key so any change to any name triggers the effect.

### Before

```ts
const ownedKey = initialOwned.map((p) => p.id).join(",")
```

### After

```ts
const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
```

Sample key values, before and after a rename of project `abc123` from `"Alpha"` to
`"Alpha v2"`:

```
Before rename:  "abc123:Alpha,def456:Beta"
After rename:   "abc123:Alpha v2,def456:Beta"   ← strings differ → effect fires
```

The effect body is unchanged:

```ts
useEffect(() => {
  setOwnedProjects(initialOwned)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ownedKey])
```

---

## Why Not `JSON.stringify(initialOwned)`?

`JSON.stringify` was offered as an alternative. It would work, but it serializes every
field on every project object — including timestamps like `updatedAt`, `createdAt`, or
any future fields added to `ProjectItem`. That means the effect would fire on any
property change, not just ones visible in the UI. This risks unnecessary re-renders
when the server returns objects with refreshed timestamps but identical content.

The `${p.id}:${p.name}` form is targeted: it only reacts to changes that are actually
visible on screen (project names), keeping re-renders minimal.

If `ProjectItem` gains other user-visible fields in the future (e.g., a description or
icon), the key should be extended to include those fields too.

---

## What Did Not Change

- The `useEffect` body — `setOwnedProjects(initialOwned)` — is untouched.
- The eslint-disable comment is untouched.
- All handlers and the hook's public interface are untouched.
- The pre-existing lint warning at line 61 (`setState` inside effect) was present
  before this change and is unrelated to it.

---

## Beginner Mental Model: Derived Keys as Change Detectors

React compares dependency array values between renders to decide whether to re-run an
effect. When the dependency is an object or array, naive comparison always returns
`false` (two different array references are never `===` even if their contents are
identical). Deriving a string from the data solves this — strings compare by value.

The key principle: **the key must encode everything you care about detecting changes
in.** If you only encode IDs, you can only detect additions and removals. If you also
encode names, you detect renames too.

```
Key encodes IDs only       → detects: project added, project removed
Key encodes IDs + names    → detects: project added, project removed, project renamed
Key encodes everything     → detects: any field change (may over-trigger)
```

Choose the narrowest key that covers the actual use case. This keeps effects
predictable and avoids spurious re-renders from irrelevant field changes.

---

## Files Changed

| File | Line | Change |
|------|------|--------|
| `hooks/use-project-actions.ts` | 59 | Key now includes name: `` `${p.id}:${p.name}` `` |
