# Tutorial: React Flow Handles — source, target, and ConnectionMode

## What You'll Learn

- What handles are and how they work in React Flow
- The difference between `type="source"` and `type="target"`
- What `ConnectionMode.Loose` changes
- How to give handles explicit IDs and why it matters
- When to use directional vs. bidirectional connections

---

## Part 1: What Is a Handle?

In React Flow, a **handle** is the small dot on the edge of a node that users click
and drag to create connections (edges) between nodes.

Each handle is declared with the `Handle` component from `@xyflow/react`:

```tsx
import { Handle, Position } from '@xyflow/react'

// Inside your custom node component:
<Handle type="source" position={Position.Bottom} />
```

`position` controls WHERE on the node the handle appears: `Top`, `Right`, `Bottom`,
or `Left`.

`type` controls what the handle can DO.

---

## Part 2: source vs. target

React Flow handles have two types:

| `type` | Role | Can initiate drag? | Can receive drop? |
|---|---|---|---|
| `"source"` | Output / from | ✓ yes | ✗ no (in strict mode) |
| `"target"` | Input / to | ✗ no | ✓ yes |

**source handles** are the "from" end — you click and drag on them to start drawing
a new edge. Think of them like the "output" port.

**target handles** are the "to" end — you drop an edge onto them to complete the
connection. Think of them like the "input" port.

A typical directed-graph node has source handles at the bottom/right and target
handles at the top/left, reflecting a top-down or left-to-right flow.

---

## Part 3: The Problem with Directional Handles

If your graph is a **relational diagram** (like a system architecture) rather than a
**directed pipeline** (like a flowchart), strict source/target semantics get in the
way. Users want to connect ANY node to ANY other node from ANY side.

With the default setup, a user who tries to drag from a `type="target"` handle will
find that nothing happens. The cursor doesn't change, the drag doesn't start.

---

## Part 4: ConnectionMode.Loose

`ConnectionMode.Loose` is a setting on the `<ReactFlow>` component:

```tsx
import { ConnectionMode } from '@xyflow/react'

<ReactFlow
  connectionMode={ConnectionMode.Loose}
  ...
>
```

With Loose mode enabled, **source handles can connect to other source handles** (not
just target handles). This removes the strict "must go from output to input" rule.

However, Loose mode does NOT change which handles can INITIATE a drag. Only
`type="source"` handles can be dragged to start a connection.

**To make every handle fully interactive in both directions:**
```tsx
// Make ALL handles type="source"
// ConnectionMode.Loose allows source → source connections
const HANDLES = (
  <>
    <Handle type="source" position={Position.Top}    id="top"    />
    <Handle type="source" position={Position.Right}  id="right"  />
    <Handle type="source" position={Position.Bottom} id="bottom" />
    <Handle type="source" position={Position.Left}   id="left"   />
  </>
)
```

Now any handle on any node can start a connection, and any handle can receive it.

---

## Part 5: Explicit Handle IDs

When a node has multiple handles, React Flow needs to know which specific handle an
edge starts or ends at. Without explicit IDs, React Flow auto-generates them — but
auto-generated IDs are fragile:

- They depend on the render order of Handle components
- Adding or reordering handles can silently reassign IDs
- Edges in storage reference old IDs that no longer match

Always give handles explicit IDs:

```tsx
<Handle type="source" position={Position.Top}    id="top"    />
<Handle type="source" position={Position.Right}  id="right"  />
<Handle type="source" position={Position.Bottom} id="bottom" />
<Handle type="source" position={Position.Left}   id="left"   />
```

Edge objects then store:
```json
{
  "source": "node-1",
  "sourceHandle": "right",
  "target": "node-2",
  "targetHandle": "left"
}
```

This survives re-renders, refactors, and storage/reload cycles.

---

## Part 6: When to Use Directional Handles

Use `type="source"` and `type="target"` with strict direction when:
- Your graph represents a **pipeline** (data flows one way)
- You want to prevent connections that violate the flow direction
- You need to visually distinguish inputs and outputs on a node

Use all-source handles with `ConnectionMode.Loose` when:
- Your graph represents a **relational diagram** (anything-to-anything)
- Connection direction doesn't have semantic meaning
- You want the simplest possible UX (any handle → any handle)

---

## Summary

```tsx
// Directional (pipeline) — strict
<Handle type="target" position={Position.Top}    id="input"  />
<Handle type="source" position={Position.Bottom} id="output" />
// + default ConnectionMode.Strict (or omit connectionMode)

// Bidirectional (diagram) — flexible
<Handle type="source" position={Position.Top}    id="top"    />
<Handle type="source" position={Position.Right}  id="right"  />
<Handle type="source" position={Position.Bottom} id="bottom" />
<Handle type="source" position={Position.Left}   id="left"   />
// + connectionMode={ConnectionMode.Loose}
```
