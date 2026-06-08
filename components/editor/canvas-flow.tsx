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
import { useHistory, useCanUndo, useCanRedo, useUpdateMyPresence, useEventListener } from '@liveblocks/react'
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
import { validateAiStatusPayload } from '@/types/tasks'

const nodeTypes: NodeTypes = {
  canvasNode: CanvasNodeComponent,
}

const edgeTypes: EdgeTypes = {
  canvasEdge: CanvasEdgeComponent,
}

function createFallbackUuid() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function createNodeId(shape: string) {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : createFallbackUuid()
  return `${shape}-${uuid}`
}

interface CanvasFlowProps {
  projectId: string
  isTemplatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
  onSaveStatusChange: (status: SaveStatus) => void
  onManualSaveReady?: (fn: () => Promise<void>) => void
  isAiThinking?: boolean
  onAiStatus?: (event: { message: string; status: string }) => void
  onAiComplete?: () => void
}

export function CanvasFlow({ projectId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady, isAiThinking, onAiStatus, onAiComplete }: CanvasFlowProps) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner
        projectId={projectId}
        isTemplatesOpen={isTemplatesOpen}
        onTemplatesOpenChange={onTemplatesOpenChange}
        onSaveStatusChange={onSaveStatusChange}
        onManualSaveReady={onManualSaveReady}
        isAiThinking={isAiThinking}
        onAiStatus={onAiStatus}
        onAiComplete={onAiComplete}
      />
    </ReactFlowProvider>
  )
}

function CanvasFlowInner({ projectId, isTemplatesOpen, onTemplatesOpenChange, onSaveStatusChange, onManualSaveReady, isAiThinking, onAiStatus, onAiComplete }: CanvasFlowProps) {
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
  const [isAutosaveReady, setIsAutosaveReady] = useState(
    () => nodes.length > 0 || edges.length > 0,
  )

  const { undo, redo } = useHistory()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const updateMyPresence = useUpdateMyPresence()

  useEffect(() => {
    updateMyPresence({ thinking: isAiThinking ?? false })
  }, [isAiThinking, updateMyPresence])

  useEventListener(({ event }) => {
    const payload = validateAiStatusPayload(event)
    if (!payload) return
    onAiStatus?.({ message: payload.message, status: payload.status })
    if (payload.status === 'complete' || payload.status === 'error') {
      onAiComplete?.()
    }
  })

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
      const id = createNodeId(shape)

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
      const id = createNodeId(shape)
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
