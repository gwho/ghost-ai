import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Module mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@trigger.dev/sdk', () => ({
  tasks: {
    trigger: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskRun: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: vi.fn(),
}))

// --- Imports (after mocks) ---

import { auth } from '@clerk/nextjs/server'
import { tasks } from '@trigger.dev/sdk'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { POST } from '@/app/api/ai/spec/route'

// --- Helpers ---

function makeRequest(body: unknown, { malformed = false }: { malformed?: boolean } = {}) {
  const url = 'http://localhost/api/ai/spec'
  if (malformed) {
    return new NextRequest(url, {
      method: 'POST',
      body: 'this is not json{',
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  roomId: 'project-123',
  chatHistory: [{ role: 'user', content: 'hello' }],
  nodes: [{ id: 'n1', type: 'canvasNode', position: { x: 0, y: 0 }, data: { label: 'Node' } }],
  edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
}

const mockAccess = {
  project: { id: 'project-123', name: 'Test Project', ownerId: 'user-123' },
  isOwner: true,
}

// --- Tests ---

describe('POST /api/ai/spec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    vi.mocked(getProjectAccess).mockResolvedValue(mockAccess as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)
    vi.mocked(tasks.trigger).mockResolvedValue({ id: 'run-abc' } as ReturnType<typeof tasks.trigger> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.taskRun.create).mockResolvedValue({} as ReturnType<typeof prisma.taskRun.create> extends Promise<infer T> ? T : never)
  })

  // --- Authentication ---

  it('returns 401 when no user is authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  // --- Body validation ---

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest(null, { malformed: true }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Malformed JSON' })
  })

  it('returns 400 when body is a JSON array instead of object', async () => {
    const res = await POST(makeRequest([1, 2, 3]))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('returns 400 when body is null', async () => {
    const res = await POST(makeRequest(null))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('returns 400 when roomId is missing', async () => {
    const { roomId: _omit, ...bodyWithoutRoom } = validBody
    const res = await POST(makeRequest(bodyWithoutRoom))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid roomId' })
  })

  it('returns 400 when roomId is not a string', async () => {
    const res = await POST(makeRequest({ ...validBody, roomId: 42 }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid roomId' })
  })

  it('returns 400 when chatHistory is not an array', async () => {
    const res = await POST(makeRequest({ ...validBody, chatHistory: 'not-an-array' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'chatHistory must be an array' })
  })

  it('returns 400 when chatHistory is an object instead of array', async () => {
    const res = await POST(makeRequest({ ...validBody, chatHistory: {} }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'chatHistory must be an array' })
  })

  it('returns 400 when nodes is not an array', async () => {
    const res = await POST(makeRequest({ ...validBody, nodes: 'not-an-array' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'nodes must be an array' })
  })

  it('returns 400 when edges is not an array', async () => {
    const res = await POST(makeRequest({ ...validBody, edges: null }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'edges must be an array' })
  })

  // --- Project access ---

  it('returns 404 when project access check fails', async () => {
    vi.mocked(getProjectAccess).mockResolvedValue(null)

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('calls getProjectAccess with roomId, not a client-supplied projectId', async () => {
    await POST(makeRequest(validBody))

    expect(getProjectAccess).toHaveBeenCalledWith('project-123')
    expect(getProjectAccess).toHaveBeenCalledTimes(1)
  })

  // --- Task trigger ---

  it('returns 201 with runId on success', async () => {
    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json).toEqual({ runId: 'run-abc' })
  })

  it('triggers generate-spec task with correct payload', async () => {
    await POST(makeRequest(validBody))

    expect(tasks.trigger).toHaveBeenCalledWith('generate-spec', {
      projectId: 'project-123',
      roomId: 'project-123',
      chatHistory: validBody.chatHistory,
      nodes: validBody.nodes,
      edges: validBody.edges,
    })
  })

  it('returns 502 when tasks.trigger throws', async () => {
    vi.mocked(tasks.trigger).mockRejectedValue(new Error('Trigger.dev down'))

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json).toEqual({ error: 'Failed to start spec run' })
  })

  it('does not call prisma.taskRun.create when tasks.trigger fails', async () => {
    vi.mocked(tasks.trigger).mockRejectedValue(new Error('Trigger.dev down'))

    await POST(makeRequest(validBody))

    expect(prisma.taskRun.create).not.toHaveBeenCalled()
  })

  // --- TaskRun persistence ---

  it('persists TaskRun with correct data', async () => {
    await POST(makeRequest(validBody))

    expect(prisma.taskRun.create).toHaveBeenCalledWith({
      data: {
        runId: 'run-abc',
        projectId: 'project-123',
        userId: 'user-123',
      },
    })
  })

  it('returns 202 with trackingUnavailable when prisma.taskRun.create fails', async () => {
    vi.mocked(prisma.taskRun.create).mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toEqual({ runId: 'run-abc', trackingUnavailable: true })
  })

  it('still returns the runId even when persistence fails', async () => {
    vi.mocked(prisma.taskRun.create).mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(json.runId).toBe('run-abc')
  })

  // --- Empty arrays accepted ---

  it('accepts empty chatHistory, nodes, and edges arrays', async () => {
    const res = await POST(makeRequest({ ...validBody, chatHistory: [], nodes: [], edges: [] }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json).toEqual({ runId: 'run-abc' })
  })

  // --- Regression: roomId falsy values ---

  it('returns 400 when roomId is an empty string', async () => {
    const res = await POST(makeRequest({ ...validBody, roomId: '' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid roomId' })
  })
})