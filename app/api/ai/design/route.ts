import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tasks } from '@trigger.dev/sdk'
import type { designAgent } from '@/trigger/design-agent'
import { getProjectAccess } from '@/lib/project-access'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const { prompt, roomId, projectId } = body
  if (!prompt || !roomId || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (
    typeof prompt !== 'string' ||
    typeof roomId !== 'string' ||
    typeof projectId !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request fields' }, { status: 400 })
  }

  const access = await getProjectAccess(projectId)
  if (!access || roomId !== projectId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let handle
  try {
    handle = await tasks.trigger<typeof designAgent>('design-agent', { prompt, roomId })
  } catch (error) {
    console.error('[ai-design] failed to trigger design-agent', error)
    return NextResponse.json({ error: 'Failed to start design run' }, { status: 502 })
  }

  try {
    await prisma.taskRun.create({
      data: { runId: handle.id, projectId, userId },
    })
  } catch (error) {
    console.error('[ai-design] design run started but TaskRun persistence failed', error)
    return NextResponse.json(
      { runId: handle.id, trackingUnavailable: true },
      { status: 202 },
    )
  }

  return NextResponse.json({ runId: handle.id }, { status: 201 })
}
