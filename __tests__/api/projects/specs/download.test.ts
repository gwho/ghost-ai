import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Module mocks ---

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

// --- Imports (after mocks) ---

import { auth } from '@clerk/nextjs/server'
import { get as blobGet } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'
import { GET } from '@/app/api/projects/[projectId]/specs/[specId]/download/route'

// --- Helpers ---

function makeRequest() {
  return new NextRequest('http://localhost/api/projects/proj-1/specs/spec-abc/download')
}

function makeParams(projectId: string, specId: string) {
  return { params: Promise.resolve({ projectId, specId }) }
}

const SPEC_MARKDOWN = '# My Spec\n\nThis is the spec content.'

function makeBlobResult(content: string) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  return {
    url: 'https://blob.vercel.com/specs/proj-1/spec-abc.md',
    pathname: 'specs/proj-1/spec-abc.md',
    contentType: 'text/markdown',
    contentDisposition: '',
    size: bytes.length,
    uploadedAt: new Date(),
    stream,
    text: async () => content,
    json: async () => ({}),
    arrayBuffer: async () => bytes.buffer,
    blob: async () => new Blob([bytes]),
  }
}

const mockSpec = {
  id: 'spec-abc',
  projectId: 'proj-1',
  filePath: 'https://blob.vercel.com/specs/proj-1/spec-abc.md',
  createdAt: new Date(),
}

const mockAccess = {
  project: { id: 'proj-1', name: 'Test', ownerId: 'user-1' },
  isOwner: true,
}

// --- Tests ---

describe('GET /api/projects/[projectId]/specs/[specId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    vi.mocked(getProjectAccess).mockResolvedValue(mockAccess as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.projectSpec.findFirst).mockResolvedValue(mockSpec as ReturnType<typeof prisma.projectSpec.findFirst> extends Promise<infer T> ? T : never)
    vi.mocked(blobGet).mockResolvedValue(makeBlobResult(SPEC_MARKDOWN) as ReturnType<typeof blobGet> extends Promise<infer T> ? T : never)
  })

  // --- Authentication ---

  it('returns 401 when no user is authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  // --- Project access control ---

  it('returns 401 when project access check fails', async () => {
    vi.mocked(getProjectAccess).mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('calls getProjectAccess with projectId from route params', async () => {
    await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))

    expect(getProjectAccess).toHaveBeenCalledWith('proj-1')
  })

  // --- Spec ownership ---

  it('returns 404 when spec is not found', async () => {
    vi.mocked(prisma.projectSpec.findFirst).mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('queries prisma with both specId and projectId to prevent cross-project access', async () => {
    await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))

    expect(prisma.projectSpec.findFirst).toHaveBeenCalledWith({
      where: { id: 'spec-abc', projectId: 'proj-1' },
    })
  })

  // --- Blob retrieval ---

  it('fetches blob with private access mode', async () => {
    await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))

    expect(blobGet).toHaveBeenCalledWith(mockSpec.filePath, { access: 'private' })
  })

  it('returns 404 when blob returns falsy result', async () => {
    vi.mocked(blobGet).mockResolvedValue(null as ReturnType<typeof blobGet> extends Promise<infer T> ? T : never)

    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'File not found' })
  })

  it('returns 503 when blob.get throws', async () => {
    vi.mocked(blobGet).mockRejectedValue(new Error('Blob storage unavailable'))

    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toEqual({ error: 'Failed to retrieve spec file' })
  })

  // --- Response headers ---

  it('returns content as text/markdown with charset', async () => {
    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))

    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
  })

  it('sets Content-Disposition attachment header with specId in filename', async () => {
    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))

    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="spec-spec-abc.md"')
  })

  // --- Response body ---

  it('returns the Markdown content from the blob', async () => {
    const res = await GET(makeRequest(), makeParams('proj-1', 'spec-abc'))
    const text = await res.text()

    expect(text).toBe(SPEC_MARKDOWN)
  })

  // --- Security: cross-project access attempt ---

  it('prevents accessing a spec from a different project by verifying both ids', async () => {
    // spec-abc belongs to proj-1 but attacker requests under proj-999
    vi.mocked(getProjectAccess).mockResolvedValue({
      project: { id: 'proj-999', name: 'Other', ownerId: 'user-2' },
      isOwner: true,
    } as ReturnType<typeof getProjectAccess> extends Promise<infer T> ? T : never)
    vi.mocked(prisma.projectSpec.findFirst).mockResolvedValue(null) // spec not in proj-999

    const res = await GET(makeRequest(), makeParams('proj-999', 'spec-abc'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })
})