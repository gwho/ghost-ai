"use client"

import { useEffect, useState } from 'react'
import { Square, Diamond, Circle, Pill, Cylinder, Hexagon } from 'lucide-react'
import type { NodeShape } from '@/types/canvas'

interface ShapeConfig {
  shape: NodeShape
  icon: React.ReactNode
  label: string
  width: number
  height: number
}

interface ShapePanelProps {
  onCreateShape?: (shape: NodeShape, width: number, height: number) => void
}

const SHAPES: ShapeConfig[] = [
  { shape: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle', width: 160, height: 80 },
  { shape: 'diamond',   icon: <Diamond className="h-4 w-4" />, label: 'Diamond',   width: 120, height: 120 },
  { shape: 'circle',    icon: <Circle className="h-4 w-4" />,  label: 'Circle',    width: 80,  height: 80 },
  { shape: 'pill',      icon: <Pill className="h-4 w-4" />,    label: 'Pill',      width: 140, height: 60 },
  { shape: 'cylinder',  icon: <Cylinder className="h-4 w-4" />,label: 'Cylinder',  width: 100, height: 100 },
  { shape: 'hexagon',   icon: <Hexagon className="h-4 w-4" />, label: 'Hexagon',   width: 110, height: 110 },
]

// Renders just the shape outline — used for the drag ghost preview.
function ShapeGhost({ shape }: { shape: NodeShape }) {
  const fill = 'var(--bg-subtle)'
  const stroke = 'var(--border-subtle)'

  if (shape === 'rectangle') {
    return <div className="w-full h-full rounded-xl border border-subtle-border" style={{ backgroundColor: fill }} />
  }
  if (shape === 'pill' || shape === 'circle') {
    return <div className="w-full h-full rounded-full border border-subtle-border" style={{ backgroundColor: fill }} />
  }
  if (shape === 'diamond') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polygon points="50,2 98,50 50,98 2,50" fill={fill} stroke={stroke} strokeWidth={1} />
      </svg>
    )
  }
  if (shape === 'hexagon') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polygon points="50,2 95,26 95,74 50,98 5,74 5,26" fill={fill} stroke={stroke} strokeWidth={1} />
      </svg>
    )
  }
  // cylinder
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
      <rect x="2" y="14" width="96" height="72" fill={fill} stroke="none" />
      <ellipse cx="50" cy="86" rx="48" ry="12" fill={fill} stroke={stroke} strokeWidth={1} />
      <line x1="2" y1="14" x2="2" y2="86" stroke={stroke} strokeWidth={1} />
      <line x1="98" y1="14" x2="98" y2="86" stroke={stroke} strokeWidth={1} />
      <ellipse cx="50" cy="14" rx="48" ry="12" fill={fill} stroke={stroke} strokeWidth={1} />
    </svg>
  )
}

interface DragState {
  config: ShapeConfig
  x: number
  y: number
}

export function ShapePanel({ onCreateShape }: ShapePanelProps) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const isDragging = dragState !== null

  // Track cursor position during drag via document-level dragover.
  useEffect(() => {
    if (!isDragging) return
    const onDragOver = (e: DragEvent) => {
      setDragState((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
    }
    document.addEventListener('dragover', onDragOver)
    return () => document.removeEventListener('dragover', onDragOver)
  }, [isDragging])

  function handleDragStart(e: React.DragEvent, config: ShapeConfig) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData(
      'application/ghost-shape',
      JSON.stringify({ shape: config.shape, width: config.width, height: config.height }),
    )
    // Replace the default browser drag image with an invisible element so only
    // our custom ghost preview is visible during the drag.
    const empty = document.createElement('div')
    empty.style.cssText = 'position:fixed;top:-1000px;left:-1000px;width:1px;height:1px'
    document.body.appendChild(empty)
    e.dataTransfer.setDragImage(empty, 0, 0)
    requestAnimationFrame(() => document.body.removeChild(empty))
    setDragState({ config, x: e.clientX, y: e.clientY })
  }

  function handleDragEnd() {
    setDragState(null)
  }

  return (
    <>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-2 rounded-full bg-surface border border-surface-border shadow-lg">
        {SHAPES.map((config) => (
          <button
            key={config.shape}
            type="button"
            draggable
            aria-label={config.label}
            onDragStart={(e) => handleDragStart(e, config)}
            onDragEnd={handleDragEnd}
            onClick={() => onCreateShape?.(config.shape, config.width, config.height)}
            className="flex items-center justify-center h-8 w-8 rounded-xl text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors cursor-grab active:cursor-grabbing"
          >
            {config.icon}
          </button>
        ))}
      </div>

      {/* Drag ghost preview — follows the cursor at the dragged shape's default dimensions */}
      {dragState && (
        <div
          style={{
            position: 'fixed',
            left: dragState.x - dragState.config.width / 2,
            top: dragState.y - dragState.config.height / 2,
            width: dragState.config.width,
            height: dragState.config.height,
            pointerEvents: 'none',
            opacity: 0.65,
            zIndex: 9999,
          }}
        >
          <ShapeGhost shape={dragState.config.shape} />
        </div>
      )}
    </>
  )
}
