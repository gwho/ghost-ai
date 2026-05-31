import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  authMock,
  currentUserMock,
  findManyProjectMock,
  findManyCollaboratorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  currentUserMock: vi.fn(),
  findManyProjectMock: vi.fn(),
  findManyCollaboratorMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: currentUserMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: findManyProjectMock,
    },
    projectCollaborator: {
      findMany: findManyCollaboratorMock,
    },
  },
}))

import { getEditorProjects } from '@/lib/project-data'

describe('getEditorProjects', () => {
  beforeEach(() => {
    authMock.mockReset()
    currentUserMock.mockReset()
    findManyProjectMock.mockReset()
    findManyCollaboratorMock.mockReset()
  })

  it('returns empty lists when unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null })

    await expect(getEditorProjects()).resolves.toEqual({ owned: [], shared: [] })
    expect(findManyProjectMock).not.toHaveBeenCalled()
    expect(findManyCollaboratorMock).not.toHaveBeenCalled()
  })

  it('returns owned and shared projects while deduplicating owned ids', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    })
    findManyProjectMock.mockResolvedValue([
      { id: 'p1', name: 'Owned One' },
      { id: 'p2', name: 'Owned Two' },
    ])
    findManyCollaboratorMock.mockResolvedValue([
      { project: { id: 'p2', name: 'Owned Two' } },
      { project: { id: 'p3', name: 'Shared Three' } },
    ])

    await expect(getEditorProjects()).resolves.toEqual({
      owned: [
        { id: 'p1', name: 'Owned One', isOwned: true },
        { id: 'p2', name: 'Owned Two', isOwned: true },
      ],
      shared: [{ id: 'p3', name: 'Shared Three', isOwned: false }],
    })

    expect(findManyProjectMock).toHaveBeenCalledWith({
      where: { ownerId: 'user_1' },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(findManyCollaboratorMock).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('skips shared lookup when the current user has no email', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    currentUserMock.mockResolvedValue({ emailAddresses: [] })
    findManyProjectMock.mockResolvedValue([{ id: 'p1', name: 'Owned One' }])

    await expect(getEditorProjects()).resolves.toEqual({
      owned: [{ id: 'p1', name: 'Owned One', isOwned: true }],
      shared: [],
    })

    expect(findManyCollaboratorMock).not.toHaveBeenCalled()
  })
})
