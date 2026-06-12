import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@trigger.dev/sdk', () => ({
  auth: {
    createPublicToken: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskRun: {
      findUnique: vi.fn(),
    },
  },
}))

import { auth } from '@clerk/nextjs/server'
import { auth as triggerAuth } from '@trigger.dev/sdk'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/ai/spec/token/route'

const mockAuth = vi.mocked(auth)
const mockTriggerCreatePublicToken = vi.mocked(triggerAuth.createPublicToken)
const mockPrismaTaskRunFindUnique = vi.mocked(prisma.taskRun.findUnique)

function makeRequest(body: unknown, options: { malformed?: boolean } = {}): NextRequest {
  if (options.malformed) {
    return new NextRequest('http://localhost/api/ai/spec/token', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest('http://localhost/api/ai/spec/token', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/ai/spec/token', () => {
  const validRunId = 'run-xyz-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user-abc' } as never)
    mockPrismaTaskRunFindUnique.mockResolvedValue({
      runId: validRunId,
      userId: 'user-abc',
      projectId: 'project-123',
      createdAt: new Date(),
    } as never)
    mockTriggerCreatePublicToken.mockResolvedValue('public-token-xyz' as never)
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null } as never)

      const res = await POST(makeRequest({ runId: validRunId }))
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 401 when userId is undefined', async () => {
      mockAuth.mockResolvedValue({ userId: undefined } as never)

      const res = await POST(makeRequest({ runId: validRunId }))

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
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when body is an array', async () => {
      const res = await POST(makeRequest([]))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when runId is missing from body', async () => {
      const res = await POST(makeRequest({}))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when runId is not a string', async () => {
      const res = await POST(makeRequest({ runId: 42 }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when runId is an empty string', async () => {
      const res = await POST(makeRequest({ runId: '' }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when runId is a whitespace-only string', async () => {
      const res = await POST(makeRequest({ runId: '   ' }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })

    it('returns 400 when runId is null', async () => {
      const res = await POST(makeRequest({ runId: null }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Missing or invalid runId')
    })
  })

  describe('ownership verification', () => {
    it('returns 404 when TaskRun does not exist', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValue(null as never)

      const res = await POST(makeRequest({ runId: validRunId }))
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error).toBe('Not found')
    })

    it('returns 404 when TaskRun belongs to a different user', async () => {
      mockPrismaTaskRunFindUnique.mockResolvedValue({
        runId: validRunId,
        userId: 'different-user',
        projectId: 'project-123',
      } as never)

      const res = await POST(makeRequest({ runId: validRunId }))
      const data = await res.json()

      // Returns 404 to not reveal whether the run exists at all
      expect(res.status).toBe(404)
      expect(data.error).toBe('Not found')
    })

    it('queries the database with the provided runId', async () => {
      await POST(makeRequest({ runId: validRunId }))

      expect(mockPrismaTaskRunFindUnique).toHaveBeenCalledWith({
        where: { runId: validRunId },
      })
    })
  })

  describe('token creation', () => {
    it('returns 200 with a token on success', async () => {
      const res = await POST(makeRequest({ runId: validRunId }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.token).toBe('public-token-xyz')
    })

    it('creates a token scoped to the specific runId', async () => {
      await POST(makeRequest({ runId: validRunId }))

      expect(mockTriggerCreatePublicToken).toHaveBeenCalledWith({
        scopes: { read: { runs: [validRunId] } },
        expirationTime: '1h',
      })
    })

    it('sets token expiration to 1 hour', async () => {
      await POST(makeRequest({ runId: validRunId }))

      const callArgs = mockTriggerCreatePublicToken.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('Expected createPublicToken to be called')
      expect(callArgs.expirationTime).toBe('1h')
    })

    it('scopes token to read-only access for the specific run', async () => {
      await POST(makeRequest({ runId: validRunId }))

      const callArgs = mockTriggerCreatePublicToken.mock.calls[0]?.[0]
      if (!callArgs) throw new Error('Expected createPublicToken to be called')
      expect(callArgs.scopes).toEqual({ read: { runs: [validRunId] } })
    })
  })

  describe('regression: token isolation between users', () => {
    it('user A cannot get a token for user B run', async () => {
      // User A is authenticated
      mockAuth.mockResolvedValue({ userId: 'user-a' } as never)
      // But the TaskRun belongs to user B
      mockPrismaTaskRunFindUnique.mockResolvedValue({
        runId: validRunId,
        userId: 'user-b',
        projectId: 'project-123',
      } as never)

      const res = await POST(makeRequest({ runId: validRunId }))
      const data = await res.json()

      expect(res.status).toBe(404)
      // Should NOT call createPublicToken for unauthorized access
      expect(mockTriggerCreatePublicToken).not.toHaveBeenCalled()
    })
  })
})
