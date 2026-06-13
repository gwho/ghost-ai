import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  get: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { put as blobPut, get as blobGet } from '@vercel/blob'
import { PUT, GET } from '@/app/api/projects/[projectId]/canvas/route'

const mockGetProjectAccess = vi.mocked(getProjectAccess)
const mockBlobPut = vi.mocked(blobPut)
const mockBlobGet = vi.mocked(blobGet)
const mockPrismaProjectUpdate = vi.mocked(prisma.project.update)

const validCanvasBody = {
  nodes: [
    {
      id: 'node-1',
      type: 'shape',
      position: { x: 100, y: 200 },
      data: { label: 'API Gateway' },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
    },
  ],
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/projects/project-123/canvas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/projects/project-123/canvas', {
    method: 'GET',
  })
}

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) }
}

describe('PUT /api/projects/[projectId]/canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      const res = await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('allowOverwrite behavior (key change in this PR)', () => {
    beforeEach(() => {
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
      mockPrismaProjectUpdate.mockResolvedValue({} as never)
    })

    it('calls blob put with allowOverwrite: true', async () => {
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)

      await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))

      expect(mockBlobPut).toHaveBeenCalledWith(
        'canvas/project-123.json',
        expect.any(String),
        expect.objectContaining({ allowOverwrite: true }),
      )
    })

    it('calls blob put with addRandomSuffix: false (deterministic path)', async () => {
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)

      await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))

      expect(mockBlobPut).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ addRandomSuffix: false }),
      )
    })

    it('calls blob put with access: private', async () => {
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)

      await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))

      expect(mockBlobPut).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ access: 'private' }),
      )
    })

    it('uses the correct canvas path with projectId', async () => {
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-abc.json' } as never)

      await PUT(makePutRequest(validCanvasBody), makeParams('project-abc'))

      expect(mockBlobPut).toHaveBeenCalledWith(
        'canvas/project-abc.json',
        expect.any(String),
        expect.any(Object),
      )
    })

    it('saves blob url to project record', async () => {
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)

      await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))

      expect(mockPrismaProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'project-123' },
        data: { canvasJsonPath: 'https://blob.example.com/canvas/project-123.json' },
      })
    })

    it('returns the blob url on success', async () => {
      const blobUrl = 'https://blob.example.com/canvas/project-123.json'
      mockBlobPut.mockResolvedValueOnce({ url: blobUrl } as never)

      const res = await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ url: blobUrl })
    })

    it('allows overwriting on second save (same path, allowOverwrite: true enables this)', async () => {
      // First save
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)
      await PUT(makePutRequest(validCanvasBody), makeParams('project-123'))

      // Second save - should also work because allowOverwrite: true
      const updatedBody = {
        ...validCanvasBody,
        nodes: [...validCanvasBody.nodes, { id: 'node-2', type: 'shape', position: { x: 300, y: 100 }, data: { label: 'Auth Service' } }],
      }
      mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.example.com/canvas/project-123.json' } as never)
      mockPrismaProjectUpdate.mockResolvedValue({} as never)

      const res = await PUT(makePutRequest(updatedBody), makeParams('project-123'))
      expect(res.status).toBe(200)

      // Verify allowOverwrite: true on both calls
      expect(mockBlobPut).toHaveBeenCalledTimes(2)
      const [, , secondOptions] = mockBlobPut.mock.calls[1]
      expect(secondOptions).toMatchObject({ allowOverwrite: true })
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
    })

    it('returns 400 for malformed JSON', async () => {
      const req = new NextRequest('http://localhost/api/projects/project-123/canvas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{',
      })
      const res = await PUT(req, makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Malformed JSON' })
    })

    it('returns 400 when body is not an object', async () => {
      const res = await PUT(makePutRequest([]), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Invalid canvas payload' })
    })

    it('returns 400 when nodes is not an array', async () => {
      const res = await PUT(makePutRequest({ nodes: 'not-array', edges: [] }), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Invalid canvas payload' })
    })

    it('returns 400 when edges is not an array', async () => {
      const res = await PUT(makePutRequest({ nodes: [], edges: 'not-array' }), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Invalid canvas payload' })
    })

    it('returns 400 for invalid node (missing id)', async () => {
      const invalidNodes = [{
        type: 'shape',
        position: { x: 100, y: 200 },
        data: { label: 'API Gateway' },
      }]
      const res = await PUT(makePutRequest({ nodes: invalidNodes, edges: [] }), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('Invalid node')
    })

    it('returns 400 for invalid edge (missing source)', async () => {
      const invalidEdges = [{ id: 'edge-1', target: 'node-2' }]
      const res = await PUT(makePutRequest({ nodes: [], edges: invalidEdges }), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('Invalid edge')
    })

    it('returns 413 when canvas payload exceeds size limit', async () => {
      // Generate a very large payload that exceeds 1MB
      const largeNodes = Array.from({ length: 5000 }, (_, i) => ({
        id: `node-${i}`,
        type: 'shape',
        position: { x: i * 10, y: i * 10 },
        data: { label: `Component ${'x'.repeat(200)}` },
      }))
      const res = await PUT(makePutRequest({ nodes: largeNodes, edges: [] }), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(413)
      expect(body).toEqual({ error: 'Canvas payload is too large' })
    })
  })
})

describe('GET /api/projects/[projectId]/canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      const res = await GET(makeGetRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('canvas loading', () => {
    it('returns empty canvas when no canvasJsonPath is set', async () => {
      mockGetProjectAccess.mockResolvedValueOnce({
        project: { id: 'project-123', canvasJsonPath: null },
        isOwner: true,
      } as never)

      const res = await GET(makeGetRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ nodes: [], edges: [] })
    })

    it('loads and returns canvas from blob when canvasJsonPath is set', async () => {
      const canvasData = {
        nodes: [{ id: 'node-1', type: 'shape', position: { x: 0, y: 0 }, data: { label: 'Service' } }],
        edges: [],
      }
      mockGetProjectAccess.mockResolvedValueOnce({
        project: { id: 'project-123', canvasJsonPath: 'https://blob.example.com/canvas/project-123.json' },
        isOwner: true,
      } as never)

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(canvasData)))
          controller.close()
        },
      })
      mockBlobGet.mockResolvedValueOnce({ stream } as never)

      const res = await GET(makeGetRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual(canvasData)
    })

    it('returns 503 when canvas blob cannot be loaded', async () => {
      mockGetProjectAccess.mockResolvedValueOnce({
        project: { id: 'project-123', canvasJsonPath: 'https://blob.example.com/canvas/project-123.json' },
        isOwner: true,
      } as never)
      mockBlobGet.mockRejectedValueOnce(new Error('Blob unavailable'))

      const res = await GET(makeGetRequest(), makeParams('project-123'))
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toEqual({ error: 'Failed to load saved canvas' })
    })
  })
})