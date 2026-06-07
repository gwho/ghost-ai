import { auth } from '@clerk/nextjs/server'
import { auth as triggerAuth } from '@trigger.dev/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const { runId } = body
  if (!runId) return NextResponse.json({ error: 'Missing runId' }, { status: 400 })

  const taskRun = await prisma.taskRun.findUnique({ where: { runId } })
  if (!taskRun || taskRun.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = await triggerAuth.createPublicToken({
    scopes: { read: { runs: [runId] } },
    expirationTime: '1h',
  })

  return NextResponse.json({ token })
}
