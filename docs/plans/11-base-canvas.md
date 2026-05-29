# Feature 11 — Base Canvas

## What was built

A collaborative React Flow canvas backed by Liveblocks real-time storage. The
canvas placeholder in the workspace is replaced by a live, interactive diagram
surface. Multiple users sharing a room see the same nodes and edges in real time.

## Files created

| File | Purpose |
|---|---|
| `types/canvas.ts` | Shared types: `NodeData`, `CanvasNode`, `CanvasEdge`, `NODE_COLORS`, `NODE_SHAPES` |
| `components/editor/canvas-flow.tsx` | Inner canvas component — `useLiveblocksFlow` + `ReactFlow` render |
| `components/editor/canvas-wrapper.tsx` | Outer provider shell — Liveblocks auth, room, suspense, error boundary |

## Files modified

| File | Change |
|---|---|
| `components/editor/workspace-shell.tsx` | Replaced canvas placeholder `<div>` with `<CanvasWrapper roomId={project.id} />` |
| `context/progress-tracker.md` | Updated phase, completed entry, and next-up |

## types/canvas.ts

Defines the shared contract for all canvas data in the app.

**`NodeData`** — the data object stored inside every canvas node:

```ts
export interface NodeData extends Record<string, unknown> {
  label: string
  color?: string
  shape?: string
}
```

`extends Record<string, unknown>` is required by `@xyflow/react`'s `Node<Data>`
generic constraint. Without it, TypeScript rejects the type.

**`CanvasNode` / `CanvasEdge`** — typed wrappers around the React Flow base types:

```ts
export type CanvasNode = Node<NodeData, 'canvasNode'>
export type CanvasEdge = Edge<Record<string, unknown>, 'canvasEdge'>
```

The second type parameter (`'canvasNode'`, `'canvasEdge'`) is the string literal
used as the `type` field on each node/edge object. This enables React Flow's
custom node renderer lookup (`nodeTypes['canvasNode']`) — a later feature.

**`NODE_COLORS`** — 8 dark-fill / light-text pairs that define the node color
palette, matching the design token table in `ui-context.md`.

**`NODE_SHAPES`** — union type and constant array of the 6 supported shapes:
`rectangle`, `diamond`, `circle`, `pill`, `cylinder`, `hexagon`.

## components/editor/canvas-flow.tsx

The inner component. Must be `"use client"` because React Flow uses browser APIs
(`ResizeObserver`, canvas, pointer events).

**CSS import:**

```ts
import '@xyflow/react/dist/style.css'
```

React Flow ships its own stylesheet (node borders, edge paths, selection ring,
handle dots). Without it the canvas renders as unstyled HTML.

**`useLiveblocksFlow` with suspense:**

```ts
const { nodes: rawNodes, edges: rawEdges, ... } =
  useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

const nodes = rawNodes ?? []
const edges = rawEdges ?? []
```

`suspense: true` tells the hook to throw a Promise (the React Suspense protocol)
until Liveblocks Storage is ready. The `ClientSideSuspense` boundary above catches
it and shows the loading fallback. Once storage is ready, the component renders
with real data.

The `rawNodes ?? []` fallback is needed because TypeScript infers `nodes` as
`CanvasNode[] | null` even in suspense mode (the library's TypeScript types don't
narrow the union for the suspense case at compile time, even though at runtime
nodes are never null here).

**`ReactFlow` props:**

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onDelete={onDelete}
  connectionMode={ConnectionMode.Loose}
  fitView
>
  <Background variant={BackgroundVariant.Dots} />
  <MiniMap />
</ReactFlow>
```

- `onNodesChange` / `onEdgesChange` — write node/edge mutations back to
  Liveblocks Storage so all connected clients see the same updates.
- `onConnect` — handles new edge creation when a user draws a connection line.
- `onDelete` — handles node/edge deletion (Delete key, backspace).
- `ConnectionMode.Loose` — allows connecting to the nearest handle rather than
  requiring an exact click on a specific handle dot.
- `fitView` — zooms and pans to fit all nodes into the viewport on initial load.
- `BackgroundVariant.Dots` — dot-pattern background texture.

## components/editor/canvas-wrapper.tsx

The outer provider shell. Splits Liveblocks setup from React Flow rendering so
each file has a single responsibility.

**`LiveblocksErrorBoundary`** — a React class component that catches errors thrown
during rendering (including Liveblocks auth failures):

```tsx
class LiveblocksErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  static getDerivedStateFromError() { return { hasError: true } }
  render() { ... }
}
```

React error boundaries must be class components — functional components cannot
use `componentDidCatch` or `getDerivedStateFromError`. This is a React constraint,
not a Liveblocks one.

**`LiveblocksProvider`** — initializes the Liveblocks client for the whole tree,
pointing it at our auth endpoint:

```tsx
<LiveblocksProvider authEndpoint="/api/liveblocks-auth">
```

When any component inside this tree calls a Liveblocks hook for the first time,
the provider fires a POST to `/api/liveblocks-auth` with the room ID and gets
back a signed token.

**`RoomProvider`** — scopes all Liveblocks hooks below it to a specific room:

```tsx
<RoomProvider
  id={roomId}
  initialPresence={{ cursor: null, isThinking: false }}
>
```

`initialPresence` is required — it sets the user's presence broadcast before
they update it. `cursor: null` means "not on the canvas yet."

`roomId` is `project.id` — the Prisma project UUID. The Liveblocks auth route
already uses this same ID as the room identifier (matching `getProjectAccess`).

**`ClientSideSuspense`** — a Liveblocks-specific Suspense boundary that also
handles SSR. On the server it renders the fallback instead of trying to resolve
real-time state. On the client it suspends until storage is loaded, then renders
`<CanvasFlow />`.

## Key decisions

### Why split CanvasWrapper and CanvasFlow into two files?

`CanvasWrapper` sets up providers (no React Flow dependency).
`CanvasFlow` renders the canvas (no Liveblocks provider dependency).
Splitting them means each file has one job, and custom node/edge components added
later only touch `canvas-flow.tsx` — the provider shell stays stable.

### Why keep Storage as `{}` in liveblocks.config.ts?

`useLiveblocksFlow` manages its own storage structure internally — it writes nodes
and edges under the `"flow"` key using its own mutation logic. Declaring `flow`
in the global `Storage` type causes `RoomProvider` to require `initialStorage`
(because TypeScript now knows what the shape must be at startup). That creates a
dependency on importing `LiveObject` and `LiveMap` in the wrapper just for an
initial empty scaffold.

Since the hook handles first-run storage initialization automatically, keeping
`Storage: {}` avoids the complexity with no functional downside.

### Why is roomId passed down from WorkspaceShell instead of reading from URL params?

`WorkspaceShell` already receives `project` (which includes `project.id = roomId`)
from the server component that verified access. Re-reading the URL param from a
client component would require `useParams()` and create an unnecessary hook
dependency. The prop is already there and correct.

## Verification

`npm run build` passes clean. `/editor/[roomId]` appears in the route table as
a dynamic (ƒ) server-rendered route. Canvas surface is visible in the workspace.
