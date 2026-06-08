# Fix: Issue 3 — Node Connection Handles

## What Was Broken

Nodes could only be connected starting from certain handles. The top and left handles
appeared to not respond when the user tried to drag a connection from them.

---

## Root Cause

The `HANDLES` constant in `components/editor/canvas-node.tsx` assigned different
`type` values to the four handles:

```tsx
<Handle type="target" position={Position.Top} />     // ← can only RECEIVE
<Handle type="target" position={Position.Left} />    // ← can only RECEIVE
<Handle type="source" position={Position.Bottom} />  // ← can only INITIATE
<Handle type="source" position={Position.Right} />   // ← can only INITIATE
```

In React Flow, a `type="target"` handle is a **passive endpoint** — you can drop
connections onto it, but you cannot initiate a drag from it. Only `type="source"`
handles can be dragged to start a new edge.

Although the ReactFlow component has `connectionMode={ConnectionMode.Loose}` (which
lets source handles connect to other source handles), this only affects what you can
CONNECT TO. It does not change which handles can START a connection.

Result: users could only begin connections from Bottom and Right. Top and Left
appeared dead.

---

## The Fix

Change all four handles to `type="source"` and add explicit IDs:

```tsx
const HANDLES = (
  <>
    <Handle type="source" position={Position.Top}    id="top"    />
    <Handle type="source" position={Position.Right}  id="right"  />
    <Handle type="source" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Left}   id="left"   />
  </>
)
```

With `ConnectionMode.Loose` already enabled on the ReactFlow component, source
handles can connect to any other handle (source or target) on any node. All four
handles now work bidirectionally.

IDs were added so that edges know which specific handle they originate from and
terminate at — useful for multi-handle nodes and edge routing.

---

## The Reusable Lesson

**In React Flow, `type` controls direction, not just appearance.**

| type | Can initiate drag? | Can receive drop? |
|---|---|---|
| `"source"` | ✓ yes | ✓ yes (with Loose mode) |
| `"target"` | ✗ no | ✓ yes |

If you want all handles to be fully interactive — both start AND receive connections
— make them all `type="source"` and set `connectionMode={ConnectionMode.Loose}` on
the ReactFlow component.

`ConnectionMode.Loose` is what allows source→source connections (so two "output"
handles can still connect). Without it, source handles could only connect to target
handles, which would require a strict directional graph.

---

## AI Discussion Topics

**1. When should you use directional vs bidirectional handles?**
Directed graphs (like data pipelines or flowcharts) use `source`→`target` semantics
to enforce flow direction. Undirected or relational graphs (like system architecture
diagrams) benefit from bidirectional handles. What modeling trade-offs does each
approach introduce when storing edges in a database?

**2. What does `ConnectionMode.Loose` actually allow?**
With Loose mode, the constraint that edges must go from source to target is lifted —
source-to-source and target-to-target edges are valid. How would you validate edge
direction in the application layer if you needed to enforce it for some node types
but not others?

**3. Why do explicit handle IDs matter?**
Without explicit IDs, React Flow auto-generates handle IDs based on position and
type. If you later add a second handle at the same position, ID collisions can
cause edges to misattribute their endpoints. When should you always use explicit IDs?

**4. Liveblocks + React Flow edge state**
The `onConnect` handler from `useLiveblocksFlow` creates edges that sync in
real-time. How does the edge object store `sourceHandle` and `targetHandle`? What
happens if one collaborator renames a handle ID after edges already reference it?
