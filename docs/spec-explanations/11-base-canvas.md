# Spec Explanation — Feature 11: Base Canvas

## Why this feature exists

This is the heart of Ghost AI. Everything built so far — auth, projects,
collaborators, Liveblocks rooms — was scaffolding for this moment: an actual
canvas where architecture diagrams live.

The spec replaces a `"Canvas coming soon"` placeholder with a real React Flow
canvas that is backed by Liveblocks real-time storage. When two users open the
same project, they see the same nodes and edges. When one user drags a node, the
other sees it move in real time. That shared, live state is the entire point.

---

## Key concept: the two-library split

This feature uses two libraries together:

| Library | What it does |
|---|---|
| **React Flow** (`@xyflow/react`) | Renders the diagram UI — nodes, edges, drag handles, zoom, minimap |
| **Liveblocks** (`@liveblocks/react-flow`) | Syncs the diagram state across all connected users in real time |

Neither library alone is enough:
- React Flow by itself is a local diagram editor — no collaboration.
- Liveblocks by itself is a sync layer — no visual rendering.

The glue is `useLiveblocksFlow` — a hook from `@liveblocks/react-flow` that
bridges both. It reads nodes and edges from Liveblocks Storage, and returns the
exact props that React Flow expects.

---

## Key concept: what is React Flow?

React Flow is a library that renders an interactive node-edge diagram inside a
`<div>`. You give it an array of nodes and an array of edges, and it draws them.

A **node** is an object like:
```ts
{
  id: "node-1",
  type: "canvasNode",
  position: { x: 100, y: 200 },
  data: { label: "API Gateway", color: "#10233D", shape: "rectangle" }
}
```

An **edge** is a connection between two nodes:
```ts
{
  id: "edge-1",
  source: "node-1",
  target: "node-2",
}
```

React Flow is "controlled" — you own the state. When the user drags a node, React
Flow doesn't move it automatically. Instead it fires `onNodesChange` with a
description of the change. Your code is responsible for applying that change to
the state and re-rendering. This is exactly how React works everywhere — the
library tells you what happened, you decide what to do.

---

## Key concept: what is Liveblocks Storage?

Liveblocks has two types of shared state:

| Type | Lifespan | Use case |
|---|---|---|
| **Presence** | Disappears when user disconnects | Cursors, "who is typing", active selection |
| **Storage** | Persists even when everyone leaves | The canvas itself — nodes, edges |

Feature 10 set up Presence. This feature introduces **Storage**: the persistent,
conflict-free shared state that holds the diagram. Liveblocks uses CRDTs
(Conflict-free Replicated Data Types) internally so two users can edit
simultaneously without corrupting the data.

`useLiveblocksFlow` manages reading from and writing to Storage for you. You
never call Liveblocks storage APIs directly — the hook handles everything.

---

## Key concept: Suspense and loading states

`useLiveblocksFlow({ suspense: true })` uses React's **Suspense** mechanism.

Normally a hook returns data or `null` while loading. With suspense, instead of
returning `null`, the hook **throws a Promise**. React intercepts the thrown
Promise, stops rendering this component tree, and renders the nearest Suspense
boundary's fallback instead. When the Promise resolves (storage is ready),
React retries rendering the component tree.

```
Browser mounts CanvasFlow
  → useLiveblocksFlow throws Promise (storage not ready)
  → React catches it, renders ClientSideSuspense fallback ("Connecting…")
  → Storage loads, Promise resolves
  → React re-renders CanvasFlow with real data
```

This is cleaner than writing `if (isLoading) return <Spinner />` inside every
component that needs the data.

`ClientSideSuspense` from Liveblocks is a Suspense boundary that also handles
SSR. On the server, Next.js doesn't connect to Liveblocks — it just renders the
fallback. On the client, it suspends properly.

---

## Key concept: the component tree

```
WorkspacePage (server)
  └── WorkspaceShell (client)
        ├── workspace bar (project name, Share, AI toggle)
        └── CanvasWrapper (client)
              └── LiveblocksErrorBoundary (class component)
                    └── LiveblocksProvider (authEndpoint="/api/liveblocks-auth")
                          └── RoomProvider (id=roomId, initialPresence)
                                └── ClientSideSuspense (fallback="Connecting…")
                                      └── CanvasFlow (client)
                                            └── ReactFlow
                                                  ├── Background (dots)
                                                  └── MiniMap
```

Each layer has one job:
- `WorkspaceShell` owns the workspace layout and UI chrome.
- `CanvasWrapper` owns the Liveblocks connection infrastructure.
- `CanvasFlow` owns the React Flow rendering.

---

## Why `types/canvas.ts`?

Node and edge types need to be shared across multiple files:
- `canvas-flow.tsx` uses them to type `useLiveblocksFlow<CanvasNode, CanvasEdge>`
- Future AI generation code will construct `CanvasNode` objects to push into storage
- Future custom node renderers will use `NodeData` to access `label`, `color`, `shape`

Putting them in one file with a clear name (`types/canvas.ts`) makes the contract
explicit and prevents drift between files that all work with the same data.

### Why does `NodeData` extend `Record<string, unknown>`?

```ts
export interface NodeData extends Record<string, unknown> {
  label: string
  color?: string
  shape?: string
}
```

React Flow's `Node<Data>` generic has a constraint: `Data extends Record<string, unknown>`.
This means every node's data object must be a plain-object type that TypeScript
can index with any string key. Without the `extends Record<string, unknown>`,
TypeScript rejects `NodeData` as the type parameter because the constraint isn't
satisfied.

Practically: `label`, `color`, and `shape` are the fields we care about, but
TypeScript also needs to be satisfied that the interface is compatible with
arbitrary string keys. The `extends Record<...>` declaration does exactly that.

---

## Why is there an error boundary?

```tsx
class LiveblocksErrorBoundary extends Component<...> {
  static getDerivedStateFromError() { return { hasError: true } }
  ...
}
```

What can go wrong when CanvasFlow renders:
- Network is down and `/api/liveblocks-auth` fails
- The Liveblocks secret key is misconfigured
- The room ID doesn't exist on Liveblocks's servers

Without an error boundary, any of these errors would crash the entire page and
show React's default error screen (a broken app state). The error boundary
catches the error, sets `hasError: true`, and renders a graceful message instead.

**Why must it be a class component?**

React's error boundary API (`getDerivedStateFromError`, `componentDidCatch`) is
only available on class components — there is no functional component equivalent
in core React. This is a deliberate React design decision: the lifecycle hooks
for catching render errors haven't been ported to the hooks model. It's one of
the few remaining places where a class component is still required.

---

## Why `ConnectionMode.Loose`?

React Flow has two connection modes:

| Mode | Behavior |
|---|---|
| `Strict` | User must click exactly on a handle dot to start a connection |
| `Loose` | User can click anywhere near the node edge; React Flow finds the closest handle |

Loose mode is more forgiving on a touch screen or high-DPI display where the
handles are small. For a design tool where users should be focused on ideas, not
fighting small click targets, Loose mode reduces friction.

---

## Why `fitView`?

When the canvas first loads, React Flow doesn't know where to position the
viewport. Without `fitView`, it defaults to origin `(0, 0)` — which might be
empty space if all nodes are off to the right. `fitView` automatically zooms and
pans so all current nodes are visible. On an empty canvas it has no effect.

---

## How the Liveblocks auth handshake works end to end

When `CanvasWrapper` mounts in the browser:

1. `LiveblocksProvider` initializes a Liveblocks client configured with
   `authEndpoint="/api/liveblocks-auth"`.
2. `RoomProvider` tells the client which room to join (`id={roomId}`).
3. The client fires a POST to `/api/liveblocks-auth` with `{ room: roomId }`.
4. The server checks Clerk auth + project membership → issues a signed token.
5. The client uses the token to open a WebSocket connection to Liveblocks.
6. `useLiveblocksFlow` inside `CanvasFlow` connects to that WebSocket and reads
   the current nodes/edges from Storage.
7. React Flow renders with the live data.

From here, every drag, connection, or deletion updates Liveblocks Storage, which
pushes the change over WebSocket to every other connected client.

---

## Decisions made and trade-offs

### `Storage: {}` vs declaring the flow type

Option A: Keep `Storage: {}` in `liveblocks.config.ts` (what we did).\
Option B: Declare `Storage: { flow: LiveblocksFlow<CanvasNode, CanvasEdge> }`.

Option B gives TypeScript full visibility into storage shape, which is valuable
for future manual storage reads. But it makes `RoomProvider` require
`initialStorage`, which means importing `LiveObject` and `LiveMap` from
`@liveblocks/client` just to provide an empty initial scaffold.

Since `useLiveblocksFlow` handles first-run storage initialization automatically,
the added complexity of Option B provides no runtime benefit at this stage. Option
A keeps the wrapper simple. When we add backend AI generation that writes directly
to storage via `mutateStorage`, we'll fill in the `Storage` type at that point.

### Two files vs one

`CanvasWrapper` and `CanvasFlow` could be one file. The split adds a file but each
component becomes easier to reason about: the wrapper never changes because of
canvas feature work, and the canvas component never changes because of provider
configuration. The boundary also makes it easy to add other Liveblocks-backed
components later (e.g. a `<Cursors />` layer) by inserting them alongside
`<CanvasFlow />` inside `ClientSideSuspense`.
