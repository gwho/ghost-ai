"use client"

import { Square, Diamond, Circle, Pill, Cylinder, Hexagon } from 'lucide-react'
import type { NodeShape } from '@/types/canvas'

interface ShapeConfig {
  shape: NodeShape
  icon: React.ReactNode
  label: string
  width: number
  height: number
}

const SHAPES: ShapeConfig[] = [
  { shape: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle', width: 160, height: 80 },
  { shape: 'diamond',   icon: <Diamond className="h-4 w-4" />, label: 'Diamond',   width: 120, height: 120 },
  { shape: 'circle',    icon: <Circle className="h-4 w-4" />,  label: 'Circle',    width: 80,  height: 80 },
  { shape: 'pill',      icon: <Pill className="h-4 w-4" />,    label: 'Pill',      width: 140, height: 60 },
  { shape: 'cylinder',  icon: <Cylinder className="h-4 w-4" />,label: 'Cylinder',  width: 100, height: 100 },
  { shape: 'hexagon',   icon: <Hexagon className="h-4 w-4" />, label: 'Hexagon',   width: 110, height: 110 },
]

export function ShapePanel() {
  function handleDragStart(e: React.DragEvent, config: ShapeConfig) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData(
      'application/ghost-shape',
      JSON.stringify({ shape: config.shape, width: config.width, height: config.height }),
    )
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-2 rounded-full bg-surface border border-surface-border shadow-lg">
      {SHAPES.map((config) => (
        <button
          key={config.shape}
          type="button"
          draggable
          onDragStart={(e) => handleDragStart(e, config)}
          title={config.label}
          className="flex items-center justify-center h-8 w-8 rounded-xl text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors cursor-grab active:cursor-grabbing"
        >
          {config.icon}
        </button>
      ))}
    </div>
  )
}
