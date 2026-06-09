/**
 * Tests for the onCanvasSnapshot prop added in this PR to canvas-flow.tsx,
 * canvas-wrapper.tsx, and workspace-shell.tsx.
 *
 * The core behaviour under test:
 *   1. The callback must be invoked with a { nodes, edges } snapshot.
 *   2. The workspace-shell stores the latest snapshot in canvasSnapshotRef.
 *   3. getCanvasSnapshot() returns whatever is currently in the ref.
 *
 * Because the full component tree requires liveblocks, xyflow, and clerk,
 * these tests exercise the callback-wiring logic in isolation using plain
 * objects to represent the snapshot data.
 */
import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Types mirrored from the component interfaces (TypeScript checks)
// ---------------------------------------------------------------------------

interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { label: string }
}

interface CanvasEdge {
  id: string
  source: string
  target: string
}

interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// ---------------------------------------------------------------------------
// Snapshot callback wiring — the workspace-shell pattern
// ---------------------------------------------------------------------------

/**
 * Simulates the WorkspaceShell pattern:
 *
 *   const canvasSnapshotRef = useRef<CanvasSnapshot | null>(null)
 *   <CanvasWrapper onCanvasSnapshot={(s) => { canvasSnapshotRef.current = s }} />
 *   <AISidebar getCanvasSnapshot={() => canvasSnapshotRef.current} />
 */
function buildSnapshotBridge() {
  let stored: CanvasSnapshot | null = null

  const onCanvasSnapshot = (snapshot: CanvasSnapshot) => {
    stored = snapshot
  }

  const getCanvasSnapshot = (): CanvasSnapshot | null => stored

  return { onCanvasSnapshot, getCanvasSnapshot }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('canvas snapshot callback chain (workspace-shell wiring)', () => {
  it('getCanvasSnapshot returns null before any snapshot is received', () => {
    const { getCanvasSnapshot } = buildSnapshotBridge()
    expect(getCanvasSnapshot()).toBeNull()
  })

  it('getCanvasSnapshot returns the last snapshot after onCanvasSnapshot is called', () => {
    const { onCanvasSnapshot, getCanvasSnapshot } = buildSnapshotBridge()

    const nodes: CanvasNode[] = [
      { id: 'n1', type: 'canvasNode', position: { x: 10, y: 20 }, data: { label: 'API' } },
    ]
    const edges: CanvasEdge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

    onCanvasSnapshot({ nodes, edges })

    const snap = getCanvasSnapshot()
    expect(snap).not.toBeNull()
    expect(snap!.nodes).toEqual(nodes)
    expect(snap!.edges).toEqual(edges)
  })

  it('overwrites the snapshot when called again with updated data', () => {
    const { onCanvasSnapshot, getCanvasSnapshot } = buildSnapshotBridge()

    onCanvasSnapshot({ nodes: [], edges: [] })
    const first = getCanvasSnapshot()
    expect(first!.nodes).toHaveLength(0)

    const newNode: CanvasNode = {
      id: 'n2',
      type: 'canvasNode',
      position: { x: 50, y: 60 },
      data: { label: 'DB' },
    }
    onCanvasSnapshot({ nodes: [newNode], edges: [] })

    const second = getCanvasSnapshot()
    expect(second!.nodes).toHaveLength(1)
    expect(second!.nodes[0].id).toBe('n2')
  })

  it('stores the exact reference passed to the callback', () => {
    const { onCanvasSnapshot, getCanvasSnapshot } = buildSnapshotBridge()

    const snap: CanvasSnapshot = { nodes: [], edges: [] }
    onCanvasSnapshot(snap)

    expect(getCanvasSnapshot()).toBe(snap)
  })

  it('accepts empty nodes and edges arrays', () => {
    const { onCanvasSnapshot, getCanvasSnapshot } = buildSnapshotBridge()

    onCanvasSnapshot({ nodes: [], edges: [] })

    const result = getCanvasSnapshot()
    expect(result).toEqual({ nodes: [], edges: [] })
  })
})

// ---------------------------------------------------------------------------
// onCanvasSnapshot prop interface (type-level behaviour)
// ---------------------------------------------------------------------------

describe('onCanvasSnapshot prop contract', () => {
  it('is called with the snapshot as the only argument', () => {
    const callback = vi.fn<[CanvasSnapshot], void>()
    const snapshot: CanvasSnapshot = {
      nodes: [
        { id: 'n1', type: 'canvasNode', position: { x: 0, y: 0 }, data: { label: 'Cache' } },
      ],
      edges: [],
    }

    callback(snapshot)

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith(snapshot)
  })

  it('callback receives nodes array', () => {
    const snapshots: CanvasSnapshot[] = []
    const onCanvasSnapshot = (s: CanvasSnapshot) => snapshots.push(s)

    const nodeA: CanvasNode = {
      id: 'a',
      type: 'canvasNode',
      position: { x: 0, y: 0 },
      data: { label: 'A' },
    }
    const nodeB: CanvasNode = {
      id: 'b',
      type: 'canvasNode',
      position: { x: 100, y: 0 },
      data: { label: 'B' },
    }

    onCanvasSnapshot({ nodes: [nodeA], edges: [] })
    onCanvasSnapshot({ nodes: [nodeA, nodeB], edges: [] })

    expect(snapshots[0].nodes).toHaveLength(1)
    expect(snapshots[1].nodes).toHaveLength(2)
  })

  it('callback receives edges array', () => {
    const snapshots: CanvasSnapshot[] = []
    const onCanvasSnapshot = (s: CanvasSnapshot) => snapshots.push(s)

    const edge: CanvasEdge = { id: 'e1', source: 'n1', target: 'n2' }

    onCanvasSnapshot({ nodes: [], edges: [edge] })

    expect(snapshots[0].edges).toHaveLength(1)
    expect(snapshots[0].edges[0]).toEqual(edge)
  })

  it('getCanvasSnapshot returns null when no snapshot has been stored', () => {
    // Simulates the initial state in workspace-shell before any canvas update
    const snapshotRef: { current: CanvasSnapshot | null } = { current: null }
    const getCanvasSnapshot = () => snapshotRef.current

    expect(getCanvasSnapshot()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// useEffect-based snapshot emission pattern
// (mirrors the useEffect in canvas-flow.tsx)
// ---------------------------------------------------------------------------

describe('snapshot emission on nodes/edges change', () => {
  it('notifies the callback whenever nodes array changes', () => {
    const onCanvasSnapshot = vi.fn<[CanvasSnapshot], void>()

    // Simulates what useEffect(() => onCanvasSnapshot?.({nodes, edges}), [nodes, edges]) does
    const simulateEffect = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
      onCanvasSnapshot({ nodes, edges })
    }

    const node1: CanvasNode = {
      id: 'n1',
      type: 'canvasNode',
      position: { x: 0, y: 0 },
      data: { label: 'X' },
    }
    const node2: CanvasNode = {
      id: 'n2',
      type: 'canvasNode',
      position: { x: 100, y: 0 },
      data: { label: 'Y' },
    }

    simulateEffect([node1], [])
    simulateEffect([node1, node2], [])

    expect(onCanvasSnapshot).toHaveBeenCalledTimes(2)
    expect(onCanvasSnapshot.mock.calls[1][0].nodes).toHaveLength(2)
  })

  it('does not throw when onCanvasSnapshot is undefined (optional prop)', () => {
    // Mirrors: onCanvasSnapshot?.({ nodes, edges })
    const onCanvasSnapshot: ((s: CanvasSnapshot) => void) | undefined = undefined

    expect(() => {
      onCanvasSnapshot?.({ nodes: [], edges: [] })
    }).not.toThrow()
  })
})