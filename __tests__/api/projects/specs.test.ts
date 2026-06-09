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
  getProjectAccess: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { GET } from '@/app/api/projects/[projectId]/specs/route'

const mockPrismaProjectSpecFindMany = vi.mocked(prisma.projectSpec.findMany)
const mockGetProjectAccess = vi.mocked(getProjectAccess)

function makeRequest(projectId: string): [NextRequest, { params: Promise<{ projectId: string }> }] {
  const req = new NextRequest(`http://localhost/api/projects/${projectId}/specs`)
  const params = { params: Promise.resolve({ projectId }) }
  return [req, params]
}

describe('GET /api/projects/[projectId]/specs', () => {
  const projectId = 'project-abc'
  const mockSpecs = [
    {
      id: 'spec-1',
      filePath: 'https://blob.vercel.com/specs/project-abc/spec-1.md',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: 'spec-2',
      filePath: 'https://blob.vercel.com/specs/project-abc/spec-2.md',
      createdAt: new Date('2024-01-14T10:00:00Z'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjectAccess.mockResolvedValue({
      project: { id: projectId } as never,
      isOwner: true,
    })
    mockPrismaProjectSpecFindMany.mockResolvedValue(mockSpecs as never)
  })

  describe('authorization', () => {
    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValue(null)

      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('calls getProjectAccess with the projectId from params', async () => {
      const [req, params] = makeRequest(projectId)
      await GET(req, params)

      expect(mockGetProjectAccess).toHaveBeenCalledWith(projectId)
    })

    it('returns 401 for a collaborator who loses access', async () => {
      mockGetProjectAccess.mockResolvedValue(null)

      const [req, params] = makeRequest('nonexistent-project')
      const res = await GET(req, params)

      expect(res.status).toBe(401)
    })
  })

  describe('successful spec listing', () => {
    it('returns 200 with specs array', async () => {
      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toHaveProperty('specs')
      expect(Array.isArray(data.specs)).toBe(true)
    })

    it('returns the correct number of specs', async () => {
      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(data.specs).toHaveLength(2)
    })

    it('queries specs for the correct projectId', async () => {
      const [req, params] = makeRequest(projectId)
      await GET(req, params)

      expect(mockPrismaProjectSpecFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
        })
      )
    })

    it('orders specs by createdAt descending', async () => {
      const [req, params] = makeRequest(projectId)
      await GET(req, params)

      expect(mockPrismaProjectSpecFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      )
    })

    it('selects only id, filePath, and createdAt fields', async () => {
      const [req, params] = makeRequest(projectId)
      await GET(req, params)

      expect(mockPrismaProjectSpecFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, filePath: true, createdAt: true },
        })
      )
    })

    it('returns empty array when no specs exist', async () => {
      mockPrismaProjectSpecFindMany.mockResolvedValue([])

      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.specs).toEqual([])
    })

    it('includes filePath in each spec item', async () => {
      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(data.specs[0]).toHaveProperty('filePath')
    })

    it('includes id in each spec item', async () => {
      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(data.specs[0]).toHaveProperty('id')
    })

    it('includes createdAt in each spec item', async () => {
      const [req, params] = makeRequest(projectId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(data.specs[0]).toHaveProperty('createdAt')
    })
  })

  describe('regression: cross-project data isolation', () => {
    it('does not return specs from a different project', async () => {
      const [req, params] = makeRequest('other-project')
      await GET(req, params)

      expect(mockPrismaProjectSpecFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'other-project' },
        })
      )
      // The call is scoped to the requested projectId, not a hardcoded one
    })
  })
})