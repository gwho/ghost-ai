import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  get: vi.fn(),
}))

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

import { put as blobPut } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { PUT } from '@/app/api/projects/[projectId]/canvas/route'

const mockBlobPut = vi.mocked(blobPut)
const mockPrismaProjectUpdate = vi.mocked(prisma.project.update)
const mockGetProjectAccess = vi.mocked(getProjectAccess)

function makeRequest(
  projectId: string,
  body: unknown,
  options: { malformed?: boolean } = {},
): [NextRequest, { params: Promise<{ projectId: string }> }] {
  const req = options.malformed
    ? new NextRequest(`http://localhost/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        body: 'not-json{{{',
        headers: { 'Content-Type': 'application/json' },
      })
    : new NextRequest(`http://localhost/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
  const params = { params: Promise.resolve({ projectId }) }
  return [req, params]
}

const validNode = {
  id: 'node-1',
  type: 'default',
  position: { x: 100, y: 200 },
  data: { label: 'API Gateway' },
}

const validEdge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
}

const validPayload = {
  nodes: [validNode],
  edges: [validEdge],
}

describe('PUT /api/projects/[projectId]/canvas', () => {
  const projectId = 'project-abc'
  const blobUrl = `https://blob.vercel.com/canvas/${projectId}.json`

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProjectAccess.mockResolvedValue({
      project: { id: projectId, canvasJsonPath: null } as never,
      isOwner: true,
    })
    mockBlobPut.mockResolvedValue({ url: blobUrl } as never)
    mockPrismaProjectUpdate.mockResolvedValue({} as never)
  })

  describe('authorization', () => {
    it('returns 401 when user has no project access', async () => {
      mockGetProjectAccess.mockResolvedValue(null)

      const [req, params] = makeRequest(projectId, validPayload)
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('request body validation', () => {
    it('returns 400 for malformed JSON', async () => {
      const [req, params] = makeRequest(projectId, null, { malformed: true })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Malformed JSON')
    })

    it('returns 400 when body is null', async () => {
      const [req, params] = makeRequest(projectId, null)
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid canvas payload')
    })

    it('returns 400 when nodes is missing', async () => {
      const [req, params] = makeRequest(projectId, { edges: [] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid canvas payload')
    })

    it('returns 400 when edges is missing', async () => {
      const [req, params] = makeRequest(projectId, { nodes: [] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid canvas payload')
    })

    it('returns 400 when a node has missing id', async () => {
      const invalidNode = { type: 'default', position: { x: 0, y: 0 }, data: { label: 'X' } }
      const [req, params] = makeRequest(projectId, { nodes: [invalidNode], edges: [] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('Invalid node')
    })

    it('returns 400 when a node has invalid position (non-numeric x)', async () => {
      const invalidNode = {
        id: 'n1',
        type: 'default',
        position: { x: 'not-number', y: 0 },
        data: { label: 'X' },
      }
      const [req, params] = makeRequest(projectId, { nodes: [invalidNode], edges: [] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
    })

    it('returns 400 when an edge has missing source', async () => {
      const invalidEdge = { id: 'e1', target: 'node-2' }
      const [req, params] = makeRequest(projectId, { nodes: [], edges: [invalidEdge] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('Invalid edge')
    })

    it('returns 400 when an edge has missing target', async () => {
      const invalidEdge = { id: 'e1', source: 'node-1' }
      const [req, params] = makeRequest(projectId, { nodes: [], edges: [invalidEdge] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(400)
    })

    it('returns 413 when canvas payload exceeds size limit', async () => {
      // Create a payload that exceeds 1MB (1_000_000 bytes).
      // The label needs to be large enough so the full serialized JSON exceeds the limit.
      // 1_100_000 chars for the label ensures the JSON payload is safely over 1MB.
      const bigLabel = 'A'.repeat(1_100_000)
      const bigNode = {
        id: 'n1',
        type: 'default',
        position: { x: 0, y: 0 },
        data: { label: bigLabel },
      }
      const [req, params] = makeRequest(projectId, { nodes: [bigNode], edges: [] })
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(413)
      expect(data.error).toBe('Canvas payload is too large')
    })
  })

  describe('blob upload with allowOverwrite', () => {
    it('calls blob put with allowOverwrite: true', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockBlobPut).toHaveBeenCalledWith(
        `canvas/${projectId}.json`,
        expect.any(String),
        expect.objectContaining({ allowOverwrite: true }),
      )
    })

    it('calls blob put with addRandomSuffix: false for deterministic path', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockBlobPut).toHaveBeenCalledWith(
        `canvas/${projectId}.json`,
        expect.any(String),
        expect.objectContaining({ addRandomSuffix: false }),
      )
    })

    it('calls blob put with private access', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockBlobPut).toHaveBeenCalledWith(
        `canvas/${projectId}.json`,
        expect.any(String),
        expect.objectContaining({ access: 'private' }),
      )
    })

    it('uses the correct content type for JSON', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockBlobPut).toHaveBeenCalledWith(
        `canvas/${projectId}.json`,
        expect.any(String),
        expect.objectContaining({ contentType: 'application/json' }),
      )
    })

    it('uses a deterministic blob path based on projectId', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockBlobPut).toHaveBeenCalledWith(
        `canvas/${projectId}.json`,
        expect.any(String),
        expect.any(Object),
      )
    })

    it('allows repeated saves to the same projectId path (upsert behavior)', async () => {
      // First save
      const [req1, params1] = makeRequest(projectId, validPayload)
      await PUT(req1, params1)

      // Second save to same project - should succeed because allowOverwrite: true
      const [req2, params2] = makeRequest(projectId, { ...validPayload, nodes: [] })
      await PUT(req2, params2)

      // Both calls should succeed with allowOverwrite
      expect(mockBlobPut).toHaveBeenCalledTimes(2)
      // Both should have allowOverwrite: true
      expect(mockBlobPut.mock.calls[0][2]).toMatchObject({ allowOverwrite: true })
      expect(mockBlobPut.mock.calls[1][2]).toMatchObject({ allowOverwrite: true })
    })
  })

  describe('database update', () => {
    it('updates the project canvasJsonPath with the blob URL', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      await PUT(req, params)

      expect(mockPrismaProjectUpdate).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { canvasJsonPath: blobUrl },
      })
    })
  })

  describe('successful response', () => {
    it('returns 200 with the blob URL', async () => {
      const [req, params] = makeRequest(projectId, validPayload)
      const res = await PUT(req, params)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.url).toBe(blobUrl)
    })

    it('accepts empty nodes and edges arrays', async () => {
      const [req, params] = makeRequest(projectId, { nodes: [], edges: [] })
      const res = await PUT(req, params)

      expect(res.status).toBe(200)
    })
  })
})