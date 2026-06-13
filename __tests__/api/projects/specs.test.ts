import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectSpec: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/project-access', () => ({
  getCurrentIdentity: vi.fn(),
  getProjectAccess: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentIdentity, getProjectAccess } from '@/lib/project-access'
import { GET } from '@/app/api/projects/[projectId]/specs/route'

const mockGetCurrentIdentity = vi.mocked(getCurrentIdentity)
const mockGetProjectAccess = vi.mocked(getProjectAccess)
const mockPrismaProjectSpecFindMany = vi.mocked(prisma.projectSpec.findMany)

const mockIdentity = { userId: 'user-abc', email: 'user@example.com' }

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/projects/project-123/specs', {
    method: 'GET',
  })
}

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) }
}

describe('GET /api/projects/[projectId]/specs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentIdentity.mockResolvedValue(mockIdentity)
  })

  describe('authorization', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetCurrentIdentity.mockResolvedValueOnce(null)

      const res = await GET(makeRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })

    it('returns 404 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      const res = await GET(makeRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'Not found' })
    })

    it('calls getProjectAccess with the correct projectId from params', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      await GET(makeRequest(), makeParams('proj-specific-id'))

      expect(mockGetProjectAccess).toHaveBeenCalledWith('proj-specific-id', mockIdentity)
    })
  })

  describe('spec listing', () => {
    beforeEach(() => {
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
    })

    it('returns specs for the project', async () => {
      const isoDate = '2024-01-15T10:00:00.000Z'
      const specs = [
        { id: 'spec-1', filePath: 'https://blob.example.com/specs/project-123/spec-1.md', createdAt: isoDate },
        { id: 'spec-2', filePath: 'https://blob.example.com/specs/project-123/spec-2.md', createdAt: isoDate },
      ]
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce(specs as never)

      const res = await GET(makeRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ specs })
    })

    it('returns empty specs array when no specs exist', async () => {
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce([])

      const res = await GET(makeRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ specs: [] })
    })

    it('queries with correct projectId and ordering', async () => {
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce([])

      await GET(makeRequest(), makeParams('project-abc'))

      expect(mockPrismaProjectSpecFindMany).toHaveBeenCalledWith({
        where: { projectId: 'project-abc' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, filePath: true, createdAt: true },
      })
    })

    it('selects only id, filePath, and createdAt (not full spec content)', async () => {
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce([])

      await GET(makeRequest(), makeParams('project-123'))

      const callArgs = mockPrismaProjectSpecFindMany.mock.calls[0][0]
      expect(callArgs.select).toEqual({ id: true, filePath: true, createdAt: true })
      expect(callArgs.select).not.toHaveProperty('content')
    })

    it('orders results by createdAt descending (newest first)', async () => {
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce([])

      await GET(makeRequest(), makeParams('project-123'))

      const callArgs = mockPrismaProjectSpecFindMany.mock.calls[0][0]
      expect(callArgs.orderBy).toEqual({ createdAt: 'desc' })
    })

    it('returns 500 when Prisma findMany fails', async () => {
      mockPrismaProjectSpecFindMany.mockRejectedValueOnce(new Error('Database connection failed'))

      const res = await GET(makeRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body).toEqual({ error: 'Failed to load specs' })
    })
  })

  describe('collaborator access', () => {
    it('allows non-owner collaborators to list specs', async () => {
      mockGetProjectAccess.mockResolvedValueOnce({ project: { id: 'project-123' }, isOwner: false } as never)
      mockPrismaProjectSpecFindMany.mockResolvedValueOnce([])

      const res = await GET(makeRequest(), makeParams('project-123'))

      expect(res.status).toBe(200)
    })
  })
})
