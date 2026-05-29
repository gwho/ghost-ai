"use client"

import '@xyflow/react/dist/style.css'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ConnectionMode,
} from '@xyflow/react'
import { useLiveblocksFlow } from '@liveblocks/react-flow'
import type { CanvasNode, CanvasEdge } from '@/types/canvas'

export function CanvasFlow() {
  const {
    nodes: rawNodes,
    edges: rawEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDelete,
  } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const nodes = rawNodes ?? []
  const edges = rawEdges ?? []

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDelete={onDelete}
      connectionMode={ConnectionMode.Loose}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} />
      <MiniMap />
    </ReactFlow>
  )
}
