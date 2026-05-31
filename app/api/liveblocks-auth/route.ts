import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { LiveblocksError } from '@liveblocks/node'
import { getProjectAccess } from '@/lib/project-access'
import { getLiveblocksClient, getCursorColor } from '@/lib/liveblocks'

export async function POST(request: NextRequest) {
  try {
    let room: string | undefined
    try {
      const body = await request.json()
      room = body?.room
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!room) {
      return NextResponse.json({ error: 'Missing room' }, { status: 400 })
    }

    const access = await getProjectAccess(room)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const lb = getLiveblocksClient()

    try {
      await lb.getOrCreateRoom(room, { defaultAccesses: [] })
    } catch (error) {
      if (error instanceof LiveblocksError) {
        return new Response(JSON.stringify({ error: error.message }), { status: error.status })
      }
      throw error
    }

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    console.error('[liveblocks-auth]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
