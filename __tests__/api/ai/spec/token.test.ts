import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskRun: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@trigger.dev/sdk', () => ({
  auth: {
    createPublicToken: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { auth as triggerAuth } from '@trigger.dev/sdk'
import { POST } from '@/app/api/ai/spec/token/route'

const mockAuth = vi.mocked(auth)
const mockPrismaTaskRunFindUnique = vi.mocked(prisma.taskRun.findUnique)
const mockTriggerAuthCreatePublicToken = vi.mocked(triggerAuth.createPublicToken)

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/spec/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost/api/ai/spec/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid-json',
  })
}

describe('POST /api/ai/spec/token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never)

      const res = await POST(makeRequest({ runId: 'run-abc' }))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
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
      const req = new NextRequest('http://localhost/api/ai/spec/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })

    it('returns 400 when body is an array', async () => {
      const res = await POST(makeRequest([]))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })

    it('returns 400 when runId is missing', async () => {
      const res = await POST(makeRequest({}))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })

    it('returns 400 when runId is not a string', async () => {
      const res = await POST(makeRequest({ runId: 42 }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })

    it('returns 400 when runId is an empty string', async () => {
      const res = await POST(makeRequest({ runId: '' }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })

    it('returns 400 when runId is a whitespace-only string', async () => {
      const res = await POST(makeRequest({ runId: '   ' }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toEqual({ error: 'Missing or invalid runId' })
    })
  })

  describe('TaskRun ownership check', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    })

    it('returns 404 when TaskRun does not exist', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValueOnce(null)

      const res = await POST(makeRequest({ runId: 'run-nonexistent' }))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'Not found' })
    })

    it('returns 404 when TaskRun belongs to a different user', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValueOnce({
        runId: 'run-abc',
        userId: 'user-OTHER',
        projectId: 'project-123',
        createdAt: new Date(),
      } as never)

      const res = await POST(makeRequest({ runId: 'run-abc' }))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: 'Not found' })
    })

    it('returns 404 (not 403) even when run exists but belongs to different user (hides existence)', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValueOnce({
        runId: 'run-abc',
        userId: 'user-DIFFERENT',
        projectId: 'project-123',
        createdAt: new Date(),
      } as never)

      const res = await POST(makeRequest({ runId: 'run-abc' }))

      expect(res.status).toBe(404)
    })

    it('queries TaskRun by the correct runId', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValueOnce(null)

      await POST(makeRequest({ runId: 'run-specific-id' }))

      expect(mockPrismaTaskRunFindUnique).toHaveBeenCalledWith({ where: { runId: 'run-specific-id' } })
    })
  })

  describe('token issuance', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
      mockPrismaTaskRunFindUnique.mockResolvedValue({
        runId: 'run-abc',
        userId: 'user-abc',
        projectId: 'project-123',
        createdAt: new Date(),
      } as never)
    })

    it('creates a public token with correct scopes', async () => {
      mockTriggerAuthCreatePublicToken.mockResolvedValueOnce('tok_public_xyz' as never)

      await POST(makeRequest({ runId: 'run-abc' }))

      expect(mockTriggerAuthCreatePublicToken).toHaveBeenCalledWith({
        scopes: { read: { runs: ['run-abc'] } },
        expirationTime: '1h',
      })
    })

    it('returns the token on success', async () => {
      mockTriggerAuthCreatePublicToken.mockResolvedValueOnce('tok_public_xyz' as never)

      const res = await POST(makeRequest({ runId: 'run-abc' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ token: 'tok_public_xyz' })
    })

    it('scopes the token only to the specific runId requested', async () => {
      mockTriggerAuthCreatePublicToken.mockResolvedValueOnce('tok_scoped' as never)

      await POST(makeRequest({ runId: 'run-abc' }))

      const callArgs = mockTriggerAuthCreatePublicToken.mock.calls[0][0]
      expect(callArgs.scopes.read.runs).toHaveLength(1)
      expect(callArgs.scopes.read.runs[0]).toBe('run-abc')
    })

    it('sets token expiration to 1h', async () => {
      mockTriggerAuthCreatePublicToken.mockResolvedValueOnce('tok_short_lived' as never)

      await POST(makeRequest({ runId: 'run-abc' }))

      const callArgs = mockTriggerAuthCreatePublicToken.mock.calls[0][0]
      expect(callArgs.expirationTime).toBe('1h')
    })
  })
})