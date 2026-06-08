# Fix: Canvas Node IDs Use Browser UUIDs

## Finding Verification

The finding was still valid in `components/editor/canvas-flow.tsx`.

Both node creation paths built IDs with the same local pattern:

```ts
`${shape}-${Date.now()}-${counter.current}`
```

One path handles drag-and-drop creation, and the other handles keyboard-accessible shape creation from the shape panel.

## What Was Wrong

`Date.now()` plus a component-local counter is only unique within one browser tab. In a collaborative Liveblocks room, two users can create the same shape in the same millisecond with the same local counter value.

React Flow and Liveblocks both rely on stable unique node IDs. A collision can overwrite or confuse node updates, selection, edges, and persistence.

## What Changed

Both creation paths now call a shared `createNodeId(shape)` helper.

The helper returns IDs in this form:

```ts
`${shape}-${crypto.randomUUID()}`
```

For environments without `crypto.randomUUID`, it falls back to a UUID-shaped value generated with `crypto.getRandomValues`. If Web Crypto is unavailable entirely, it uses a timestamp plus two random suffixes as the last-resort fallback.

The old local `counter` ref was removed because it no longer provides meaningful cross-user uniqueness.

## Why This Fixes It

`crypto.randomUUID()` is designed for globally unique client-generated identifiers. Using it keeps ID generation local and fast while avoiding coordination between collaborators.

Keeping the shape prefix preserves the existing readable ID convention without depending on timestamp/counter uniqueness.

## Suggested AI Discussion Topics

1. Why are local counters unsafe in collaborative systems?
2. What kinds of bugs can duplicate React Flow node IDs cause?
3. When should a client generate IDs locally versus asking the server for IDs?

## Validation

- `npx eslint components/editor/canvas-flow.tsx`
- `npx tsc --noEmit --pretty false`
