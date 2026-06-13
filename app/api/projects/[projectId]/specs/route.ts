import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentIdentity, getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const identity = await getCurrentIdentity()
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getProjectAccess(projectId, identity)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let specs
  try {
    specs = await prisma.projectSpec.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, filePath: true, createdAt: true },
    })
  } catch (error) {
    console.error('[specs] failed to load specs', error)
    return NextResponse.json({ error: 'Failed to load specs' }, { status: 500 })
  }

  return NextResponse.json({ specs })
}
