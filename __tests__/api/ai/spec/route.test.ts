import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies before importing the route
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskRun: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@trigger.dev/sdk', () => ({
  tasks: {
    trigger: vi.fn(),
  },
}))

vi.mock('@/lib/project-access', () => ({
  getProjectAccess: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { tasks } from '@trigger.dev/sdk'
import { getProjectAccess } from '@/lib/project-access'
import { POST } from '@/app/api/ai/spec/route'

const mockAuth = vi.mocked(auth)
const mockGetProjectAccess = vi.mocked(getProjectAccess)
const mockTasksTrigger = vi.mocked(tasks.trigger)
const mockPrismaTaskRunCreate = vi.mocked(prisma.taskRun.create)

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/spec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost/api/ai/spec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json{',
  })
}

const validBody = {
  roomId: 'project-123',
  chatHistory: [{ role: 'user', content: 'Build a CI/CD pipeline' }],
  nodes: [{ id: 'node-1', label: 'API Gateway' }],
  edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
}

describe('POST /api/ai/spec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never)

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
    })

    it('proceeds when user is authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValueOnce({ project: { id: 'project-123' }, isOwner: true } as never)
      mockTasksTrigger.mockResolvedValueOnce({ id: 'run-xyz' } as never)
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      const res = await POST(makeRequest(validBody))

      expect(res.status).toBe(201)
    })
  })

  describe('request body validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    })

    it('returns 400 for malformed JSON', async () => {
      const res = await POST(makeInvalidJsonRequest())
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Malformed JSON' })
    })

    it('returns 400 when body is null', async () => {
      const req = new NextRequest('http://localhost/api/ai/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Request body must be a JSON object' })
    })

    it('returns 400 when body is an array', async () => {
      const res = await POST(makeRequest([]))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Request body must be a JSON object' })
    })

    it('returns 400 when roomId is missing', async () => {
      const res = await POST(makeRequest({ ...validBody, roomId: undefined }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid roomId' })
    })

    it('returns 400 when roomId is not a string', async () => {
      const res = await POST(makeRequest({ ...validBody, roomId: 42 }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid roomId' })
    })

    it('returns 400 when roomId is an empty string', async () => {
      const res = await POST(makeRequest({ ...validBody, roomId: '' }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid roomId' })
    })

    it('returns 400 when chatHistory is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, chatHistory: 'not-an-array' }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'chatHistory must be an array' })
    })

    it('returns 400 when chatHistory is null', async () => {
      const res = await POST(makeRequest({ ...validBody, chatHistory: null }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'chatHistory must be an array' })
    })

    it('returns 400 when nodes is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, nodes: {} }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'nodes must be an array' })
    })

    it('returns 400 when edges is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, edges: 'edges' }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'edges must be an array' })
    })

    it('accepts empty arrays for nodes and edges', async () => {
      mockGetProjectAccess.mockResolvedValueOnce({ project: { id: 'project-123' }, isOwner: true } as never)
      mockTasksTrigger.mockResolvedValueOnce({ id: 'run-xyz' } as never)
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      const res = await POST(makeRequest({ ...validBody, nodes: [], edges: [] }))

      expect(res.status).toBe(201)
    })
  })

  describe('project access check', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    })

    it('returns 404 when project is not found or user has no access', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'Not found' })
    })

    it('calls getProjectAccess with roomId (not a client-supplied projectId)', async () => {
      mockGetProjectAccess.mockResolvedValueOnce(null)

      await POST(makeRequest({ ...validBody, roomId: 'room-abc' }))

      expect(mockGetProjectAccess).toHaveBeenCalledWith('room-abc')
      expect(mockGetProjectAccess).not.toHaveBeenCalledWith(expect.anything(), expect.anything())
    })
  })

  describe('task triggering', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
    })

    it('triggers the generate-spec task with correct payload', async () => {
      mockTasksTrigger.mockResolvedValueOnce({ id: 'run-xyz' } as never)
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      await POST(makeRequest(validBody))

      expect(mockTasksTrigger).toHaveBeenCalledWith('generate-spec', {
        projectId: 'project-123',
        roomId: 'project-123',
        chatHistory: validBody.chatHistory,
        nodes: validBody.nodes,
        edges: validBody.edges,
      })
    })

    it('returns 502 when task triggering fails', async () => {
      mockTasksTrigger.mockRejectedValueOnce(new Error('Trigger.dev unavailable'))

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body).toEqual({ error: 'Failed to start spec run' })
    })
  })

  describe('TaskRun persistence', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValue({ project: { id: 'project-123' }, isOwner: true } as never)
      mockTasksTrigger.mockResolvedValue({ id: 'run-xyz' } as never)
    })

    it('creates a TaskRun record with correct data', async () => {
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      await POST(makeRequest(validBody))

      expect(mockPrismaTaskRunCreate).toHaveBeenCalledWith({
        data: {
          runId: 'run-xyz',
          projectId: 'project-123',
          userId: 'user-abc',
        },
      })
    })

    it('returns 201 with runId on success', async () => {
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body).toEqual({ runId: 'run-xyz' })
    })

    it('returns 202 with trackingUnavailable when TaskRun persistence fails', async () => {
      mockPrismaTaskRunCreate.mockRejectedValueOnce(new Error('DB error'))

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(res.status).toBe(202)
      expect(body).toEqual({ runId: 'run-xyz', trackingUnavailable: true })
    })

    it('still returns the runId even when TaskRun persistence fails', async () => {
      mockPrismaTaskRunCreate.mockRejectedValueOnce(new Error('DB error'))

      const res = await POST(makeRequest(validBody))
      const body = await res.json()

      expect(body.runId).toBe('run-xyz')
    })
  })

  describe('roomId as projectId', () => {
    it('uses roomId as projectId in the task payload (never trusts client-supplied projectId)', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user-abc' } as never)
      mockGetProjectAccess.mockResolvedValueOnce({ project: { id: 'room-id-is-project-id' }, isOwner: true } as never)
      mockTasksTrigger.mockResolvedValueOnce({ id: 'run-1' } as never)
      mockPrismaTaskRunCreate.mockResolvedValueOnce({} as never)

      await POST(makeRequest({ ...validBody, roomId: 'room-id-is-project-id' }))

      expect(mockTasksTrigger).toHaveBeenCalledWith('generate-spec', expect.objectContaining({
        projectId: 'room-id-is-project-id',
        roomId: 'room-id-is-project-id',
      }))
    })
  })
})