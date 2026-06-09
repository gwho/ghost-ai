import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Module mocks ---

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

// --- Imports (after mocks) ---

import { put as blobPut, get as blobGet } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { PUT } from '@/app/api/projects/[projectId]/canvas/route'

// --- Helpers ---

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/projects/proj-1/canvas', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) }
}

const validNode = {
  id: 'node-1',
  type: 'canvasNode',
  position: { x: 100, y: 200 },
  data: { label: 'Service A' },
}

const validEdge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
}

const validBody = { nodes: [validNode], edges: [validEdge] }

const mockAccess = {
  project: { id: 'proj-1', name: 'Test', ownerId: 'user-1', canvasJsonPath: null },
  isOwner: true,
}

// --- Tests ---

describe('PUT /api/projects/[projectId]/canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProjectAccess).mockResolvedValue(mockAccess as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)
    vi.mocked(blobPut).mockResolvedValue({ url: 'https://blob.vercel.com/canvas/proj-1.json' } as ReturnType<typeof blobPut> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.project.update).mockResolvedValue({} as ReturnType<typeof prisma.project.update> extends Promise<infer T> ? T : never)
  })

  it('returns 401 when project access fails', async () => {
    vi.mocked(getProjectAccess).mockResolvedValue(null)

    const res = await PUT(makeRequest(validBody), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 with blob url on success', async () => {
    const res = await PUT(makeRequest(validBody), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ url: 'https://blob.vercel.com/canvas/proj-1.json' })
  })

  /**
   * This test specifically covers the fix: canvas.route.ts must pass
   * `allowOverwrite: true` to Vercel Blob so that subsequent saves to the
   * same deterministic path succeed (without it, every save after the first
   * would fail with "blob already exists").
   */
  it('calls blob.put with allowOverwrite: true to allow repeated saves', async () => {
    await PUT(makeRequest(validBody), makeParams('proj-1'))

    expect(blobPut).toHaveBeenCalledWith(
      'canvas/proj-1.json',
      expect.any(String),
      expect.objectContaining({ allowOverwrite: true }),
    )
  })

  it('calls blob.put with addRandomSuffix: false to keep a deterministic path', async () => {
    await PUT(makeRequest(validBody), makeParams('proj-1'))

    expect(blobPut).toHaveBeenCalledWith(
      'canvas/proj-1.json',
      expect.any(String),
      expect.objectContaining({ addRandomSuffix: false }),
    )
  })

  it('calls blob.put with private access', async () => {
    await PUT(makeRequest(validBody), makeParams('proj-1'))

    expect(blobPut).toHaveBeenCalledWith(
      'canvas/proj-1.json',
      expect.any(String),
      expect.objectContaining({ access: 'private' }),
    )
  })

  it('uses the projectId in the blob path', async () => {
    await PUT(makeRequest(validBody), makeParams('my-project-id'))

    expect(blobPut).toHaveBeenCalledWith(
      'canvas/my-project-id.json',
      expect.any(String),
      expect.any(Object),
    )
  })

  it('persists the new blob url in the project record', async () => {
    await PUT(makeRequest(validBody), makeParams('proj-1'))

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { canvasJsonPath: 'https://blob.vercel.com/canvas/proj-1.json' },
    })
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj-1/canvas', {
      method: 'PUT',
      body: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req, makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Malformed JSON' })
  })

  it('returns 400 when body is not an object with nodes/edges', async () => {
    const res = await PUT(makeRequest('just a string'), makeParams('proj-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Invalid canvas payload' })
  })

  it('returns 400 for invalid node missing required fields', async () => {
    const badNode = { id: 'n1', type: 'canvasNode', position: { x: 0, y: 0 } }
    // missing data.label
    const res = await PUT(
      makeRequest({ nodes: [badNode], edges: [] }),
      makeParams('proj-1'),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
  })

  it('accepts empty nodes and edges arrays', async () => {
    const res = await PUT(makeRequest({ nodes: [], edges: [] }), makeParams('proj-1'))

    expect(res.status).toBe(200)
  })
})