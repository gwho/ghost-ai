import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ projectId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await params

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Invalid or missing project name' }, { status: 400 })
  }

  const sanitizedName = body.name.trim()
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { name: sanitizedName },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await params

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.project.delete({ where: { id: projectId } })

  return new NextResponse(null, { status: 204 })
}
