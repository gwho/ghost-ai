"use client"

import { useOthers } from '@liveblocks/react'
import { useUser, UserButton } from '@clerk/nextjs'

function CollaboratorAvatar({
  name,
  avatar,
  color,
}: {
  name: string
  avatar: string
  color: string
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="w-7 h-7 rounded-full shrink-0 ring-2 ring-base overflow-hidden flex items-center justify-center text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
      title={name}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}

export function PresenceAvatars() {
  const others = useOthers()
  const { user } = useUser()

  // useOthers already excludes self; filter by Clerk ID as a safety guard
  const collaborators = others.filter((other) => other.id !== user?.id)
  const visible = collaborators.slice(0, 5)
  const overflow = Math.max(0, collaborators.length - 5)
  const hasCollaborators = collaborators.length > 0

  return (
    <div className="absolute top-14 right-3 z-10 flex items-center gap-2">
      {hasCollaborators && (
        <>
          <div className="flex items-center -space-x-2">
            {visible.map((other) =>
              other.info ? (
                <CollaboratorAvatar
                  key={other.connectionId}
                  name={other.info.name}
                  avatar={other.info.avatar}
                  color={other.info.color}
                />
              ) : null,
            )}
            {overflow > 0 && (
              <div className="w-7 h-7 rounded-full bg-elevated border border-surface-border flex items-center justify-center text-xs text-copy-muted font-medium ring-2 ring-base shrink-0">
                +{overflow}
              </div>
            )}
          </div>
          <div className="w-px h-5 bg-surface-border" />
        </>
      )}
      <UserButton />
    </div>
  )
}
