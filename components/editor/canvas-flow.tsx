"use client"

import '@xyflow/react/dist/style.css'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import { useLiveblocksFlow } from '@liveblocks/react-flow'
import type { CanvasNode, CanvasEdge, NodeShape } from '@/types/canvas'
import { NODE_COLORS } from '@/types/canvas'
import { CanvasNodeComponent } from '@/components/editor/canvas-node'
import { ShapePanel } from '@/components/editor/shape-panel'

const nodeTypes: NodeTypes = {
  canvasNode: CanvasNodeComponent,
}

export function CanvasFlow() {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner />
    </ReactFlowProvider>
  )
}

function CanvasFlowInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDelete,
  } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const { screenToFlowPosition } = useReactFlow()
  const counter = useRef(0)

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Must match effectAllowed='copy' set in ShapePanel's onDragStart.
    // A mismatch (e.g. 'move') causes browsers to set dropEffect='none'
    // and suppress the drop event entirely.
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      // stopPropagation prevents this handler firing twice — both the wrapper
      // div and <ReactFlow> have onDrop for belt-and-suspenders reliability.
      e.stopPropagation()
      const raw = e.dataTransfer.getData('application/ghost-shape')
      if (!raw) return

      let shape: string, width: number, height: number
      try {
        const parsed = JSON.parse(raw)
        shape = parsed?.shape
        width = parsed?.width
        height = parsed?.height
      } catch {
        return
      }
      if (
        typeof shape !== 'string' ||
        !['rectangle', 'diamond', 'circle', 'pill', 'cylinder', 'hexagon'].includes(shape) ||
        typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
        typeof height !== 'number' || !Number.isFinite(height) || height <= 0
      ) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      counter.current += 1
      const id = `${shape}-${Date.now()}-${counter.current}`

      const newNode: CanvasNode = {
        id,
        type: 'canvasNode',
        position,
        data: { label: '', color: NODE_COLORS[0].fill, shape },
        width,
        height,
      }

      onNodesChange([{ type: 'add', item: newNode }])
    },
    [screenToFlowPosition, onNodesChange],
  )

  const onCreateShape = useCallback(
    (shape: NodeShape, width: number, height: number) => {
      // Place keyboard-created nodes at the viewport centre in canvas coordinates.
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      counter.current += 1
      const id = `${shape}-${Date.now()}-${counter.current}`
      const newNode: CanvasNode = {
        id,
        type: 'canvasNode',
        position,
        data: { label: '', color: NODE_COLORS[0].fill, shape },
        width,
        height,
      }
      onNodesChange([{ type: 'add', item: newNode }])
    },
    [screenToFlowPosition, onNodesChange],
  )

  return (
    // Handlers sit on both the wrapper div and <ReactFlow> so the drop is
    // caught regardless of which layer the browser fires the event on first.
    <div
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 1.5, stroke: 'var(--border-subtle)' },
        }}
        style={{ background: 'transparent' }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap />
      </ReactFlow>
      <ShapePanel onCreateShape={onCreateShape} />
    </div>
  )
}
