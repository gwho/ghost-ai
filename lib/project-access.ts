import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { Project } from '@/lib/generated/prisma'

export interface CurrentIdentity {
  userId: string
  email: string | undefined
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return { userId, email: user?.emailAddresses[0]?.emailAddress }
}

export async function getProjectAccess(
  projectId: string,
): Promise<{ project: Project; isOwner: boolean } | null> {
  const identity = await getCurrentIdentity()
  if (!identity) return null

  const { userId, email } = identity

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { collaborators: true },
  })

  if (!project) return null

  const isOwner = project.ownerId === userId
  const isCollaborator = email
    ? project.collaborators.some((c) => c.email === email)
    : false

  if (!isOwner && !isCollaborator) return null

  return { project, isOwner }
}
