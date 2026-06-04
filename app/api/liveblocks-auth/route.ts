import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getProjectAccess } from '@/lib/project-access'
import { getLiveblocksClient, getCursorColor } from '@/lib/liveblocks'
import { AsyncTimeoutError, withTimeout } from '@/lib/async-timeout'
import { isTransientUpstreamError } from '@/lib/upstream-errors'

export const runtime = 'nodejs'

const LIVEBLOCKS_AUTH_ROUTE_TIMEOUT_MS = 8_000
const LIVEBLOCKS_AUTH_TIMEOUT_MESSAGE =
  'Liveblocks auth timed out while verifying project access'

export async function POST(request: NextRequest) {
  try {
    let room: string | undefined
    try {
      const body = await request.json()
      room = typeof body?.room === 'string' ? body.room : undefined
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!room) {
      return NextResponse.json({ error: 'Missing or invalid room' }, { status: 400 })
    }

    return await withTimeout(
      authorizeLiveblocksRoom(room),
      LIVEBLOCKS_AUTH_ROUTE_TIMEOUT_MS,
      LIVEBLOCKS_AUTH_TIMEOUT_MESSAGE,
    )
  } catch (error) {
    if (error instanceof AsyncTimeoutError) {
      console.error('[liveblocks-auth]', error.message)
      return NextResponse.json(
        {
          error:
            'Liveblocks auth timed out while verifying project access. Please retry.',
        },
        { status: 504 },
      )
    }

    if (isTransientUpstreamError(error)) {
      const message = error instanceof Error ? error.message : 'Upstream service unavailable'
      console.error('[liveblocks-auth]', message)
      return NextResponse.json(
        { error: 'Liveblocks auth could not verify project access. Please retry.' },
        { status: 503 },
      )
    }

    const message =
      error instanceof Error ? error.message : 'Internal server error'
    console.error('[liveblocks-auth]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function authorizeLiveblocksRoom(room: string): Promise<Response> {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const primaryAddr = user.emailAddresses.find(
    (ea) => ea.id === user.primaryEmailAddressId,
  )
  const email = (primaryAddr ?? user.emailAddresses[0])?.emailAddress?.toLowerCase()

  const access = await getProjectAccess(room, { userId: user.id, email })
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const lb = getLiveblocksClient()

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    'Anonymous'
  const avatar = user.imageUrl ?? ''
  const color = getCursorColor(user.id)

  const session = lb.prepareSession(user.id, {
    userInfo: { name, avatar, color },
  })
  session.allow(room, session.FULL_ACCESS)

  const { body, status } = await session.authorize()
  return new Response(body, { status })
}
