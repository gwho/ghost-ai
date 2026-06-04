import { NextRequest, NextResponse } from 'next/server'
import { put, get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { canvasJsonPath } = access.project
  if (!canvasJsonPath) {
    return NextResponse.json({ nodes: [], edges: [] })
  }

  try {
    const result = await get(canvasJsonPath, { access: 'private' })
    if (!result) return NextResponse.json({ nodes: [], edges: [] })
    const data = await new Response(result.stream).json()
    return NextResponse.json(data)
  } catch {
    // Legacy public blobs (stored before the access: 'private' change) will
    // throw here. Fall back to empty canvas — the next save will create a
    // private blob and recovery is seamless.
    return NextResponse.json({ nodes: [], edges: [] })
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

  const { nodes = [], edges = [] } = body

  const blob = await put(
    `canvas/${projectId}.json`,
    JSON.stringify({ nodes, edges }),
    { access: 'private', contentType: 'application/json', addRandomSuffix: false },
  )

  await prisma.project.update({
    where: { id: projectId },
    data: { canvasJsonPath: blob.url },
  })

  return NextResponse.json({ url: blob.url })
}
