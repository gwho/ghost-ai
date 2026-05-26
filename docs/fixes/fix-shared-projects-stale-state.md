# Fix: `sharedProjects` Frozen at Initial Render (`use-project-actions.ts`)

## Summary

`sharedProjects` was initialized with `useState(initialShared)` but had no mechanism
to re-sync when the server sent fresh data after a `router.refresh()`. The list was
effectively frozen at the value it had the first time the component mounted. The fix
removes the local state entirely, since `sharedProjects` has no local mutations and
can be read directly from the prop.

| File | Line | Issue | Status |
|------|------|-------|--------|
| `hooks/use-project-actions.ts` | 49 | `sharedProjects` never updated after initial render | Fixed |

---

## Step 1 — Verification (Always Do This First)

Before changing anything, confirm the issue is real in the current code. Reports can
be stale — the bug may have already been fixed, or the report may describe a code
path that no longer exists.

```ts
// Line 49 before the fix — the destructured array has no setter
const [sharedProjects] = useState(initialShared)
```

Two things to check:

1. **Is there a setter?** — No. The destructure `[sharedProjects]` omits the second
   element (`setSharedProjects`), so there is no way to update the value after mount.

2. **Is there a sync effect?** — Checked the entire file for `useEffect` blocks.
   Only one existed (lines 59–63), and it synced `ownedProjects`, not `sharedProjects`.

3. **Are there any local mutations?** — Searched the file for every write to
   `sharedProjects`. Found none. Compare this to `ownedProjects`, which is updated
   optimistically in both `handleRename` (line 124) and `handleDelete` (line 141).

All three checks confirmed the bug was valid.

---

## The Bug Explained

### What `useState(initialShared)` actually does

`useState` is a React hook that creates a piece of **local component state**. The
argument you pass to it — `initialShared` — is the **initial value only**. React uses
it exactly once: when the component first mounts. After that, the prop value is
ignored entirely unless you explicitly write code to respond to it.

```ts
// This is what React does internally (simplified):
// On first render:  state = initialShared  ✓
// On re-render:     state = previous state (prop is ignored!) ✗
const [sharedProjects] = useState(initialShared)
```

This means: even if the parent component re-fetches data from the server and passes
a brand new `initialShared` array with updated projects, `sharedProjects` inside the
hook will still hold the original array from the first mount.

### Why `router.refresh()` makes this worse

`router.refresh()` is called in `handleRename` and `handleDelete` to tell Next.js to
re-run the server-side data fetch for the current page. The server returns fresh data,
React re-renders the tree with the new props — but because `sharedProjects` is frozen
in local state, the shared-projects list on screen never updates.

The user would see:

- Rename a project → their owned project list updates (because `ownedProjects` has
  a sync effect) → but the shared-projects section shows stale data.
- Delete a project → same problem.

---

## Two Options Considered

The original report offered two remedies:

### Option A — Add a `useEffect` to sync when the prop changes

```ts
const [sharedProjects, setSharedProjects] = useState(initialShared)

const sharedKey = initialShared.map((p) => p.id).join(",")
useEffect(() => {
  setSharedProjects(initialShared)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sharedKey])
```

This is the same pattern already used for `ownedProjects`. It works, but it has a
cost: calling `setState` inside a `useEffect` schedules an extra render cycle —
React renders once with the stale state, then immediately re-renders after the effect
fires. It also triggers an ESLint rule (`react-hooks/no-direct-set-state-in-use-effect`)
because calling `setState` synchronously inside an effect body is generally a warning
sign.

**When to use Option A:** when the state value needs local mutations *and* must stay
in sync with the server. `ownedProjects` is a good example — it is mutated optimistically
in `handleRename` and `handleDelete`, but then reconciled with the server on refresh.

### Option B — Remove local state and read the prop directly ✓ (chosen)

```ts
const sharedProjects = initialShared
```

If a piece of state has no local mutations — nothing in the component ever calls
`setSharedProjects(...)` — then it does not need to be state at all. Local state
only makes sense when the component needs to diverge from what the server says.
Without that need, derived-from-prop state is pure overhead.

**Why Option B is correct here:** a full search of the file found zero writes to
`sharedProjects`. The value flows in from the server, is passed through, and is
returned from the hook as-is. There is no local divergence, so there is no reason
to freeze it in state.

---

## The Fix

### Before

```ts
// Line 49
const [sharedProjects] = useState(initialShared)
```

### After

```ts
// Line 49
const sharedProjects = initialShared
```

That is the entire change. One line, no new imports, no new effects.

Because `sharedProjects` is now a plain variable that gets its value from the prop
on every render, it will always reflect the latest data the parent passes in —
including data returned by `router.refresh()`.

---

## What Did Not Change

- The public interface (`ProjectActionsContextValue`) is identical — `sharedProjects`
  is still returned with the same type and the same name.
- The `ownedProjects` sync logic (lines 59–63) is untouched.
- All handlers (`handleCreate`, `handleRename`, `handleDelete`) are untouched.
- The `useState` import is still needed for the other five state variables.

---

## Beginner Mental Model: Props vs. State

This bug is a classic example of confusing *where data comes from* with *who owns it*.

| Concept | Meaning | Example in this file |
|---------|---------|----------------------|
| **Prop** | Data passed in from outside | `initialShared` — the server sends this |
| **State** | Data this component owns and can change | `isLoading`, `open`, `createName` |
| **Derived** | Computed from props, no local changes needed | `sharedProjects` after the fix |

The rule of thumb: **only use `useState` for values this component needs to change
independently of the server.** If a value is always equal to what the server says,
just use the prop directly.

A helpful way to spot this mistake in the future:

```ts
// Red flag: state initialized from a prop, no setter exposed
const [foo] = useState(initialFoo)
//           ^ no setter = can never be updated = why is it state?
```

If you see `useState` with only one destructured element and no corresponding
`useEffect`, ask: does this value ever need to change locally? If not, drop the
`useState` wrapper.

---

## Files Changed

| File | Line | Change |
|------|------|--------|
| `hooks/use-project-actions.ts` | 49 | `const [sharedProjects] = useState(initialShared)` → `const sharedProjects = initialShared` |
