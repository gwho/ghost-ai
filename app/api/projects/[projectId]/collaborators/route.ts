import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getProjectAccess, getCurrentIdentity } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string }> }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CollaboratorItem {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

async function enrichWithClerk(emails: string[]): Promise<Map<string, { name?: string; avatarUrl?: string }>> {
  if (emails.length === 0) return new Map()
  const clerk = await clerkClient()
  const { data: users } = await clerk.users.getUserList({ emailAddress: emails })
  const map = new Map<string, { name?: string; avatarUrl?: string }>()
  for (const u of users) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || undefined
    const avatarUrl = u.imageUrl || undefined
    for (const ea of u.emailAddresses) {
      map.set(ea.emailAddress, { name, avatarUrl })
    }
  }
  return map
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.projectCollaborator.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })

  const clerkMap = await enrichWithClerk(rows.map((r) => r.email))

  const result: CollaboratorItem[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    ...clerkMap.get(r.email),
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!access.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const identity = await getCurrentIdentity()
  if (identity?.email && email === identity.email.toLowerCase()) {
    return NextResponse.json({ error: 'You are already the owner of this project' }, { status: 400 })
  }

  const existing = await prisma.projectCollaborator.findUnique({
    where: { projectId_email: { projectId, email } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already a collaborator' }, { status: 409 })
  }

  const row = await prisma.projectCollaborator.create({
    data: { projectId, email },
  })

  const clerkMap = await enrichWithClerk([email])
  const enriched: CollaboratorItem = {
    id: row.id,
    email: row.email,
    ...clerkMap.get(email),
  }

  return NextResponse.json(enriched, { status: 201 })
}
