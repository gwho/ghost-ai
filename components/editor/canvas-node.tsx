"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, NodeResizer, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react'
import { NODE_COLORS, type NodeData, type NodeShape } from '@/types/canvas'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const HANDLES = (
  <>
    <Handle type="target" position={Position.Top} />
    <Handle type="target" position={Position.Left} />
    <Handle type="source" position={Position.Bottom} />
    <Handle type="source" position={Position.Right} />
  </>
)

export function CanvasNodeComponent({ id, data, selected }: NodeProps) {
  const { label, color, shape = 'rectangle' } = data as NodeData
  const pair = NODE_COLORS.find((c) => c.fill === color) ?? NODE_COLORS[0]
  const nodeShape = shape as NodeShape

  const { updateNodeData } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const originalLabelRef = useRef<string>('')

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const startEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    originalLabelRef.current = label ?? ''
    setDraft(label ?? '')
    setEditing(true)
  }, [label])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    updateNodeData(id, { label: e.target.value })
  }, [id, updateNodeData])

  const commitEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      setDraft(originalLabelRef.current)
      updateNodeData(id, { label: originalLabelRef.current })
      setEditing(false)
    }
  }, [id, updateNodeData])

  const activeColor = color ?? NODE_COLORS[0].fill

  const colorToolbar = (
    <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
      <div
        className="flex gap-1.5 px-2 py-1.5 bg-surface border border-surface-border rounded-full shadow-lg nodrag nopan"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {NODE_COLORS.map((c, i) => {
          const isActive = c.fill === activeColor
          return (
            <button
              key={c.fill}
              type="button"
              aria-label={`Color option ${i + 1}`}
              className="nodrag nopan w-5 h-5 rounded-full cursor-pointer transition-all"
              style={{
                backgroundColor: c.fill,
                outline: isActive ? `2px solid ${c.text}` : '2px solid transparent',
                outlineOffset: '2px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(c.text, 0.35)}`
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = ''
              }}
              onClick={(e) => {
                e.stopPropagation()
                updateNodeData(id, { color: c.fill })
              }}
            />
          )
        })}
      </div>
    </NodeToolbar>
  )

  const resizer = (
    <NodeResizer
      isVisible={!!selected}
      minWidth={80}
      minHeight={40}
      handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--accent-primary)' }}
      lineStyle={{ borderColor: 'var(--accent-primary)', opacity: 0.5 }}
    />
  )

  const editTextarea = (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={handleChange}
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      rows={1}
      aria-label="Node label"
      className="nodrag nopan resize-none bg-transparent text-center text-sm font-medium outline-none border-none w-full"
    />
  )

  function labelContent(text: string) {
    return text
      ? <span>{text}</span>
      : <span className="opacity-[0.35]">node</span>
  }

  // CSS shapes
  if (nodeShape === 'rectangle' || nodeShape === 'pill' || nodeShape === 'circle') {
    const radius = nodeShape === 'rectangle' ? 'rounded-xl' : 'rounded-full'
    const border = selected ? 'border border-brand' : 'border border-surface-border'
    return (
      <div
        style={{ backgroundColor: pair.fill, color: pair.text }}
        className={`w-full h-full flex items-center justify-center ${radius} ${border} text-sm font-medium px-3 text-center`}
        onDoubleClick={startEditing}
      >
        {colorToolbar}
        {resizer}
        {HANDLES}
        {editing ? editTextarea : labelContent(label)}
      </div>
    )
  }

  // SVG shapes
  const stroke = selected ? 'var(--accent-primary)' : 'var(--border-default)'
  const strokeWidth = selected ? 1.5 : 1

  if (nodeShape === 'diamond') {
    return (
      <div className="w-full h-full relative" style={{ color: pair.text }}>
        {colorToolbar}
        {resizer}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <polygon
            points="50,2 98,50 50,98 2,50"
            fill={pair.fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-medium text-center"
          style={{ padding: '0 25%' }}
          onDoubleClick={startEditing}
        >
          {editing ? editTextarea : labelContent(label)}
        </div>
        {HANDLES}
      </div>
    )
  }

  if (nodeShape === 'hexagon') {
    return (
      <div className="w-full h-full relative" style={{ color: pair.text }}>
        {colorToolbar}
        {resizer}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill={pair.fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-medium text-center px-6"
          onDoubleClick={startEditing}
        >
          {editing ? editTextarea : labelContent(label)}
        </div>
        {HANDLES}
      </div>
    )
  }

  // cylinder
  return (
    <div className="w-full h-full relative" style={{ color: pair.text }}>
      {colorToolbar}
      {resizer}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        {/* body */}
        <rect x="2" y="14" width="96" height="72" fill={pair.fill} stroke="none" />
        {/* bottom ellipse */}
        <ellipse cx="50" cy="86" rx="48" ry="12" fill={pair.fill} stroke={stroke} strokeWidth={strokeWidth} />
        {/* side lines */}
        <line x1="2" y1="14" x2="2" y2="86" stroke={stroke} strokeWidth={strokeWidth} />
        <line x1="98" y1="14" x2="98" y2="86" stroke={stroke} strokeWidth={strokeWidth} />
        {/* top ellipse — drawn last so it covers the body top edge */}
        <ellipse cx="50" cy="14" rx="48" ry="12" fill={pair.fill} stroke={stroke} strokeWidth={strokeWidth} />
      </svg>
      <div
        className="absolute flex items-center justify-center text-xs font-medium text-center px-4"
        style={{ inset: '14% 0 14%' }}
        onDoubleClick={startEditing}
      >
        {editing ? editTextarea : labelContent(label)}
      </div>
      {HANDLES}
    </div>
  )
}
