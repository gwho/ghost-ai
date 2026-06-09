import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tasks } from '@trigger.dev/sdk'
import type { generateSpec } from '@/trigger/generate-spec'
import { getProjectAccess } from '@/lib/project-access'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }

  const { roomId, chatHistory, nodes, edges } = body as Record<string, unknown>

  if (!roomId || typeof roomId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid roomId' }, { status: 400 })
  }

  if (!Array.isArray(chatHistory)) {
    return NextResponse.json({ error: 'chatHistory must be an array' }, { status: 400 })
  }

  if (!Array.isArray(nodes)) {
    return NextResponse.json({ error: 'nodes must be an array' }, { status: 400 })
  }

  if (!Array.isArray(edges)) {
    return NextResponse.json({ error: 'edges must be an array' }, { status: 400 })
  }

  // roomId IS the projectId in this system — never trust a client-supplied projectId
  const access = await getProjectAccess(roomId)
  if (!access) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let handle
  try {
    handle = await tasks.trigger<typeof generateSpec>('generate-spec', {
      projectId: roomId,
      roomId,
      chatHistory,
      nodes,
      edges,
    })
  } catch (error) {
    console.error('[ai-spec] failed to trigger generate-spec', error)
    return NextResponse.json({ error: 'Failed to start spec run' }, { status: 502 })
  }

  try {
    await prisma.taskRun.create({
      data: { runId: handle.id, projectId: roomId, userId },
    })
  } catch (error) {
    console.error('[ai-spec] spec run started but TaskRun persistence failed', error)
    return NextResponse.json({ runId: handle.id, trackingUnavailable: true }, { status: 202 })
  }

  return NextResponse.json({ runId: handle.id }, { status: 201 })
}
