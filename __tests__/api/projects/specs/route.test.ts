import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Module mocks ---

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectSpec: {
      findMany: vi.fn(),
    },
  },
}))

// --- Imports (after mocks) ---

import { getProjectAccess } from '@/lib/project-access'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/projects/[projectId]/specs/route'

// --- Helpers ---

function makeRequest() {
  return new NextRequest('http://localhost/api/projects/proj-1/specs')
}

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) }
}

const mockSpecs = [
  { id: 'spec-3', filePath: 'specs/proj-1/spec-3.md', createdAt: new Date('2024-03-01') },
  { id: 'spec-2', filePath: 'specs/proj-1/spec-2.md', createdAt: new Date('2024-02-01') },
  { id: 'spec-1', filePath: 'specs/proj-1/spec-1.md', createdAt: new Date('2024-01-01') },
]

const mockAccess = {
  project: { id: 'proj-1', name: 'Test Project', ownerId: 'user-1' },
  isOwner: true,
}

// --- Tests ---

describe('GET /api/projects/[projectId]/specs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProjectAccess).mockResolvedValue(mockAccess as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.projectSpec.findMany).mockResolvedValue(mockSpecs as ReturnType<typeof prisma.projectSpec.findMany> extends Promise<infer T> ? T : never)
  })

  // --- Access control ---

  it('returns 401 when project access check fails', async () => {
    vi.mocked(getProjectAccess).mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('calls getProjectAccess with the projectId from params', async () => {
    await GET(makeRequest(), makeParams('proj-xyz'))

    expect(getProjectAccess).toHaveBeenCalledWith('proj-xyz')
  })

  // --- Successful response ---

  it('returns specs array on success', async () => {
    const res = await GET(makeRequest(), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('specs')
    expect(Array.isArray(json.specs)).toBe(true)
  })

  it('returns all specs with id, filePath, and createdAt', async () => {
    const res = await GET(makeRequest(), makeParams('proj-1'))
    const json = await res.json()

    expect(json.specs).toHaveLength(3)
    for (const spec of json.specs) {
      expect(spec).toHaveProperty('id')
      expect(spec).toHaveProperty('filePath')
      expect(spec).toHaveProperty('createdAt')
    }
  })

  it('returns empty array when project has no specs', async () => {
    vi.mocked(prisma.projectSpec.findMany).mockResolvedValue([])

    const res = await GET(makeRequest(), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.specs).toEqual([])
  })

  // --- Query parameters ---

  it('queries prisma with the correct projectId filter', async () => {
    await GET(makeRequest(), makeParams('proj-1'))

    expect(prisma.projectSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1' },
      }),
    )
  })

  it('orders specs by createdAt descending', async () => {
    await GET(makeRequest(), makeParams('proj-1'))

    expect(prisma.projectSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('selects only id, filePath, and createdAt fields', async () => {
    await GET(makeRequest(), makeParams('proj-1'))

    expect(prisma.projectSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, filePath: true, createdAt: true },
      }),
    )
  })

  // --- Collaborator access (non-owner) ---

  it('allows access for project collaborators', async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      ...mockAccess,
      isOwner: false,
    } as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)

    const res = await GET(makeRequest(), makeParams('proj-1'))

    expect(res.status).toBe(200)
  })
})