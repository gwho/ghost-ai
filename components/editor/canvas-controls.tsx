"use client"

import { Minus, Plus, Scan, Undo2, Redo2 } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'

interface CanvasControlsProps {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

function ControlButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg p-1.5 text-copy-primary hover:bg-surface-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export function CanvasControls({ undo, redo, canUndo, canRedo }: CanvasControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-6 left-6 z-10 flex items-center bg-surface border border-surface-border rounded-xl px-1.5 py-1.5 shadow-lg gap-0.5">
      <ControlButton onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
        <Minus size={14} />
      </ControlButton>
      <ControlButton onClick={() => fitView({ duration: 200 })} title="Fit view">
        <Scan size={14} />
      </ControlButton>
      <ControlButton onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
        <Plus size={14} />
      </ControlButton>

      <div className="w-px h-4 bg-surface-border mx-1" />

      <ControlButton onClick={undo} disabled={!canUndo} title="Undo">
        <Undo2 size={14} />
      </ControlButton>
      <ControlButton onClick={redo} disabled={!canRedo} title="Redo">
        <Redo2 size={14} />
      </ControlButton>
    </div>
  )
}
