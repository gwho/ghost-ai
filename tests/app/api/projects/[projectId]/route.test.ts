import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, findUniqueMock, updateMock, deleteMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}))

import { DELETE, PATCH } from '@/app/api/projects/[projectId]/route'

const params = Promise.resolve({ projectId: 'project_1' })

describe('project detail route handlers', () => {
  beforeEach(() => {
    authMock.mockReset()
    findUniqueMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
  })

  it('PATCH returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null })

    const response = await PATCH(new Request('http://localhost') as any, { params })

    expect(response.status).toBe(401)
  })

  it('PATCH returns 404 when project is missing', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    findUniqueMock.mockResolvedValue(null)

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }) as any,
      { params },
    )

    expect(response.status).toBe(404)
  })

  it('PATCH returns 403 when user is not owner', async () => {
    authMock.mockResolvedValue({ userId: 'user_2' })
    findUniqueMock.mockResolvedValue({ id: 'project_1', ownerId: 'owner_1' })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }) as any,
      { params },
    )

    expect(response.status).toBe(403)
  })

  it('PATCH validates JSON and project name', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    findUniqueMock.mockResolvedValue({ id: 'project_1', ownerId: 'owner_1' })

    const malformed = await PATCH(
      new Request('http://localhost', { method: 'PATCH', body: '{' }) as any,
      { params },
    )
    expect(malformed.status).toBe(400)

    const invalidName = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: '   ' }),
      }) as any,
      { params },
    )
    expect(invalidName.status).toBe(400)
  })

  it('PATCH updates and returns project when valid', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    findUniqueMock.mockResolvedValue({ id: 'project_1', ownerId: 'owner_1' })
    updateMock.mockResolvedValue({ id: 'project_1', name: 'Updated' })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Updated  ' }),
      }) as any,
      { params },
    )

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'project_1' },
      data: { name: 'Updated' },
    })
    await expect(response.json()).resolves.toEqual({ id: 'project_1', name: 'Updated' })
  })

  it('DELETE enforces auth and ownership checks', async () => {
    authMock.mockResolvedValueOnce({ userId: null })
    const unauth = await DELETE(new Request('http://localhost') as any, { params })
    expect(unauth.status).toBe(401)

    authMock.mockResolvedValueOnce({ userId: 'owner_1' })
    findUniqueMock.mockResolvedValueOnce(null)
    const missing = await DELETE(new Request('http://localhost') as any, { params })
    expect(missing.status).toBe(404)

    authMock.mockResolvedValueOnce({ userId: 'user_2' })
    findUniqueMock.mockResolvedValueOnce({ id: 'project_1', ownerId: 'owner_1' })
    const forbidden = await DELETE(new Request('http://localhost') as any, { params })
    expect(forbidden.status).toBe(403)
  })

  it('DELETE removes project and returns 204 for owners', async () => {
    authMock.mockResolvedValue({ userId: 'owner_1' })
    findUniqueMock.mockResolvedValue({ id: 'project_1', ownerId: 'owner_1' })

    const response = await DELETE(new Request('http://localhost') as any, { params })

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'project_1' } })
    expect(response.status).toBe(204)
  })
})
