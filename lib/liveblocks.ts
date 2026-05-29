import { Liveblocks } from '@liveblocks/node'

const CURSOR_COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#4ADE80', // green
  '#34D399', // emerald
  '#22D3EE', // cyan
  '#60A5FA', // blue
  '#818CF8', // indigo
  '#A78BFA', // violet
  '#F472B6', // pink
]

export function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

declare global {
  // eslint-disable-next-line no-var
  var _liveblocks: Liveblocks | undefined
}

export function getLiveblocksClient(): Liveblocks {
  if (globalThis._liveblocks) return globalThis._liveblocks
  const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })
  if (process.env.NODE_ENV !== 'production') globalThis._liveblocks = client
  return client
}
