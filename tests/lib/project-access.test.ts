import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  authMock,
  currentUserMock,
  findUniqueMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  currentUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: currentUserMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: findUniqueMock,
    },
  },
}))

import { getCurrentIdentity, getProjectAccess } from '@/lib/project-access'

describe('getCurrentIdentity', () => {
  beforeEach(() => {
    authMock.mockReset()
    currentUserMock.mockReset()
  })

  it('returns null when user is unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null })

    await expect(getCurrentIdentity()).resolves.toBeNull()
    expect(currentUserMock).not.toHaveBeenCalled()
  })

  it('returns user id and primary email when authenticated', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
    })

    await expect(getCurrentIdentity()).resolves.toEqual({
      userId: 'user_1',
      email: 'owner@example.com',
    })
  })
})

describe('getProjectAccess', () => {
  beforeEach(() => {
    authMock.mockReset()
    currentUserMock.mockReset()
    findUniqueMock.mockReset()
  })

  it('returns null when identity is unavailable', async () => {
    authMock.mockResolvedValue({ userId: null })

    await expect(getProjectAccess('project_1')).resolves.toBeNull()
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('returns null when project does not exist', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
    })
    findUniqueMock.mockResolvedValue(null)

    await expect(getProjectAccess('project_1')).resolves.toBeNull()
  })

  it('returns project access for owners', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
    })
    const project = {
      id: 'project_1',
      ownerId: 'owner_1',
      collaborators: [],
    }
    findUniqueMock.mockResolvedValue(project)

    await expect(getProjectAccess('project_1')).resolves.toEqual({
      project,
      isOwner: true,
    })
  })

  it('returns project access for collaborators', async () => {
    authMock.mockResolvedValue({ userId: 'user_2' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'collab@example.com' }],
    })
    const project = {
      id: 'project_1',
      ownerId: 'owner_1',
      collaborators: [{ email: 'collab@example.com' }],
    }
    findUniqueMock.mockResolvedValue(project)

    await expect(getProjectAccess('project_1')).resolves.toEqual({
      project,
      isOwner: false,
    })
  })

  it('returns null when user is neither owner nor collaborator', async () => {
    authMock.mockResolvedValue({ userId: 'user_2' })
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    })
    findUniqueMock.mockResolvedValue({
      id: 'project_1',
      ownerId: 'owner_1',
      collaborators: [{ email: 'other@example.com' }],
    })

    await expect(getProjectAccess('project_1')).resolves.toBeNull()
  })
})
