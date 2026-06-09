import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectSpec: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { get as blobGet } from '@vercel/blob'
import { GET } from '@/app/api/projects/[projectId]/specs/[specId]/download/route'

const mockAuth = vi.mocked(auth)
const mockGetProjectAccess = vi.mocked(getProjectAccess)
const mockPrismaProjectSpecFindFirst = vi.mocked(prisma.projectSpec.findFirst)
const mockBlobGet = vi.mocked(blobGet)

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/projects/project-123/specs/spec-abc/download', {
    method: 'GET',
  })
}

function makeParams(projectId: string, specId: string) {
  return { params: Promise.resolve({ projectId, specId }) }
}

function makeStreamFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
}

describe('GET /api/projects/[projectId]/specs/[specId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('project access check', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    })

    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })

    it('calls getProjectAccess with the correct projectId', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      await GET(makeRequest(), makeParams('project-specific', 'spec-abc'))

      expect(mockGetProjectAccess).toHaveBeenCalledWith('project-specific')
    })
  })

  describe('spec ownership check', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
    })

    it('returns 404 when spec does not exist', async () => {
      mockPrismaProjectSpecFindFirst.mockResolvedValueOnce(null)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'Not found' })
    })

    it('queries spec with both specId AND projectId (prevents cross-project access)', async () => {
      mockPrismaProjectSpecFindFirst.mockResolvedValueOnce(null)

      await GET(makeRequest(), makeParams('project-123', 'spec-abc'))

      expect(mockPrismaProjectSpecFindFirst).toHaveBeenCalledWith({
        where: { id: 'spec-abc', projectId: 'project-123' },
      })
    })

    it('returns 404 when spec exists but belongs to a different project', async () => {
      // When called with projectId='project-123' but spec belongs to 'project-other',
      // findFirst returns null because of the combined where clause
      mockPrismaProjectSpecFindFirst.mockResolvedValueOnce(null)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))

      expect(res.status).toBe(404)
    })
  })

  describe('blob fetching', () => {
    const mockSpec = {
      id: 'spec-abc',
      projectId: 'project-123',
      filePath: 'https://blob.example.com/specs/project-123/spec-abc.md',
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
      mockPrismaProjectSpecFindFirst.mockResolvedValue(mockSpec as never)
    })

    it('fetches the blob using the spec filePath', async () => {
      const stream = makeStreamFromText('# Test Spec')
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      await GET(makeRequest(), makeParams('project-123', 'spec-abc'))

      expect(mockBlobGet).toHaveBeenCalledWith(
        'https://blob.example.com/specs/project-123/spec-abc.md',
        { access: 'private' },
      )
    })

    it('returns 404 when blob returns null/undefined', async () => {
      mockBlobGet.mockResolvedValueOnce(null as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'File not found' })
    })

    it('returns 503 when blob fetch throws', async () => {
      mockBlobGet.mockRejectedValueOnce(new Error('Blob storage unavailable'))

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toEqual({ error: 'Failed to retrieve spec file' })
    })
  })

  describe('response headers', () => {
    const mockSpec = {
      id: 'spec-abc',
      projectId: 'project-123',
      filePath: 'https://blob.example.com/specs/project-123/spec-abc.md',
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
      mockPrismaProjectSpecFindFirst.mockResolvedValue(mockSpec as never)
    })

    it('returns the spec content as text/markdown with attachment disposition', async () => {
      const specContent = '# My Technical Spec\n\n## Overview\nThis is a test.'
      const stream = makeStreamFromText(specContent)
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))
      const responseText = await res.text()

      expect(res.status).toBe(200)
      expect(responseText).toBe(specContent)
    })

    it('sets Content-Type to text/markdown with charset', async () => {
      const stream = makeStreamFromText('# Spec')
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))

      expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    })

    it('sets Content-Disposition as attachment with specId filename', async () => {
      const stream = makeStreamFromText('# Spec')
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'spec-abc'))

      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="spec-spec-abc.md"')
    })

    it('uses the specId from URL params in the filename', async () => {
      const stream = makeStreamFromText('# Spec')
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      const res = await GET(makeRequest(), makeParams('project-123', 'custom-spec-id'))

      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="spec-custom-spec-id.md"')
    })
  })
})