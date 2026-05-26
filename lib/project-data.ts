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

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress

  const [ownedRaw, sharedRaw] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
    email
      ? prisma.projectCollaborator.findMany({
          where: { email },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  const ownedIds = new Set(ownedRaw.map((p) => p.id))

  return {
    owned: ownedRaw.map((p) => ({ ...p, isOwned: true as const })),
    shared: sharedRaw
      .filter((pc) => !ownedIds.has(pc.project.id))
      .map((pc) => ({ ...pc.project, isOwned: false as const })),
  }
}
