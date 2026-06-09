import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export type ProjectItem = {
  id: string
  name: string
  isOwned: boolean
}

export async function getEditorProjects(): Promise<{
  owned: ProjectItem[]
  shared: ProjectItem[]
}> {
  const { userId } = await auth()
  if (!userId) return { owned: [], shared: [] }

  const [user, ownedRaw] = await Promise.all([
    currentUser(),
    prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const primaryAddr = user?.emailAddresses.find(
    (ea) => ea.id === user.primaryEmailAddressId,
  )
  const email = (primaryAddr ?? user?.emailAddresses[0])?.emailAddress?.toLowerCase()

  const sharedRaw = email
    ? await prisma.projectCollaborator.findMany({
        where: { email },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const ownedIds = new Set(ownedRaw.map((p) => p.id))

  return {
    owned: ownedRaw.map((p) => ({ ...p, isOwned: true as const })),
    shared: sharedRaw
      .filter((pc) => !ownedIds.has(pc.project.id))
      .map((pc) => ({ ...pc.project, isOwned: false as const })),
  }
}
