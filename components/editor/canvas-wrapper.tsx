"use client"

import { Component, type ReactNode } from 'react'
import { ClientSideSuspense } from '@liveblocks/react'
import { CanvasFlow } from '@/components/editor/canvas-flow'
import type { SaveStatus } from '@/hooks/use-canvas-autosave'

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
  isAiThinking?: boolean
  onAiStatus?: (event: { message: string; status: string }) => void
  onAiComplete?: () => void
}

export function CanvasWrapper({ roomId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady, isAiThinking, onAiStatus, onAiComplete }: CanvasWrapperProps) {
  return (
    <LiveblocksErrorBoundary>
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
          isAiThinking={isAiThinking}
          onAiStatus={onAiStatus}
          onAiComplete={onAiComplete}
        />
      </ClientSideSuspense>
    </LiveblocksErrorBoundary>
  )
}
