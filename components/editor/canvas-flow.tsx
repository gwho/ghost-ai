"use client"

import '@xyflow/react/dist/style.css'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useHistory, useCanUndo, useCanRedo, useUpdateMyPresence } from '@liveblocks/react'
import type { CanvasNode, CanvasEdge, NodeShape } from '@/types/canvas'
import { NODE_COLORS } from '@/types/canvas'
import { CanvasNodeComponent } from '@/components/editor/canvas-node'
import { CanvasEdgeComponent } from '@/components/editor/canvas-edge'
import { ShapePanel } from '@/components/editor/shape-panel'
import { CanvasControls } from '@/components/editor/canvas-controls'
import { StarterTemplatesModal } from '@/components/editor/starter-templates-modal'
import type { CanvasTemplate } from '@/components/editor/starter-templates'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { PresenceAvatars } from '@/components/editor/presence-avatars'
import { LiveCursors } from '@/components/editor/live-cursors'
import { useCanvasAutosave, type SaveStatus } from '@/hooks/use-canvas-autosave'

const nodeTypes: NodeTypes = {
  canvasNode: CanvasNodeComponent,
}

const edgeTypes: EdgeTypes = {
  canvasEdge: CanvasEdgeComponent,
}

interface CanvasFlowProps {
  projectId: string
  isTemplatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
  onSaveStatusChange: (status: SaveStatus) => void
  onManualSaveReady?: (fn: () => Promise<void>) => void
}

export function CanvasFlow({ projectId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady }: CanvasFlowProps) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner
        projectId={projectId}
        isTemplatesOpen={isTemplatesOpen}
        onTemplatesOpenChange={onTemplatesOpenChange}
        onSaveStatusChange={onSaveStatusChange}
        onManualSaveReady={onManualSaveReady}
      />
    </ReactFlowProvider>
  )
}

function CanvasFlowInner({ projectId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady }: CanvasFlowProps) {
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
  const [isAutosaveReady, setIsAutosaveReady] = useState(
    () => nodes.length > 0 || edges.length > 0,
  )

  const { undo, redo } = useHistory()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const updateMyPresence = useUpdateMyPresence()

  useKeyboardShortcuts(reactFlow, undo, redo)

  // Load saved canvas on mount if the room is empty (no active collaboration)
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    if (nodes.length > 0 || edges.length > 0) {
      // Liveblocks already has nodes (collaborative session) — fit to show them
      requestAnimationFrame(() => reactFlow.fitView())
      return
    }
    fetch(`/api/projects/${projectId}/canvas`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.nodes?.length && !data?.edges?.length) return
        onNodesChange(data.nodes.map((n: CanvasNode) => ({ type: 'add' as const, item: n })))
        onEdgesChange(data.edges.map((e: CanvasEdge) => ({ type: 'add' as const, item: e })))
        requestAnimationFrame(() => reactFlow.fitView())
      })
      .catch(() => {})
      .finally(() => {
        setIsAutosaveReady(true)
      })
  // intentional empty deps — run once after room is fully synced (suspense: true guarantees this)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { saveStatus, save } = useCanvasAutosave(projectId, nodes, edges, isAutosaveReady)

  useEffect(() => {
    onSaveStatusChange(saveStatus)
  }, [saveStatus, onSaveStatusChange])

  useEffect(() => {
    onManualSaveReady?.(save)
  }, [onManualSaveReady, save])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateMyPresence({ cursor: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
    },
    [updateMyPresence, screenToFlowPosition],
  )

  const onMouseLeave = useCallback(() => {
    updateMyPresence({ cursor: null })
  }, [updateMyPresence])

  const loadTemplate = useCallback(
    (template: CanvasTemplate) => {
      onNodesChange([
        ...nodes.map((n) => ({ type: 'remove' as const, id: n.id })),
        ...template.nodes.map((n) => ({ type: 'add' as const, item: n })),
      ])
      onEdgesChange([
        ...edges.map((e) => ({ type: 'remove' as const, id: e.id })),
        ...template.edges.map((e) => ({ type: 'add' as const, item: e })),
      ])
      requestAnimationFrame(() => {
        reactFlow.fitView({ duration: 200 })
      })
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

      const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const position = { x: canvasPos.x - width / 2, y: canvasPos.y - height / 2 }
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
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
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
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: 'canvasEdge' }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap position="bottom-right" />
      </ReactFlow>
      <LiveCursors />
      <CanvasControls undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
      <ShapePanel onCreateShape={onCreateShape} />
      <PresenceAvatars />
      <StarterTemplatesModal
        open={isTemplatesOpen}
        onOpenChange={onTemplatesOpenChange}
        onImport={loadTemplate}
      />
    </div>
  )
}
