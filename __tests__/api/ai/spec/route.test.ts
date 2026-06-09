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
const mockPrismaTaskRunCreate = vi.mocked(prisma.taskRun.create)
const mockTasksTrigger = vi.mocked(tasks.trigger)
const mockGetProjectAccess = vi.mocked(getProjectAccess)

function makeRequest(body: unknown, options: { malformed?: boolean } = {}): NextRequest {
  if (options.malformed) {
    return new NextRequest('http://localhost/api/ai/spec', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest('http://localhost/api/ai/spec', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/ai/spec', () => {
  const validBody = {
    roomId: 'project-123',
    chatHistory: [{ sender: 'User', role: 'user', content: 'Build a CI/CD pipeline', timestamp: 1000 }],
    nodes: [{ id: 'node-1', data: { label: 'API Gateway' }, position: { x: 0, y: 0 } }],
    edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    mockGetProjectAccess.mockResolvedValue({
      project: { id: 'project-123' } as never,
      isOwner: true,
    })
    mockTasksTrigger.mockResolvedValue({ id: 'run-xyz' } as never)
    mockPrismaTaskRunCreate.mockResolvedValue({} as never)
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null } as never)

      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 401 when auth returns undefined userId', async () => {
      mockAuth.mockResolvedValue({ userId: undefined } as never)

      const res = await POST(makeRequest(validBody))

      expect(res.status).toBe(401)
    })
  })

  describe('request body validation', () => {
    it('returns 400 for malformed JSON', async () => {
      const res = await POST(makeRequest(null, { malformed: true }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Malformed JSON')
    })

    it('returns 400 when body is null', async () => {
      const res = await POST(makeRequest(null))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Request body must be a JSON object')
    })

    it('returns 400 when body is an array', async () => {
      const res = await POST(makeRequest([]))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Request body must be a JSON object')
    })

    it('returns 400 when body is a string (not an object)', async () => {
      // JSON.stringify("string") => '"string"' which parses as a string, not object
      const req = new NextRequest('http://localhost/api/ai/spec', {
        method: 'POST',
        body: '"just-a-string"',
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Request body must be a JSON object')
    })

    it('returns 400 when roomId is missing', async () => {
      const { roomId: _, ...bodyWithoutRoomId } = validBody
      const res = await POST(makeRequest(bodyWithoutRoomId))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid roomId')
    })

    it('returns 400 when roomId is not a string', async () => {
      const res = await POST(makeRequest({ ...validBody, roomId: 42 }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid roomId')
    })

    it('returns 400 when roomId is an empty string', async () => {
      const res = await POST(makeRequest({ ...validBody, roomId: '' }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid roomId')
    })

    it('returns 400 when chatHistory is missing', async () => {
      const { chatHistory: _, ...body } = validBody
      const res = await POST(makeRequest(body))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('chatHistory must be an array')
    })

    it('returns 400 when chatHistory is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, chatHistory: 'not-array' }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('chatHistory must be an array')
    })

    it('returns 400 when nodes is missing', async () => {
      const { nodes: _, ...body } = validBody
      const res = await POST(makeRequest(body))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('nodes must be an array')
    })

    it('returns 400 when nodes is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, nodes: {} }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('nodes must be an array')
    })

    it('returns 400 when edges is missing', async () => {
      const { edges: _, ...body } = validBody
      const res = await POST(makeRequest(body))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('edges must be an array')
    })

    it('returns 400 when edges is not an array', async () => {
      const res = await POST(makeRequest({ ...validBody, edges: null }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('edges must be an array')
    })

    it('accepts empty arrays for chatHistory, nodes, and edges', async () => {
      const res = await POST(makeRequest({ ...validBody, chatHistory: [], nodes: [], edges: [] }))

      expect(res.status).toBe(201)
    })
  })

  describe('project access', () => {
    it('returns 404 when project is not found or user has no access', async () => {
      mockGetProjectAccess.mockResolvedValue(null)

      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toBe('Not found')
    })

    it('uses roomId as projectId (never a client-supplied projectId)', async () => {
      await POST(makeRequest(validBody))

      expect(mockGetProjectAccess).toHaveBeenCalledWith('project-123')
    })
  })

  describe('task triggering', () => {
    it('returns 502 when tasks.trigger throws', async () => {
      mockTasksTrigger.mockRejectedValue(new Error('Trigger service unavailable'))

      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      expect(res.status).toBe(502)
      expect(data.error).toBe('Failed to start spec run')
    })

    it('passes correct payload to tasks.trigger', async () => {
      await POST(makeRequest(validBody))

      expect(mockTasksTrigger).toHaveBeenCalledWith('generate-spec', {
        projectId: 'project-123',
        roomId: 'project-123',
        chatHistory: validBody.chatHistory,
        nodes: validBody.nodes,
        edges: validBody.edges,
      })
    })
  })

  describe('successful flow', () => {
    it('returns 201 with runId on success', async () => {
      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.runId).toBe('run-xyz')
    })

    it('creates a TaskRun record in the database', async () => {
      await POST(makeRequest(validBody))

      expect(mockPrismaTaskRunCreate).toHaveBeenCalledWith({
        data: {
          runId: 'run-xyz',
          projectId: 'project-123',
          userId: 'user-abc',
        },
      })
    })
  })

  describe('partial failure handling', () => {
    it('returns 202 with trackingUnavailable when TaskRun persistence fails after trigger', async () => {
      mockPrismaTaskRunCreate.mockRejectedValue(new Error('DB write failed'))

      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      // Run was started but tracking failed
      expect(res.status).toBe(202)
      expect(data.runId).toBe('run-xyz')
      expect(data.trackingUnavailable).toBe(true)
    })

    it('still returns the runId when tracking persistence fails', async () => {
      mockPrismaTaskRunCreate.mockRejectedValue(new Error('DB connection error'))

      const res = await POST(makeRequest(validBody))
      const data = await res.json()

      expect(data.runId).toBe('run-xyz')
    })
  })
})