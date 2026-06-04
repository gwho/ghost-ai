import { NextRequest, NextResponse } from 'next/server'
import { put, get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'

function isValidNode(n: unknown): boolean {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return false
  const node = n as Record<string, unknown>
  if (typeof node.id !== 'string' || !node.id) return false
  if (typeof node.type !== 'string') return false
  if (!node.position || typeof node.position !== 'object' || Array.isArray(node.position)) return false
  const pos = node.position as Record<string, unknown>
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return false
  if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) return false
  const data = node.data as Record<string, unknown>
  if (typeof data.label !== 'string') return false
  return true
}

function isValidEdge(e: unknown): boolean {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  const edge = e as Record<string, unknown>
  if (typeof edge.id !== 'string' || !edge.id) return false
  if (typeof edge.source !== 'string' || !edge.source) return false
  if (typeof edge.target !== 'string' || !edge.target) return false
  return true
}

type Params = { params: Promise<{ projectId: string }> }

const MAX_CANVAS_PAYLOAD_BYTES = 1_000_000

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCanvasPayload(
  value: unknown,
): { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] } | null {
  if (!isJsonRecord(value)) return null

  const { nodes, edges } = value
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  if (!nodes.every(isJsonRecord) || !edges.every(isJsonRecord)) return null

  return { nodes, edges }
}

async function readCanvasBlob(canvasJsonPath: string) {
  try {
    const result = await get(canvasJsonPath, { access: 'private' })
    if (!result) return null
    return await new Response(result.stream).json()
  } catch (privateError) {
    try {
      const legacyResponse = await fetch(canvasJsonPath, { cache: 'no-store' })
      if (!legacyResponse.ok) {
        throw new Error(`Legacy canvas fetch failed with status ${legacyResponse.status}`)
      }

      return await legacyResponse.json()
    } catch (legacyError) {
      console.error('[canvas-route] Failed to load canvas blob', privateError)
      console.error('[canvas-route] Failed legacy canvas fallback', legacyError)
      throw new Error('Failed to load saved canvas')
    }
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { canvasJsonPath } = access.project
  if (!canvasJsonPath) {
    return NextResponse.json({ nodes: [], edges: [] })
  }

  try {
    const payload = await readCanvasBlob(canvasJsonPath)
    if (!payload) return NextResponse.json({ nodes: [], edges: [] })

    const parsed = parseCanvasPayload(payload)
    if (!parsed) {
      throw new Error('Saved canvas payload is invalid')
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to load saved canvas' }, { status: 503 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const payload = parseCanvasPayload(body)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid canvas payload' }, { status: 400 })
  }

  const serialized = JSON.stringify(payload)
  if (new TextEncoder().encode(serialized).length > MAX_CANVAS_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Canvas payload is too large' }, { status: 413 })
  }

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return NextResponse.json(
      { error: 'nodes and edges must be arrays' },
      { status: 400 },
    )
  }

  if (!nodes.every(isValidNode)) {
    return NextResponse.json(
      {
        error:
          'Invalid node: each node requires id (string), type (string), position ({x: number, y: number}), and data.label (string)',
      },
      { status: 400 },
    )
  }

  if (!edges.every(isValidEdge)) {
    return NextResponse.json(
      {
        error:
          'Invalid edge: each edge requires id, source, and target as non-empty strings',
      },
      { status: 400 },
    )
  }

  const blob = await put(
    `canvas/${projectId}.json`,
    serialized,
    { access: 'private', contentType: 'application/json', addRandomSuffix: false },
  )

  await prisma.project.update({
    where: { id: projectId },
    data: { canvasJsonPath: blob.url },
  })

  return NextResponse.json({ url: blob.url })
}
