import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string; collaboratorId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId, collaboratorId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!access.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const collaborator = await prisma.projectCollaborator.findFirst({
    where: { id: collaboratorId, projectId },
  })
  if (!collaborator) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.projectCollaborator.delete({ where: { id: collaboratorId } })

  return new NextResponse(null, { status: 204 })
}
