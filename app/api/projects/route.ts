import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const name: string = (typeof body?.name === 'string' && body.name.trim()) || 'Untitled Project'

  const project = await prisma.project.create({
    data: { ownerId: userId, name },
  })

  return NextResponse.json(project, { status: 201 })
}
