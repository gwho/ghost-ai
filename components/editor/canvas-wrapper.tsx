"use client"

import { Component, type ReactNode } from 'react'
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react'
import { CanvasFlow } from '@/components/editor/canvas-flow'

class LiveblocksErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm text-copy-muted">
            Failed to connect to the canvas. Refresh to retry.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

interface CanvasWrapperProps {
  roomId: string
}

export function CanvasWrapper({ roomId }: CanvasWrapperProps) {
  return (
    <LiveblocksErrorBoundary>
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null, isThinking: false }}
        >
          <ClientSideSuspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-copy-muted">Connecting…</p>
              </div>
            }
          >
            <CanvasFlow />
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </LiveblocksErrorBoundary>
  )
}
