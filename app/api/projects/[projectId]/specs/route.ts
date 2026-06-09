import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const specs = await prisma.projectSpec.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, filePath: true, createdAt: true },
  })

  return NextResponse.json({ specs })
}
