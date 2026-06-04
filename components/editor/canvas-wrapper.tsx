"use client"

import { Component, type ReactNode } from 'react'
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react'
import { CanvasFlow } from '@/components/editor/canvas-flow'
import type { SaveStatus } from '@/hooks/use-canvas-autosave'

async function authorizeLiveblocks(room?: string) {
  const response = await fetch('/api/liveblocks-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room }),
  })

  if (response.ok) {
    return response.json()
  }

  let message = 'Unable to connect to the canvas.'
  try {
    const body = await response.json()
    if (typeof body?.error === 'string') message = body.error
  } catch {
    // Keep the generic message when the server returns a non-JSON error body.
  }

  if ([400, 401, 403, 404, 503, 504].includes(response.status)) {
    return { error: 'forbidden', reason: message }
  }

  throw new Error(message)
}

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
  isTemplatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
  onSaveStatusChange: (status: SaveStatus) => void
  onManualSaveReady?: (fn: () => Promise<void>) => void
}

export function CanvasWrapper({ roomId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady }: CanvasWrapperProps) {
  return (
    <LiveblocksErrorBoundary>
      <LiveblocksProvider authEndpoint={authorizeLiveblocks}>
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null, thinking: false }}
        >
          <ClientSideSuspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-copy-muted">Connecting…</p>
              </div>
            }
          >
            <CanvasFlow
              projectId={roomId}
              isTemplatesOpen={isTemplatesOpen}
              onTemplatesOpenChange={onTemplatesOpenChange}
              onSaveStatusChange={onSaveStatusChange}
              onManualSaveReady={onManualSaveReady}
            />
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </LiveblocksErrorBoundary>
  )
}
