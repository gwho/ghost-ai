"use client"

import { useState, useRef, useEffect } from 'react'
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import type { EdgeData } from '@/types/canvas'

export function CanvasEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const { label = '' } = (data as EdgeData) ?? {}
  const { updateEdgeData } = useReactFlow()
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const isActive = hovered || !!selected
  const strokeColor = isActive ? 'var(--text-secondary)' : 'var(--border-subtle)'
  const markerId = `canvas-arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 6"
          refX="9"
          refY="3"
          markerWidth="8"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 3 L 0 6 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* wide invisible path for easier hover and click */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        stroke="white"
        strokeWidth={16}
        style={{ pointerEvents: 'all' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="react-flow__edge-interaction"
      />

      {/* visible edge path */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        style={{ transition: 'stroke 0.15s', pointerEvents: 'none' }}
        className="react-flow__edge-path"
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          tabIndex={0}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraft(label)
            setEditing(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && selected) {
              e.stopPropagation()
              setDraft(label)
              setEditing(true)
            }
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {editing ? (
            <input
              ref={inputRef}
              aria-label="Edit edge label"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                updateEdgeData(id, { label: e.target.value })
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="nodrag nopan bg-surface border border-surface-border rounded-full px-2 py-0.5 text-xs text-copy-primary outline-none text-center"
              style={{ width: `${Math.max((draft.length || 4) * 9, 60)}px` }}
            />
          ) : label ? (
            <span className="bg-surface border border-surface-border rounded-full px-2 py-0.5 text-xs text-copy-primary select-none cursor-pointer">
              {label}
            </span>
          ) : isActive ? (
            <span className="text-xs text-copy-faint select-none" style={{ pointerEvents: 'none' }}>
              label
            </span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
