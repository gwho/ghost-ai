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
  type EdgeTypes,
} from '@xyflow/react'
import { useLiveblocksFlow } from '@liveblocks/react-flow'
import { useHistory, useCanUndo, useCanRedo } from '@liveblocks/react'
import type { CanvasNode, CanvasEdge, NodeShape } from '@/types/canvas'
import { NODE_COLORS } from '@/types/canvas'
import { CanvasNodeComponent } from '@/components/editor/canvas-node'
import { CanvasEdgeComponent } from '@/components/editor/canvas-edge'
import { ShapePanel } from '@/components/editor/shape-panel'
import { CanvasControls } from '@/components/editor/canvas-controls'
import { StarterTemplatesModal } from '@/components/editor/starter-templates-modal'
import type { CanvasTemplate } from '@/components/editor/starter-templates'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const nodeTypes: NodeTypes = {
  canvasNode: CanvasNodeComponent,
}

const edgeTypes: EdgeTypes = {
  canvasEdge: CanvasEdgeComponent,
}

interface CanvasFlowProps {
  isTemplatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
}

export function CanvasFlow({ isTemplatesOpen, onTemplatesOpenChange }: CanvasFlowProps) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner
        isTemplatesOpen={isTemplatesOpen}
        onTemplatesOpenChange={onTemplatesOpenChange}
      />
    </ReactFlowProvider>
  )
}

function CanvasFlowInner({ isTemplatesOpen, onTemplatesOpenChange }: CanvasFlowProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDelete,
  } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const reactFlow = useReactFlow()
  const { screenToFlowPosition } = reactFlow
  const counter = useRef(0)

  const { undo, redo } = useHistory()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  useKeyboardShortcuts(reactFlow, undo, redo)

  const loadTemplate = useCallback(
    (template: CanvasTemplate) => {
      onNodesChange(nodes.map((n) => ({ type: 'remove' as const, id: n.id })))
      onEdgesChange(edges.map((e) => ({ type: 'remove' as const, id: e.id })))
      onNodesChange(template.nodes.map((n) => ({ type: 'add' as const, item: n })))
      onEdgesChange(template.edges.map((e) => ({ type: 'add' as const, item: e })))
      window.setTimeout(() => reactFlow.fitView({ duration: 200 }), 0)
    },
    [nodes, edges, onNodesChange, onEdgesChange, reactFlow],
  )

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
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: 'canvasEdge' }}
        style={{ background: 'transparent' }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap position="bottom-right" />
      </ReactFlow>
      <CanvasControls undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
      <ShapePanel onCreateShape={onCreateShape} />
      <StarterTemplatesModal
        open={isTemplatesOpen}
        onOpenChange={onTemplatesOpenChange}
        onImport={loadTemplate}
      />
    </div>
  )
}
