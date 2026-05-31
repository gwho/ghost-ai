# Fix: Remove setState Inside useEffect for Owned Projects Sync

## Finding

`hooks/use-project-actions.ts` had this pattern:

```ts
const [ownedProjects, setOwnedProjects] = useState(initialOwned)

const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
useEffect(() => {
  setOwnedProjects(initialOwned)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ownedKey])
```

ESLint flagged `setOwnedProjects` inside `useEffect` as a cascading render.

## What the Pattern Was Trying to Do

The hook keeps a **local copy** of the server-provided `initialOwned` array. It
needs local state because the handlers update the list optimistically — rename
updates a name in-place, delete removes an entry — without waiting for the
server round-trip.

But after `router.refresh()`, Next.js re-fetches server data and passes a new
`initialOwned` array. The local state needs to sync back to the fresh server
data. That's what the `useEffect` was doing: "when the server data changes,
overwrite my local copy."

## Why the ESLint Rule Exists

When you call `setState` inside a `useEffect`, React:

1. Renders the component with the **old** state.
2. Runs the effect and calls `setState`.
3. Renders the component **again** with the new state.

That's two renders when you only needed one. The first render is wasted work —
the component briefly shows stale data before the effect fires and triggers a
corrective re-render. The React docs call this a "cascading render."

## The Fix — Adjust State During Render

React has a recommended pattern for this: detect the prop change **during
render** and call `setState` right there (not inside an effect). When React sees
`setState` called during render, it abandons the current render and restarts
immediately with the new state — **one** render total, no wasted intermediate
frame.

```ts
const [ownedProjects, setOwnedProjects] = useState(initialOwned)
const [prevOwnedKey, setPrevOwnedKey] = useState(() =>
  initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
)

const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
if (ownedKey !== prevOwnedKey) {
  setPrevOwnedKey(ownedKey)
  setOwnedProjects(initialOwned)
}
```

## How It Works Step by Step

1. `prevOwnedKey` remembers the last `ownedKey` we synced with.
2. Every render, we compute the current `ownedKey` from `initialOwned`.
3. If they differ, server data changed — we update both `prevOwnedKey` and
   `ownedProjects` in-place during render.
4. React sees the `setState` calls during render, discards the in-progress
   render, and restarts with the updated state. Only one committed render.
5. If they match, nothing happens — we keep using the local state (which may
   include optimistic updates from create/rename/delete).

## Decision

| Option | Why / why not |
|---|---|
| Adjust state during render (chosen) | React-recommended, eliminates the double render, removes the lint error, and the `useEffect` import is no longer needed. |
| `eslint-disable` the warning | Already had this, but it masks a real performance issue and React discourages the pattern. |
| Use `key` prop to remount the whole provider | Would work but destroys all local state including dialog state, causing worse UX. |
| Derive everything from props with no local state | Can't do optimistic updates without local state. |

## Beginner Model — "Adjusting State Based on Props"

React components re-render when their props change. Sometimes you need local
state that *mostly* mirrors a prop but can also be modified locally (like an
optimistic update). The question is: how do you re-sync when the prop changes?

**The wrong way** (useEffect):
- Render with old state → paint to screen → effect fires → setState → render
  again with new state → paint again. Two renders, one wasted.

**The right way** (during render):
- Start rendering → notice prop changed → call setState → React restarts render
  with new state → paint once. One render, no waste.

The key insight is that calling `setState` during render is **not** the same as
calling it in an event handler. React treats it specially: instead of scheduling
a future update, it abandons the current render and starts over immediately. The
user never sees the stale state.

## Validation

- `npx tsc --noEmit --pretty false` — passed
- `npm run lint -- hooks/use-project-actions.ts` — passed (0 errors, 0 warnings)
- IDE linter — no errors
