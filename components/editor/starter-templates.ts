import type { CanvasNode, CanvasEdge } from '@/types/canvas'
import { NODE_COLORS } from '@/types/canvas'

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

function makeNode(
  id: string,
  label: string,
  x: number,
  y: number,
  colorIndex: number,
  shape: CanvasNode['data']['shape'] = 'rectangle',
  width = 140,
  height = 44,
): CanvasNode {
  return {
    id,
    type: 'canvasNode',
    position: { x, y },
    data: { label, color: NODE_COLORS[colorIndex].fill, shape },
    width,
    height,
  }
}

function makeEdge(id: string, source: string, target: string): CanvasEdge {
  return { id, type: 'canvasEdge', source, target, data: {} }
}

const microservicesTemplate: CanvasTemplate = {
  id: 'microservices',
  name: 'Microservices Architecture',
  description: 'API Gateway routing to independent services with their own databases.',
  nodes: [
    makeNode('ms-gateway', 'API Gateway', 300, 0, 1, 'rectangle', 160, 44),
    makeNode('ms-auth', 'Auth Service', 0, 120, 2, 'rectangle'),
    makeNode('ms-user', 'User Service', 200, 120, 3, 'rectangle'),
    makeNode('ms-product', 'Product Service', 400, 120, 4, 'rectangle'),
    makeNode('ms-order', 'Order Service', 600, 120, 6, 'rectangle'),
    makeNode('ms-db-user', 'User DB', 200, 260, 7, 'cylinder', 140, 44),
    makeNode('ms-db-product', 'Product DB', 400, 260, 5, 'cylinder', 140, 44),
    makeNode('ms-queue', 'Message Bus', 600, 260, 0, 'pill', 160, 44),
  ],
  edges: [
    makeEdge('e-gw-auth', 'ms-gateway', 'ms-auth'),
    makeEdge('e-gw-user', 'ms-gateway', 'ms-user'),
    makeEdge('e-gw-product', 'ms-gateway', 'ms-product'),
    makeEdge('e-gw-order', 'ms-gateway', 'ms-order'),
    makeEdge('e-user-db', 'ms-user', 'ms-db-user'),
    makeEdge('e-product-db', 'ms-product', 'ms-db-product'),
    makeEdge('e-order-queue', 'ms-order', 'ms-queue'),
  ],
}

const cicdTemplate: CanvasTemplate = {
  id: 'cicd-pipeline',
  name: 'CI/CD Pipeline',
  description: 'Code commit triggers automated build, test, and deploy stages.',
  nodes: [
    makeNode('ci-repo', 'Code Repo', 0, 60, 1, 'cylinder', 140, 44),
    makeNode('ci-runner', 'CI Runner', 200, 60, 2, 'rectangle'),
    makeNode('ci-build', 'Build', 400, 0, 3, 'rectangle', 120, 44),
    makeNode('ci-test', 'Test Suite', 400, 120, 4, 'rectangle', 120, 44),
    makeNode('ci-registry', 'Docker Registry', 600, 60, 6, 'cylinder', 160, 44),
    makeNode('ci-staging', 'Staging Deploy', 800, 0, 7, 'rectangle', 160, 44),
    makeNode('ci-prod', 'Production Deploy', 800, 120, 5, 'rectangle', 160, 44),
    makeNode('ci-monitor', 'Monitoring', 1000, 60, 0, 'hexagon', 140, 44),
  ],
  edges: [
    makeEdge('e-repo-runner', 'ci-repo', 'ci-runner'),
    makeEdge('e-runner-build', 'ci-runner', 'ci-build'),
    makeEdge('e-runner-test', 'ci-runner', 'ci-test'),
    makeEdge('e-build-registry', 'ci-build', 'ci-registry'),
    makeEdge('e-test-registry', 'ci-test', 'ci-registry'),
    makeEdge('e-registry-staging', 'ci-registry', 'ci-staging'),
    makeEdge('e-staging-prod', 'ci-staging', 'ci-prod'),
    makeEdge('e-prod-monitor', 'ci-prod', 'ci-monitor'),
  ],
}

const eventDrivenTemplate: CanvasTemplate = {
  id: 'event-driven',
  name: 'Event-Driven System',
  description: 'Producers publish events to a bus; consumers process them independently.',
  nodes: [
    makeNode('ev-prod-a', 'Producer A', 0, 60, 3, 'rectangle'),
    makeNode('ev-prod-b', 'Producer B', 0, 180, 4, 'rectangle'),
    makeNode('ev-bus', 'Event Bus', 220, 120, 1, 'pill', 160, 44),
    makeNode('ev-con-1', 'Consumer 1', 460, 0, 6, 'rectangle'),
    makeNode('ev-con-2', 'Consumer 2', 460, 120, 7, 'rectangle'),
    makeNode('ev-con-3', 'Consumer 3', 460, 240, 2, 'rectangle'),
    makeNode('ev-dlq', 'Dead Letter Queue', 700, 120, 5, 'cylinder', 180, 44),
  ],
  edges: [
    makeEdge('e-a-bus', 'ev-prod-a', 'ev-bus'),
    makeEdge('e-b-bus', 'ev-prod-b', 'ev-bus'),
    makeEdge('e-bus-c1', 'ev-bus', 'ev-con-1'),
    makeEdge('e-bus-c2', 'ev-bus', 'ev-con-2'),
    makeEdge('e-bus-c3', 'ev-bus', 'ev-con-3'),
    makeEdge('e-c1-dlq', 'ev-con-1', 'ev-dlq'),
    makeEdge('e-c2-dlq', 'ev-con-2', 'ev-dlq'),
    makeEdge('e-c3-dlq', 'ev-con-3', 'ev-dlq'),
  ],
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  microservicesTemplate,
  cicdTemplate,
  eventDrivenTemplate,
]
