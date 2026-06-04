"use client"

import { useOthers } from '@liveblocks/react'
import { useViewport } from '@xyflow/react'

export function LiveCursors() {
  const others = useOthers()
  const { x: translateX, y: translateY, zoom } = useViewport()

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {others.map((other) => {
        if (!other.presence.cursor || !other.info) return null

        const localX = other.presence.cursor.x * zoom + translateX
        const localY = other.presence.cursor.y * zoom + translateY

        return (
          <div
            key={other.connectionId}
            className="absolute pointer-events-none flex items-start gap-1"
            style={{ left: localX, top: localY }}
          >
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 0L0 14.766L4.188 10.578L6.578 16.313L8.625 15.46L6.14 9.469L11.797 9.375L0 0Z"
                fill={other.info.color}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="mt-1 px-1.5 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: other.info.color }}
            >
              {other.info.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
