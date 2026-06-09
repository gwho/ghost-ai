import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
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

import { auth } from '@clerk/nextjs/server'
import { get as blobGet } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { GET } from '@/app/api/projects/[projectId]/specs/[specId]/download/route'

const mockAuth = vi.mocked(auth)
const mockBlobGet = vi.mocked(blobGet)
const mockPrismaProjectSpecFindFirst = vi.mocked(prisma.projectSpec.findFirst)
const mockGetProjectAccess = vi.mocked(getProjectAccess)

function makeRequest(
  projectId: string,
  specId: string,
): [NextRequest, { params: Promise<{ projectId: string; specId: string }> }] {
  const req = new NextRequest(
    `http://localhost/api/projects/${projectId}/specs/${specId}/download`,
  )
  const params = { params: Promise.resolve({ projectId, specId }) }
  return [req, params]
}

function makeMockStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content))
      controller.close()
    },
  })
}

describe('GET /api/projects/[projectId]/specs/[specId]/download', () => {
  const projectId = 'project-abc'
  const specId = 'spec-123'
  const markdownContent = '# Test Spec\n\nThis is a test spec.'
  const blobUrl = `https://blob.vercel.com/specs/${projectId}/${specId}.md`

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    mockGetProjectAccess.mockResolvedValue({
      project: { id: projectId } as never,
      isOwner: true,
    })
    mockPrismaProjectSpecFindFirst.mockResolvedValue({
      id: specId,
      projectId,
      filePath: blobUrl,
      createdAt: new Date(),
    } as never)
    mockBlobGet.mockResolvedValue({
      url: blobUrl,
      stream: makeMockStream(markdownContent),
    } as never)
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null } as never)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 401 when userId is undefined', async () => {
      mockAuth.mockResolvedValue({ userId: undefined } as never)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)

      expect(res.status).toBe(401)
    })
  })

  describe('project access', () => {
    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValue(null)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('verifies project access using projectId from route params', async () => {
      const [req, params] = makeRequest(projectId, specId)
      await GET(req, params)

      expect(mockGetProjectAccess).toHaveBeenCalledWith(projectId)
    })
  })

  describe('spec existence check', () => {
    it('returns 404 when spec does not exist', async () => {
      mockPrismaProjectSpecFindFirst.mockResolvedValue(null as never)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toBe('Not found')
    })

    it('queries spec with both specId and projectId to prevent cross-project access', async () => {
      const [req, params] = makeRequest(projectId, specId)
      await GET(req, params)

      expect(mockPrismaProjectSpecFindFirst).toHaveBeenCalledWith({
        where: { id: specId, projectId },
      })
    })

    it('does not allow fetching a spec from a different project', async () => {
      // Spec exists but belongs to a different project — findFirst returns null
      // because the where clause includes projectId
      mockPrismaProjectSpecFindFirst.mockResolvedValue(null as never)

      const [req, params] = makeRequest('wrong-project', specId)
      const res = await GET(req, params)

      expect(res.status).toBe(404)
    })
  })

  describe('blob retrieval', () => {
    it('returns 404 when blob returns null result', async () => {
      mockBlobGet.mockResolvedValue(null as never)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toBe('File not found')
    })

    it('returns 503 when blob fetch throws an error', async () => {
      mockBlobGet.mockRejectedValue(new Error('Blob storage unavailable'))

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const data = await res.json()

      expect(res.status).toBe(503)
      expect(data.error).toBe('Failed to retrieve spec file')
    })

    it('fetches blob using the filePath stored in the spec record', async () => {
      const [req, params] = makeRequest(projectId, specId)
      await GET(req, params)

      expect(mockBlobGet).toHaveBeenCalledWith(blobUrl, { access: 'private' })
    })

    it('uses private access mode to fetch the blob', async () => {
      const [req, params] = makeRequest(projectId, specId)
      await GET(req, params)

      const callArgs = mockBlobGet.mock.calls[0]
      expect(callArgs[1]).toEqual({ access: 'private' })
    })
  })

  describe('successful download response', () => {
    it('returns 200 with markdown content', async () => {
      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe(markdownContent)
    })

    it('sets Content-Type to text/markdown', async () => {
      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)

      expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    })

    it('sets Content-Disposition to attachment with specId filename', async () => {
      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)

      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="spec-${specId}.md"`,
      )
    })

    it('uses the correct filename in Content-Disposition header', async () => {
      const customSpecId = 'custom-spec-id-456'
      mockPrismaProjectSpecFindFirst.mockResolvedValue({
        id: customSpecId,
        projectId,
        filePath: blobUrl,
        createdAt: new Date(),
      } as never)

      const [req, params] = makeRequest(projectId, customSpecId)
      const res = await GET(req, params)

      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="spec-${customSpecId}.md"`,
      )
    })
  })

  describe('regression: spec content is returned as-is', () => {
    it('returns the exact markdown content from the blob', async () => {
      const specificContent = '# API Gateway\n\n## Overview\nHandles all incoming requests.'
      mockBlobGet.mockResolvedValue({
        url: blobUrl,
        stream: makeMockStream(specificContent),
      } as never)

      const [req, params] = makeRequest(projectId, specId)
      const res = await GET(req, params)
      const text = await res.text()

      expect(text).toBe(specificContent)
    })
  })
})