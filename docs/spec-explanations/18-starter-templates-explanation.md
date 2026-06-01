# Feature 18 — Starter Templates

## What This Feature Does

Before this feature, every new canvas started completely blank. Users had to drag shapes
from the panel and wire them together manually before they could convey any meaningful
architecture.

This feature adds:

- **A template library** — three pre-built architecture diagrams: Microservices Architecture,
  CI/CD Pipeline, and Event-Driven System.
- **A modal gallery** — opened from a new "Templates" button in the workspace navbar; shows
  each template as a card with a live diagram preview, name, description, and an Import button.
- **A canvas diagram preview** — drawn with the HTML Canvas API inside each card; no React Flow
  instance required.
- **Import action** — clicking Import clears the current canvas and loads the template's nodes
  and edges through the existing Liveblocks state flow, then fits the viewport to the new content.

---

## How the Template Data Works

### The CanvasTemplate type

`CanvasTemplate` is defined in `components/editor/starter-templates.ts`:

```ts
export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}
```

`CanvasNode` and `CanvasEdge` are the same types used everywhere else in the codebase
(imported from `types/canvas.ts`). This means templates slot into the existing React Flow
and Liveblocks pipeline without any conversion — the nodes are already in the exact shape
the canvas expects.

### Helper functions

Two small private helpers keep the template definitions readable:

```ts
function makeNode(id, label, x, y, colorIndex, shape, width, height): CanvasNode
function makeEdge(id, source, target): CanvasEdge
```

`makeNode` wires in all required fields: `type: 'canvasNode'`, the position object, the
`data` object (label, color from `NODE_COLORS[colorIndex].fill`, shape), and the explicit
`width`/`height` that React Flow needs for layout calculations.

`makeEdge` sets `type: 'canvasEdge'` and an empty `data: {}` object. Custom edge data
(labels) is not needed for templates — users can add them after importing.

### The three templates

| Template | Theme | Key nodes | Key shapes used |
|---|---|---|---|
| Microservices Architecture | Distributed services | API Gateway, Auth, User, Product, Order, two databases, Message Bus | rectangle, cylinder, pill |
| CI/CD Pipeline | Deployment pipeline | Code Repo, CI Runner, Build, Test Suite, Registry, Staging, Production, Monitoring | rectangle, cylinder, hexagon |
| Event-Driven System | Async messaging | Producer A/B, Event Bus, Consumer 1/2/3, Dead Letter Queue | rectangle, pill, cylinder |

Each template uses a spread of colours from `NODE_COLORS` so different services are
visually distinct at a glance.

---

## How the Modal Works

### Component structure

`StarterTemplatesModal` is a `"use client"` component in
`components/editor/starter-templates-modal.tsx`. It renders a shadcn `Dialog` (the same
pattern used by `ShareDialog` and `project-dialogs.tsx` elsewhere in the project).

Props:
```ts
interface StarterTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (template: CanvasTemplate) => void
}
```

Inside the dialog content there is a scrollable container (`overflow-y-auto max-h-[60vh]`)
holding a two-column CSS grid of template cards. Each card:

1. Renders a `TemplatePreview` (the canvas drawing — covered below)
2. Shows the template name and description
3. Has an Import button that calls `onImport(template)` then `onOpenChange(false)`

The `onOpenChange(false)` call is what closes the modal after import. This matches the
pattern used by every other dialog in the project.

### Why the modal lives inside CanvasFlowInner

The Import action needs access to `onNodesChange`, `onEdgesChange`, and `reactFlow` — all
of which live inside `CanvasFlowInner` (the component that calls `useLiveblocksFlow` and
`useReactFlow`). Rather than lifting those values up the tree (which would push canvas
plumbing into `WorkspaceShell`), the modal is rendered directly inside `CanvasFlowInner`
where it can receive a `loadTemplate` callback that already closes over the right state.

`WorkspaceShell` manages the open/close state (`isTemplatesOpen`) and the Templates button.
It passes the state down through `CanvasWrapper` → `CanvasFlow` → `CanvasFlowInner` as two
props: `isTemplatesOpen` and `onTemplatesOpenChange`.

---

## How the Canvas Preview Works

### The TemplatePreview component

`TemplatePreview` is a private component (not exported) defined in the same file as the
modal. It renders a `<canvas>` element and draws the template diagram inside a `useEffect`.

```tsx
function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { /* draw */ }, [template])
  return <canvas ref={canvasRef} width={220} height={130} className="w-full rounded-xl bg-base" />
}
```

### Bounding box and scale

The first step is finding the spatial extent of all nodes so the drawing can be scaled to
fit the 220×130px canvas:

```ts
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const n of nodes) {
  minX = Math.min(minX, n.position.x)
  minY = Math.min(minY, n.position.y)
  maxX = Math.max(maxX, n.position.x + (n.width ?? 120))
  maxY = Math.max(maxY, n.position.y + (n.height ?? 40))
}
const scale = Math.min((W - PAD*2) / dataW, (H - PAD*2) / dataH)
```

`Math.min(scaleX, scaleY)` picks the smaller of the two axis scales. This keeps the
diagram proportional — it fits in one axis without overflowing the other.

The `offsetX`/`offsetY` calculation centres the scaled diagram within the canvas, adding
equal whitespace on both sides of the shorter axis (letterboxing).

### Drawing order: edges first, then nodes

Edges are drawn before nodes so node rectangles paint on top and hide any edge lines that
cross a node's body. A `Map<nodeId, center>` is built first so each edge can look up its
source and target centre point in O(1):

```ts
for (const edge of edges) {
  const src = centers.get(edge.source)
  const tgt = centers.get(edge.target)
  ctx.beginPath()
  ctx.moveTo(src.x, src.y)
  ctx.lineTo(tgt.x, tgt.y)
  ctx.stroke()
}
```

Nodes are drawn as filled, stroked rounded rectangles:

```ts
ctx.fillStyle = node.data.color ?? '#1F1F1F'
ctx.roundRect(p.x, p.y, w, h, 2)
ctx.fill()
ctx.stroke()
```

Node shapes (diamond, hexagon, cylinder, etc.) are not reproduced in the preview. The
preview is intentionally minimal — it communicates layout and topology, not the exact visual
fidelity of the full canvas. This keeps the preview code lightweight and fast.

### No React Flow instance

A full `<ReactFlow>` instance would need a `ReactFlowProvider`, async node layout, and the
full React Flow CSS import. For a 220×130px thumbnail that only needs to convey structure,
that overhead is not justified. The HTML Canvas 2D API is sufficient and renders
synchronously in the `useEffect`.

---

## How Template Import Works

### The loadTemplate callback

`loadTemplate` is a `useCallback` inside `CanvasFlowInner`:

```ts
const loadTemplate = useCallback((template: CanvasTemplate) => {
  onNodesChange(nodes.map(n => ({ type: 'remove' as const, id: n.id })))
  onEdgesChange(edges.map(e => ({ type: 'remove' as const, id: e.id })))
  onNodesChange(template.nodes.map(n => ({ type: 'add' as const, item: n })))
  onEdgesChange(template.edges.map(e => ({ type: 'add' as const, item: e })))
  reactFlow.fitView({ duration: 200 })
}, [nodes, edges, onNodesChange, onEdgesChange, reactFlow])
```

### Why remove-then-add, not replace

`onNodesChange` and `onEdgesChange` are the standard React Flow change handlers — they
accept an array of `NodeChange` or `EdgeChange` objects. Each change has a `type` field
(`'add'`, `'remove'`, `'position'`, etc.). This is the same API used to add a node when
dragging from the shape panel.

There is no single "replace all" change type. The clear-then-add pattern — remove every
current node, remove every current edge, then add all template nodes and edges — achieves a
full replacement in four sequential calls. Because `onNodesChange` and `onEdgesChange` are
backed by Liveblocks Storage, all four mutations are broadcast to every collaborator
automatically.

### Why this stays inside the existing collaborative canvas state

The spec requires that the template replaces the canvas through the existing state flow, not
through a direct Liveblocks API call or a React Flow ref. Routing through `onNodesChange`
and `onEdgesChange` means:

1. Every change is recorded in the Liveblocks undo stack — a collaborator can undo the
   template import with `Cmd+Z`.
2. All collaborators see the template appear simultaneously, because Liveblocks broadcasts
   Storage mutations in real time.

### Fit view after import

`reactFlow.fitView({ duration: 200 })` is called after the changes. It animates the
viewport to frame all new nodes within 200 milliseconds, using the same easing and duration
as zoom buttons from Feature 17.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| Template data uses `CanvasNode`/`CanvasEdge` types directly | No conversion layer — templates slot into the existing React Flow + Liveblocks pipeline without transformation |
| `makeNode`/`makeEdge` helpers | Without helpers, each template would have 15–20 lines of repeated boilerplate per node; helpers reduce a node definition to one line |
| Modal renders inside `CanvasFlowInner`, not `WorkspaceShell` | `loadTemplate` needs `onNodesChange`, `onEdgesChange`, and `reactFlow` — all available only inside the Liveblocks + ReactFlow subtree; lifting them up would push canvas plumbing into the layout shell |
| Two props drilled: `isTemplatesOpen` + `onTemplatesOpenChange` | Only two values needed; a context or ref pattern would add indirection without benefit for this scope |
| HTML Canvas preview, not a React Flow instance | A full React Flow instance in a 220×130px thumbnail has no benefit; Canvas 2D API is synchronous, lightweight, and sufficient for layout/topology communication |
| Edges drawn before nodes | Nodes paint over edge lines that pass through them, which looks cleaner than edge lines floating on top of node boxes |
| `Math.min(scaleX, scaleY)` for uniform scale | Prevents distortion — the diagram stays proportional on both axes; letterboxing fills the unused space |
| Remove-then-add pattern (not a direct replace) | `onNodesChange`/`onEdgesChange` have no single "replace all" type; clear + add achieves the same result while going through the standard Liveblocks-tracked state path |
| Undo stack tracks the import | Routing through `onNodesChange`/`onEdgesChange` means the import is a Liveblocks Storage mutation — collaborators can undo it with `Cmd+Z` |
| `fitView({ duration: 200 })` after import | Animates the viewport to the new content; consistent 200ms easing matches all other viewport transitions in the project |
| No template shapes reproduced in preview | Keeps preview code small and fast; layout + topology (node count, edge connections, relative positions) is enough to distinguish templates at thumbnail size |

---

## Topics to Explore with an AI

### Coding & JavaScript

- "What is the HTML Canvas 2D API? What is a rendering context, and how is `canvas.getContext('2d')` different from `canvas.getContext('webgl')`? When would you choose one over the other?"
- "What does `ctx.beginPath()` do before drawing a line? What happens if you skip it and draw two lines in a row — why do they end up visually connected?"
- "What is `ctx.roundRect(x, y, w, h, radius)`? Is it available in all browsers? How would you write a fallback using `ctx.arc()` and `ctx.lineTo()` for browsers that don't support it?"
- "What does `Math.min(scaleX, scaleY)` accomplish when fitting a rectangle into a fixed viewport? What visual artefact would appear if you used `scaleX` for both axes instead?"
- "What is `Infinity` as a JavaScript value? Why does `let minX = Infinity` work as an initial value for finding a minimum? What would happen if you used `0` instead?"

### React & Framework Specifics

- "Why is `useRef<HTMLCanvasElement>(null)` needed to access the `<canvas>` DOM element from inside a React component? What would happen if you tried to call `document.querySelector('canvas')` inside the render function instead?"
- "The `TemplatePreview` `useEffect` has `[template]` as its dependency array. When does this effect re-run? What would happen if the dependency array were empty (`[]`)?"
- "What is a private component in React? `TemplatePreview` is defined in the same file as `StarterTemplatesModal` but not exported. What are the benefits of keeping it private, and when would you decide to extract and export it?"
- "Why does `loadTemplate` use `useCallback` with `[nodes, edges, onNodesChange, onEdgesChange, reactFlow]` as dependencies? What is a stale closure, and how would skipping the dependency array cause `loadTemplate` to always clear the wrong set of nodes?"
- "What does `as const` do in TypeScript when used in `{ type: 'remove' as const, id: n.id }`? Why does TypeScript need this to narrow the `type` field to the literal string `'remove'` instead of the broader `string` type?"

### System Design & Architecture

- "What are the trade-offs of shipping a hard-coded template library versus a server-persisted one? In what situation would hard-coding be the right long-term choice rather than a temporary shortcut?"
- "Template import routes through `onNodesChange`/`onEdgesChange`, which means it goes into the Liveblocks undo stack. What are the implications for a user who imports a template and then presses Cmd+Z? Is that the right behaviour?"
- "The CI/CD Pipeline template has 8 nodes. How would you design a 'template categories' system if the library grew to 50 templates? What data structure would you use, and how would you update the modal UI?"
- "If two collaborators open the template gallery at the same time and both click Import on different templates, what happens? Describe the sequence of Liveblocks Storage mutations and the final canvas state."
- "What would a 'user-saved templates' feature look like? Where would the data live, and how would you gate saving behind ownership? What would change in `CanvasTemplate` — would it need a `userId` field?"

### TypeScript & Data Structures

- "What does `extends Record<string, unknown>` mean in the `NodeData` interface? Why is this constraint required for React Flow node data types, and what would break if you removed it?"
- "Why are `CanvasNode` and `CanvasEdge` imported from `types/canvas.ts` for the template definitions? What would go wrong if you defined new local node/edge types in `starter-templates.ts` instead?"
- "What is `as const` on an array in TypeScript? How does it change the inferred type of `NODE_COLORS`? What does it mean for the type of `NODE_COLORS[0].fill` — is it `string` or a literal?"
- "The `makeNode` function has `shape: CanvasNode['data']['shape'] = 'rectangle'` as a parameter type. What is indexed access type syntax in TypeScript? How does it stay in sync with the `NodeShape` union automatically?"
- "What is a `Map<string, { x: number; y: number }>` in JavaScript? When would you prefer a `Map` over a plain object `Record<string, ...>` for a key-value lookup? What does `Map.prototype.get` return if the key doesn't exist?"

### CSS & Visual Design

- "The template cards use `rounded-2xl` while buttons use `rounded-xl`. What is the border-radius scale in this project, and what is the visual principle behind using different radii for containers versus interactive elements?"
- "The card grid is `grid grid-cols-2 gap-4`. What CSS properties do these Tailwind classes generate? How would you change the layout to a single column on mobile using responsive prefixes?"
- "The `<canvas>` element has `width={220} height={130}` as JSX props and also `className='w-full'` as a Tailwind class. What is the difference between the `width`/`height` HTML attributes and CSS width? Why are both needed for a sharp canvas rendering?"
- "What does `overflow-y-auto` do in CSS? What CSS property must the parent have for it to work? What is the difference between `auto` and `scroll` for `overflow-y`?"
- "The `<DialogContent>` has `max-w-2xl`. What pixel width does `2xl` correspond to in Tailwind's max-width scale? How would you increase the modal width to fit three template columns instead of two?"
