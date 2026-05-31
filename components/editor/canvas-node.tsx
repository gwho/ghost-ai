"use client"

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NODE_COLORS, type NodeData } from '@/types/canvas'

export function CanvasNodeComponent({ data }: NodeProps) {
  const { label, color } = data as NodeData
  const pair = NODE_COLORS.find((c) => c.fill === color) ?? NODE_COLORS[0]

  return (
    <div
      style={{ backgroundColor: pair.fill, color: pair.text }}
      className="w-full h-full flex items-center justify-center rounded-xl border border-surface-border text-sm font-medium px-3 text-center"
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      {label ? (
        <span>{label}</span>
      ) : (
        <span style={{ opacity: 0.35 }}>node</span>
      )}
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
