import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getProjectAccessMock,
  getCurrentIdentityMock,
  findManyMock,
  findUniqueMock,
  createMock,
  clerkClientMock,
  getUserListMock,
} = vi.hoisted(() => ({
  getProjectAccessMock: vi.fn(),
  getCurrentIdentityMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  clerkClientMock: vi.fn(),
  getUserListMock: vi.fn(),
}))

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: getProjectAccessMock,
  getCurrentIdentity: getCurrentIdentityMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectCollaborator: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      create: createMock,
    },
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: clerkClientMock,
}))

import { GET, POST } from '@/app/api/projects/[projectId]/collaborators/route'

const params = Promise.resolve({ projectId: 'project_1' })

describe('project collaborators route handlers', () => {
  beforeEach(() => {
    getProjectAccessMock.mockReset()
    getCurrentIdentityMock.mockReset()
    findManyMock.mockReset()
    findUniqueMock.mockReset()
    createMock.mockReset()
    clerkClientMock.mockReset()
    getUserListMock.mockReset()

    clerkClientMock.mockResolvedValue({
      users: {
        getUserList: getUserListMock,
      },
    })
  })

  it('GET returns 401 when access is denied', async () => {
    getProjectAccessMock.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost') as any, { params })

    expect(response.status).toBe(401)
  })

  it('GET returns collaborators enriched with clerk profile data', async () => {
    getProjectAccessMock.mockResolvedValue({ project: { id: 'project_1' }, isOwner: true })
    findManyMock.mockResolvedValue([
      { id: 'c1', email: 'a@example.com' },
      { id: 'c2', email: 'b@example.com' },
    ])
    getUserListMock.mockResolvedValue({
      data: [
        {
          firstName: 'Alex',
          lastName: 'Owner',
          imageUrl: 'https://avatar',
          emailAddresses: [{ emailAddress: 'a@example.com' }],
        },
      ],
    })

    const response = await GET(new Request('http://localhost') as any, { params })

    expect(getUserListMock).toHaveBeenCalledWith({ emailAddress: ['a@example.com', 'b@example.com'] })
    await expect(response.json()).resolves.toEqual([
      {
        id: 'c1',
        email: 'a@example.com',
        name: 'Alex Owner',
        avatarUrl: 'https://avatar',
      },
      {
        id: 'c2',
        email: 'b@example.com',
      },
    ])
  })

  it('POST enforces access and owner checks', async () => {
    getProjectAccessMock.mockResolvedValueOnce(null)
    const unauthorized = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'a@example.com' }) }) as any,
      { params },
    )
    expect(unauthorized.status).toBe(401)

    getProjectAccessMock.mockResolvedValueOnce({ project: { id: 'project_1' }, isOwner: false })
    const forbidden = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'a@example.com' }) }) as any,
      { params },
    )
    expect(forbidden.status).toBe(403)
  })

  it('POST validates malformed or invalid emails', async () => {
    getProjectAccessMock.mockResolvedValue({ project: { id: 'project_1' }, isOwner: true })

    const malformed = await POST(
      new Request('http://localhost', { method: 'POST', body: '{' }) as any,
      { params },
    )
    expect(malformed.status).toBe(400)

    const invalid = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'nope' }) }) as any,
      { params },
    )
    expect(invalid.status).toBe(400)
  })

  it('POST prevents inviting current owner', async () => {
    getProjectAccessMock.mockResolvedValue({ project: { id: 'project_1' }, isOwner: true })
    getCurrentIdentityMock.mockResolvedValue({ userId: 'owner_1', email: 'Owner@Example.com' })

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: ' owner@example.com ' }),
      }) as any,
      { params },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'You are already the owner of this project',
    })
  })

  it('POST returns 409 when collaborator already exists', async () => {
    getProjectAccessMock.mockResolvedValue({ project: { id: 'project_1' }, isOwner: true })
    getCurrentIdentityMock.mockResolvedValue({ userId: 'owner_1', email: 'owner@example.com' })
    findUniqueMock.mockResolvedValue({ id: 'c1', email: 'a@example.com' })

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@example.com' }),
      }) as any,
      { params },
    )

    expect(response.status).toBe(409)
  })

  it('POST creates collaborator, normalizes email, and enriches result', async () => {
    getProjectAccessMock.mockResolvedValue({ project: { id: 'project_1' }, isOwner: true })
    getCurrentIdentityMock.mockResolvedValue({ userId: 'owner_1', email: 'owner@example.com' })
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: 'c1', email: 'new@example.com' })
    getUserListMock.mockResolvedValue({
      data: [
        {
          firstName: 'New',
          lastName: 'User',
          imageUrl: 'https://avatar/new',
          emailAddresses: [{ emailAddress: 'new@example.com' }],
        },
      ],
    })

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: ' New@Example.com ' }),
      }) as any,
      { params },
    )

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { projectId_email: { projectId: 'project_1', email: 'new@example.com' } },
    })
    expect(createMock).toHaveBeenCalledWith({
      data: { projectId: 'project_1', email: 'new@example.com' },
    })
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      id: 'c1',
      email: 'new@example.com',
      name: 'New User',
      avatarUrl: 'https://avatar/new',
    })
  })
})
