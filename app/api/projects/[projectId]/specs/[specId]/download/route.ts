import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getProjectAccess } from '@/lib/project-access'

type Params = { params: Promise<{ projectId: string; specId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, specId } = await params

  const access = await getProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const spec = await prisma.projectSpec.findFirst({
    where: { id: specId, projectId },
  })
  if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let blobResult
  try {
    blobResult = await get(spec.filePath, { access: 'private' })
    if (!blobResult) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (error) {
    console.error('[spec-download] failed to fetch blob', error)
    return NextResponse.json({ error: 'Failed to retrieve spec file' }, { status: 503 })
  }

  const text = await new Response(blobResult.stream).text()

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="spec-${specId}.md"`,
    },
  })
}
