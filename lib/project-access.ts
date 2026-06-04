import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { Project } from '@/lib/generated/prisma'
import { isTransientUpstreamError } from '@/lib/upstream-errors'

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientUpstreamError(err)) throw err
    await new Promise((r) => setTimeout(r, 300))
    return fn()
  }
}

export interface CurrentIdentity {
  userId: string
  email: string | undefined
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  const primaryAddr = user?.emailAddresses.find(
    (ea) => ea.id === user.primaryEmailAddressId,
  )
  const email = (primaryAddr ?? user?.emailAddresses[0])?.emailAddress?.toLowerCase()
  return { userId, email }
}

export async function getProjectAccess(
  projectId: string,
  knownIdentity?: CurrentIdentity,
): Promise<{ project: Project; isOwner: boolean } | null> {
  const identity = knownIdentity ?? (await getCurrentIdentity())
  if (!identity) return null

  const { userId, email } = identity

  const project = await withRetry(() =>
    prisma.project.findUnique({
      where: { id: projectId },
      include: { collaborators: true },
    }),
  )

  if (!project) return null

  const isOwner = project.ownerId === userId
  const isCollaborator = email
    ? project.collaborators.some((c) => c.email?.toLowerCase() === email)
    : false

  if (!isOwner && !isCollaborator) return null

  return { project, isOwner }
}
