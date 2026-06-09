import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Module mocks ---

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

// --- Imports (after mocks) ---

import { auth } from '@clerk/nextjs/server'
import { auth as triggerAuth } from '@trigger.dev/sdk'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/ai/spec/token/route'

// --- Helpers ---

function makeRequest(body: unknown, { malformed = false }: { malformed?: boolean } = {}) {
  const url = 'http://localhost/api/ai/spec/token'
  if (malformed) {
    return new NextRequest(url, {
      method: 'POST',
      body: '{ bad json',
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_RUN_ID = 'run-token-test-123'
const MOCK_USER_ID = 'user-456'

// --- Tests ---

describe('POST /api/ai/spec/token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: MOCK_USER_ID } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.taskRun.findUnique).mockResolvedValue({
      runId: MOCK_RUN_ID,
      userId: MOCK_USER_ID,
      projectId: 'proj-1',
      createdAt: new Date(),
    })
    vi.mocked(triggerAuth.createPublicToken).mockResolvedValue('public-token-xyz' as ReturnType<typeof triggerAuth.createPublicToken> extends Promise<infer T> ? T : never)
  })

  // --- Authentication ---

  it('returns 401 when no user is authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makeRequest({ runId: MOCK_RUN_ID }))
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

  it('returns 400 when body is a JSON array', async () => {
    const res = await POST(makeRequest(['runId-val']))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  it('returns 400 when body is null', async () => {
    const res = await POST(makeRequest(null))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  it('returns 400 when runId is missing from body', async () => {
    const res = await POST(makeRequest({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  it('returns 400 when runId is a number', async () => {
    const res = await POST(makeRequest({ runId: 42 }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  it('returns 400 when runId is an empty string', async () => {
    const res = await POST(makeRequest({ runId: '' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  it('returns 400 when runId is whitespace only', async () => {
    const res = await POST(makeRequest({ runId: '   ' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid runId' })
  })

  // --- Ownership checks ---

  it('returns 404 when no TaskRun exists for the runId', async () => {
    vi.mocked(prisma.taskRun.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest({ runId: MOCK_RUN_ID }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('returns 404 when TaskRun belongs to a different user', async () => {
    vi.mocked(prisma.taskRun.findUnique).mockResolvedValue({
      runId: MOCK_RUN_ID,
      userId: 'different-user-789',
      projectId: 'proj-1',
      createdAt: new Date(),
    })

    const res = await POST(makeRequest({ runId: MOCK_RUN_ID }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('does not reveal whether run exists when ownership check fails', async () => {
    // Both "not found" and "wrong user" must return the same 404 error
    vi.mocked(prisma.taskRun.findUnique).mockResolvedValue({
      runId: MOCK_RUN_ID,
      userId: 'attacker-user',
      projectId: 'proj-1',
      createdAt: new Date(),
    })

    const res = await POST(makeRequest({ runId: MOCK_RUN_ID }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Not found')
  })

  // --- Successful token issuance ---

  it('returns the public token when ownership check passes', async () => {
    const res = await POST(makeRequest({ runId: MOCK_RUN_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ token: 'public-token-xyz' })
  })

  it('queries prisma with the correct runId', async () => {
    await POST(makeRequest({ runId: MOCK_RUN_ID }))

    expect(prisma.taskRun.findUnique).toHaveBeenCalledWith({ where: { runId: MOCK_RUN_ID } })
  })

  it('issues token scoped to the specific run with 1h expiry', async () => {
    await POST(makeRequest({ runId: MOCK_RUN_ID }))

    expect(triggerAuth.createPublicToken).toHaveBeenCalledWith({
      scopes: { read: { runs: [MOCK_RUN_ID] } },
      expirationTime: '1h',
    })
  })

  it('does not issue a token that covers other runs', async () => {
    await POST(makeRequest({ runId: MOCK_RUN_ID }))

    const call = vi.mocked(triggerAuth.createPublicToken).mock.calls[0][0]
    const runs = call.scopes?.read?.runs ?? []
    expect(runs).toHaveLength(1)
    expect(runs[0]).toBe(MOCK_RUN_ID)
  })
})