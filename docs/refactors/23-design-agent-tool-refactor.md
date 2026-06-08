# Refactor: Design Agent — generateObject → generateText + Tools

## What Changed

`trigger/design-agent.ts` was rewritten to use `generateText` with per-action tool definitions instead of `generateObject` with a single schema.

**Before:** One `generateObject` call → model returns the entire canvas as a JSON blob → apply it all at once.

**After:** `generateText` with 7 tools → model calls tools one by one to build the canvas → validate and apply each action sequentially.

---

## Why

### 1. Single-shot generation is fragile

With `generateObject`, if the model generates 10 nodes and one has a malformed color, the whole schema validation fails and nothing gets written to the canvas. The user sees an error even though most of the design was valid.

With tools, each action is validated independently. Bad actions are skipped with a warning; everything else still applies.

### 2. No action vocabulary

`generateObject` produces a final state — a snapshot of nodes and edges. It has no concept of "move node A to the right" or "delete the old edge." Future features like iterative refinement ("now add a cache layer") would need a full redesign.

The tool approach gives the model a real action vocabulary from day one: `addNode`, `addEdge`, `moveNode`, `resizeNode`, `updateNode`, `deleteNode`, `deleteEdge`. Iteration is a natural extension.

### 3. Better error locality

When validation fails (dangling edge, duplicate ID), the warning log now names the specific action and the reason:
```
[design-agent] skipping invalid action addEdge: dangling edge "e-auth-cache": target "cache" not found
```
This is far easier to debug than a whole-schema parse error.

---

## How It Works Now

### Tools

Seven tools are defined, each with its own zod `inputSchema`:

| Tool | Purpose |
|---|---|
| `addNode` | Place a new node on the canvas |
| `addEdge` | Connect two existing nodes |
| `moveNode` | Reposition a node |
| `resizeNode` | Change a node's dimensions |
| `updateNode` | Change a node's label or color |
| `deleteNode` | Remove a node and all its edges |
| `deleteEdge` | Remove a specific edge |

Each `execute` function is a lightweight stub — it just returns `{ ok: true }`. The actual canvas work happens in the post-processing step, not inside the tool.

### generateText call

```ts
const result = await generateText({
  model: google('gemini-2.5-flash-lite'),
  system: SYSTEM_PROMPT,
  prompt,
  tools: canvasTools,
  toolChoice: 'auto',
  stopWhen: stepCountIs(10),
})
```

`stopWhen: stepCountIs(10)` allows up to 10 rounds of tool calls. In practice a 4–12 node diagram fits in 1–3 rounds.

### Action processing

All tool calls are collected from all steps:
```ts
const allCalls = result.steps.flatMap((step) => step.toolCalls) as RawCall[]
```

Then processed in order with in-memory state:
- `nodeIds: Set<string>` — tracks which nodes exist (guards dangling edges)
- `nodeMap: Map<string, CanvasNode>` — mutable node state (supports move/resize/update/delete)
- `edgeList: CanvasEdge[]` — accumulated edges
- `edgeIds: Set<string>` — guards duplicate IDs

### Validation rules

| Action | Skipped when |
|---|---|
| `addNode` | Duplicate ID, or color not in allowed palette |
| `addEdge` | Duplicate ID, or source/target node doesn't exist yet |
| `moveNode` / `resizeNode` / `updateNode` / `deleteNode` | Node doesn't exist |
| `deleteEdge` | Edge doesn't exist |

A final safety filter removes any edges whose endpoints were deleted after the edge was added.

---

## AI SDK v6 Note

This project uses `ai@6.0.197`. The v6 API differs from examples in CLAUDE.md (which show older v3/v4):
- `tool()` uses `inputSchema` not `parameters`
- Tool call results use `.input` not `.args`
- `stopWhen: stepCountIs(n)` replaces `maxSteps` (not available in v6)
