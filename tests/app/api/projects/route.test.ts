import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.fn()
const findManyMock = vi.fn()
const createMock = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: findManyMock,
      create: createMock,
    },
  },
}))

import { GET, POST } from '@/app/api/projects/route'

describe('projects route handlers', () => {
  beforeEach(() => {
    authMock.mockReset()
    findManyMock.mockReset()
    createMock.mockReset()
  })

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null })

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('GET returns owned projects for authenticated user', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    findManyMock.mockResolvedValue([{ id: 'p1', name: 'First' }])

    const response = await GET()

    expect(findManyMock).toHaveBeenCalledWith({
      where: { ownerId: 'user_1' },
      orderBy: { createdAt: 'desc' },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 'p1', name: 'First' }])
  })

  it('POST returns 400 for malformed JSON payloads', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })

    const response = await POST(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        body: '{',
      }) as any,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Malformed JSON' })
  })

  it('POST creates project with trimmed name', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    createMock.mockResolvedValue({ id: 'p1', ownerId: 'user_1', name: 'Project Name' })

    const response = await POST(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '  Project Name  ' }),
      }) as any,
    )

    expect(createMock).toHaveBeenCalledWith({
      data: { ownerId: 'user_1', name: 'Project Name' },
    })
    expect(response.status).toBe(201)
  })

  it('POST falls back to default name when payload name is blank', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' })
    createMock.mockResolvedValue({ id: 'p1', ownerId: 'user_1', name: 'Untitled Project' })

    await POST(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '   ' }),
      }) as any,
    )

    expect(createMock).toHaveBeenCalledWith({
      data: { ownerId: 'user_1', name: 'Untitled Project' },
    })
  })
})
