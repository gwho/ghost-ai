import { task } from '@trigger.dev/sdk'
import { generateText, tool, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { mutateFlow } from '@liveblocks/react-flow/node'
import { getLiveblocksClient } from '@/lib/liveblocks'
import type { CanvasNode, CanvasEdge } from '@/types/canvas'

const NODE_COLOR_FILLS = [
  '#1F1F1F',
  '#10233D',
  '#2E1938',
  '#331B00',
  '#3C1618',
  '#3A1726',
  '#0F2E18',
  '#062822',
] as const

type NodeColorFill = (typeof NODE_COLOR_FILLS)[number]

const SYSTEM_PROMPT = `You are an expert software architecture designer. Build a visual system architecture diagram by calling the provided tools in sequence.

Rules for nodes:
- Each node represents a service, database, queue, gateway, or component in the system
- Use shapes to convey meaning:
  - rectangle: API services, backends, microservices
  - cylinder: databases, caches, storage
  - hexagon: message queues, event buses, brokers
  - diamond: API gateways, load balancers, routing decisions
  - circle: external systems, users, clients
  - pill: utilities, helpers, background workers
- Assign different colors to visually group related components — use a distinct color per logical tier or domain
- Allowed fill colors: ${NODE_COLOR_FILLS.join(', ')}
- Generate between 4 and 12 nodes
- Label each node with a short, clear name (max 30 characters)
- Node IDs must be unique kebab-case slugs, e.g. "api-gateway", "user-db"
- Start x positions from 100, y positions from 100
- Space nodes at least 180px apart horizontally, 150px apart vertically
- Default width: 160, default height: 60 (cylinders/hexagons can use 100x80)
- Lay out the diagram left-to-right or top-to-bottom in logical data flow order

Rules for edges:
- Connect nodes that communicate directly
- Edge IDs must be unique strings, e.g. "e-api-gateway-auth-service"
- Optional short label for the edge (protocol or relationship), max 20 chars, e.g. "HTTP", "gRPC", "publishes"
- Only add edges after both endpoint nodes have been added

Workflow:
1. Call addNode for every component first
2. Then call addEdge to connect them
3. Use moveNode to adjust positions if needed
Do NOT output JSON or prose — use only the provided tools.`

// ─── Per-action input schemas ───────────────────────────────────────────────

const AddNodeSchema = z.object({
  id: z.string().describe('Unique kebab-case node ID, e.g. "api-gateway"'),
  x: z.number().describe('X coordinate, starting from 100, spaced 180+ apart'),
  y: z.number().describe('Y coordinate, starting from 100, spaced 150+ apart'),
  label: z.string().max(30).describe('Short display name'),
  shape: z.enum(['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon']),
  color: z
    .string()
    .describe(`Fill color — must be one of: ${NODE_COLOR_FILLS.join(', ')}`),
  width: z.number().min(80).optional().describe('Node width in px, default 160'),
  height: z.number().min(40).optional().describe('Node height in px, default 60'),
})

const AddEdgeSchema = z.object({
  id: z.string().describe('Unique edge ID, e.g. "e-api-gateway-user-db"'),
  source: z.string().describe('Source node ID (must already be added)'),
  target: z.string().describe('Target node ID (must already be added)'),
  label: z
    .string()
    .max(20)
    .optional()
    .describe('Optional relationship label, e.g. "HTTP", "gRPC", "publishes"'),
})

const MoveNodeSchema = z.object({
  id: z.string().describe('Node ID to move'),
  x: z.number().describe('New X coordinate'),
  y: z.number().describe('New Y coordinate'),
})

const ResizeNodeSchema = z.object({
  id: z.string().describe('Node ID to resize'),
  width: z.number().min(80).describe('New width in px'),
  height: z.number().min(40).describe('New height in px'),
})

const UpdateNodeSchema = z.object({
  id: z.string().describe('Node ID to update'),
  label: z.string().max(30).optional().describe('New label'),
  color: z.string().optional().describe('New fill color from the allowed palette'),
})

const DeleteNodeSchema = z.object({
  id: z.string().describe('Node ID to delete'),
})

const DeleteEdgeSchema = z.object({
  id: z.string().describe('Edge ID to delete'),
})

// ─── Tool definitions ────────────────────────────────────────────────────────

const canvasTools = {
  addNode: tool({
    description: 'Add a new node to the canvas',
    inputSchema: AddNodeSchema,
    execute: async () => ({ ok: true }),
  }),
  addEdge: tool({
    description: 'Add a directed edge between two already-added nodes',
    inputSchema: AddEdgeSchema,
    execute: async () => ({ ok: true }),
  }),
  moveNode: tool({
    description: 'Move an existing node to a new position',
    inputSchema: MoveNodeSchema,
    execute: async () => ({ ok: true }),
  }),
  resizeNode: tool({
    description: 'Resize an existing node',
    inputSchema: ResizeNodeSchema,
    execute: async () => ({ ok: true }),
  }),
  updateNode: tool({
    description: 'Update the label or color of an existing node',
    inputSchema: UpdateNodeSchema,
    execute: async () => ({ ok: true }),
  }),
  deleteNode: tool({
    description: 'Delete a node and all its connected edges',
    inputSchema: DeleteNodeSchema,
    execute: async () => ({ ok: true }),
  }),
  deleteEdge: tool({
    description: 'Delete an edge by ID',
    inputSchema: DeleteEdgeSchema,
    execute: async () => ({ ok: true }),
  }),
}

// ─── Validation helper ───────────────────────────────────────────────────────

type RawCall = { toolName: string; input: Record<string, unknown> }

function validateAction(
  call: RawCall,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
): { valid: boolean; reason: string } {
  const id = call.input.id as string
  if (call.toolName === 'addNode') {
    if (nodeIds.has(id)) return { valid: false, reason: `duplicate node id "${id}"` }
    const color = call.input.color as string
    if (!NODE_COLOR_FILLS.includes(color as NodeColorFill))
      return { valid: false, reason: `invalid color "${color}" for node "${id}"` }
    return { valid: true, reason: '' }
  }
  if (call.toolName === 'addEdge') {
    if (edgeIds.has(id)) return { valid: false, reason: `duplicate edge id "${id}"` }
    const source = call.input.source as string
    const target = call.input.target as string
    if (!nodeIds.has(source))
      return { valid: false, reason: `dangling edge "${id}": source "${source}" not found` }
    if (!nodeIds.has(target))
      return { valid: false, reason: `dangling edge "${id}": target "${target}" not found` }
    return { valid: true, reason: '' }
  }
  if (
    call.toolName === 'moveNode' ||
    call.toolName === 'resizeNode' ||
    call.toolName === 'updateNode' ||
    call.toolName === 'deleteNode'
  ) {
    if (!nodeIds.has(id))
      return { valid: false, reason: `${call.toolName}: node "${id}" not found` }
    return { valid: true, reason: '' }
  }
  if (call.toolName === 'deleteEdge') {
    if (!edgeIds.has(id))
      return { valid: false, reason: `deleteEdge: edge "${id}" not found` }
    return { valid: true, reason: '' }
  }
  return { valid: true, reason: '' }
}

// ─── Task ────────────────────────────────────────────────────────────────────

export const designAgent = task({
  id: 'design-agent',
  retry: { maxAttempts: 2 },
  run: async (payload: { prompt: string; roomId: string }) => {
    const { prompt, roomId } = payload
    const liveblocks = getLiveblocksClient()

    const broadcast = (status: 'start' | 'processing' | 'complete' | 'error', message: string) =>
      liveblocks.broadcastEvent(roomId, { type: 'ai-status', status, message })

    try {
      await broadcast('start', 'Gemini is reading your prompt…')

      const result = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: SYSTEM_PROMPT,
        prompt,
        tools: canvasTools,
        toolChoice: 'auto',
        stopWhen: stepCountIs(10),
      })

      await broadcast('processing', 'Updating canvas…')

      // Collect all tool calls across all steps
      const allCalls = result.steps.flatMap((step) => step.toolCalls) as RawCall[]

      // Process actions sequentially with in-memory validation state
      const nodeIds = new Set<string>()
      const edgeIds = new Set<string>()
      const nodeMap = new Map<string, CanvasNode>()
      const edgeList: CanvasEdge[] = []

      for (const call of allCalls) {
        const { valid, reason } = validateAction(call, nodeIds, edgeIds)
        if (!valid) {
          console.warn(`[design-agent] skipping invalid action ${call.toolName}: ${reason}`)
          continue
        }

        if (call.toolName === 'addNode') {
          const i = call.input as z.infer<typeof AddNodeSchema>
          const node: CanvasNode = {
            id: i.id,
            type: 'canvasNode',
            position: { x: i.x, y: i.y },
            data: { label: i.label, shape: i.shape, color: i.color },
            width: i.width ?? 160,
            height: i.height ?? 60,
          }
          nodeMap.set(i.id, node)
          nodeIds.add(i.id)
        } else if (call.toolName === 'addEdge') {
          const i = call.input as z.infer<typeof AddEdgeSchema>
          const edge: CanvasEdge = {
            id: i.id,
            type: 'canvasEdge',
            source: i.source,
            target: i.target,
            data: { label: i.label },
          }
          edgeList.push(edge)
          edgeIds.add(i.id)
        } else if (call.toolName === 'moveNode') {
          const i = call.input as z.infer<typeof MoveNodeSchema>
          const n = nodeMap.get(i.id)!
          nodeMap.set(i.id, { ...n, position: { x: i.x, y: i.y } })
        } else if (call.toolName === 'resizeNode') {
          const i = call.input as z.infer<typeof ResizeNodeSchema>
          const n = nodeMap.get(i.id)!
          nodeMap.set(i.id, { ...n, width: i.width, height: i.height })
        } else if (call.toolName === 'updateNode') {
          const i = call.input as z.infer<typeof UpdateNodeSchema>
          const n = nodeMap.get(i.id)!
          nodeMap.set(i.id, {
            ...n,
            data: {
              ...n.data,
              ...(i.label !== undefined && { label: i.label }),
              ...(i.color !== undefined && { color: i.color }),
            },
          })
        } else if (call.toolName === 'deleteNode') {
          const i = call.input as z.infer<typeof DeleteNodeSchema>
          nodeMap.delete(i.id)
          nodeIds.delete(i.id)
          // Remove all edges that reference this node
          for (let j = edgeList.length - 1; j >= 0; j--) {
            if (edgeList[j].source === i.id || edgeList[j].target === i.id) {
              edgeIds.delete(edgeList[j].id)
              edgeList.splice(j, 1)
            }
          }
        } else if (call.toolName === 'deleteEdge') {
          const i = call.input as z.infer<typeof DeleteEdgeSchema>
          const idx = edgeList.findIndex((e) => e.id === i.id)
          if (idx >= 0) {
            edgeIds.delete(edgeList[idx].id)
            edgeList.splice(idx, 1)
          }
        }
      }

      const nodes = Array.from(nodeMap.values())
      // Final safety filter: remove any edges whose endpoints were deleted after being added
      const edges = edgeList.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

      await mutateFlow<CanvasNode, CanvasEdge>({ client: liveblocks, roomId }, (flow) => {
        flow.removeNodes(flow.nodes.map((n) => n.id))
        flow.removeEdges(flow.edges.map((e) => e.id))
        flow.addNodes(nodes)
        flow.addEdges(edges)
      })

      const msg = `Design complete — ${nodes.length} node${nodes.length === 1 ? '' : 's'} added.`
      await broadcast('complete', msg)

      return { status: 'complete', nodeCount: nodes.length, edgeCount: edges.length }
    } catch (err) {
      await broadcast('error', 'Something went wrong — canvas unchanged.')
      throw err
    }
  },
})
