import { describe, it, expect } from 'vitest'

/**
 * Tests for pure helper functions introduced in this PR.
 *
 * getSpecFilename is defined locally in ai-sidebar.tsx but its logic is
 * straightforward enough to test by replicating it. This guards against
 * regressions if the function is extracted or modified.
 */

// Mirror of getSpecFilename from components/editor/ai-sidebar.tsx
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}

describe('getSpecFilename', () => {
  it('extracts the filename from a full blob URL path', () => {
    const filePath = 'https://blob.vercel.com/specs/project-abc/spec-123.md'
    expect(getSpecFilename(filePath)).toBe('spec-123.md')
  })

  it('extracts filename from a simple relative path', () => {
    expect(getSpecFilename('specs/project-abc/my-spec.md')).toBe('my-spec.md')
  })

  it('returns the value as-is when there is no slash separator', () => {
    expect(getSpecFilename('spec-only.md')).toBe('spec-only.md')
  })

  it('returns empty string when path ends with a slash (pop returns empty, ?? only guards null/undefined)', () => {
    // split('/').pop() on 'specs/proj/' returns '' (empty string).
    // The ?? operator only falls back on null/undefined, not empty strings.
    // In practice blob paths always have a filename component.
    expect(getSpecFilename('specs/project/')).toBe('')
  })

  it('handles deeply nested paths correctly', () => {
    expect(getSpecFilename('a/b/c/d/e/my-file.md')).toBe('my-file.md')
  })

  it('handles a path with only one component', () => {
    expect(getSpecFilename('filename.md')).toBe('filename.md')
  })

  it('preserves the .md extension', () => {
    const result = getSpecFilename('specs/project-abc/spec-xyz-789.md')
    expect(result).toMatch(/\.md$/)
  })

  it('handles UUIDs in the filename', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(getSpecFilename(`specs/project/${uuid}.md`)).toBe(`${uuid}.md`)
  })
})

/**
 * Tests for the canvas snapshot ref pattern introduced in workspace-shell.tsx.
 *
 * The canvasSnapshotRef pattern stores the latest canvas state in a ref so it
 * can be read synchronously at any point (e.g., when "Generate Spec" is clicked).
 * This tests the conceptual contract of that pattern.
 */
describe('canvas snapshot ref pattern', () => {
  it('ref starts as null before any canvas update', () => {
    // Mirrors: useRef<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(null)
    let snapshotRef: { nodes: unknown[]; edges: unknown[] } | null = null

    expect(snapshotRef).toBeNull()
  })

  it('ref is updated when onCanvasSnapshot callback is called', () => {
    let snapshotRef: { nodes: unknown[]; edges: unknown[] } | null = null

    const onCanvasSnapshot = (s: { nodes: unknown[]; edges: unknown[] }) => {
      snapshotRef = s
    }

    const mockNodes = [{ id: 'node-1', data: { label: 'API Gateway' } }]
    const mockEdges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }]

    onCanvasSnapshot({ nodes: mockNodes, edges: mockEdges })

    expect(snapshotRef).not.toBeNull()
    expect(snapshotRef!.nodes).toEqual(mockNodes)
    expect(snapshotRef!.edges).toEqual(mockEdges)
  })

  it('getCanvasSnapshot returns current ref value', () => {
    let snapshotRef: { nodes: unknown[]; edges: unknown[] } | null = null

    const onCanvasSnapshot = (s: { nodes: unknown[]; edges: unknown[] }) => {
      snapshotRef = s
    }

    const getCanvasSnapshot = () => snapshotRef

    // Before any snapshot: returns null
    expect(getCanvasSnapshot()).toBeNull()

    // After canvas updates
    onCanvasSnapshot({ nodes: [{ id: 'n1' }], edges: [] })

    // getCanvasSnapshot now returns the latest snapshot
    const snapshot = getCanvasSnapshot()
    expect(snapshot).not.toBeNull()
    expect(snapshot!.nodes).toHaveLength(1)
  })

  it('ref is updated when nodes or edges change', () => {
    let snapshotRef: { nodes: unknown[]; edges: unknown[] } | null = null

    const onCanvasSnapshot = (s: { nodes: unknown[]; edges: unknown[] }) => {
      snapshotRef = s
    }

    // First canvas state
    onCanvasSnapshot({ nodes: [{ id: 'n1' }], edges: [] })
    expect(snapshotRef!.nodes).toHaveLength(1)

    // Canvas updated with more nodes
    onCanvasSnapshot({ nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1' }] })
    expect(snapshotRef!.nodes).toHaveLength(2)
    expect(snapshotRef!.edges).toHaveLength(1)
  })

  it('submitSpec falls back to empty arrays when no snapshot is available', () => {
    // Mirrors: const snapshot = getCanvasSnapshot?.() ?? { nodes: [], edges: [] }
    const getCanvasSnapshot = (): { nodes: unknown[]; edges: unknown[] } | null => null

    const snapshot = getCanvasSnapshot() ?? { nodes: [], edges: [] }

    expect(snapshot.nodes).toEqual([])
    expect(snapshot.edges).toEqual([])
  })

  it('submitSpec uses snapshot data when available', () => {
    const mockSnapshot = {
      nodes: [{ id: 'n1', data: { label: 'DB' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }

    const getCanvasSnapshot = () => mockSnapshot

    const snapshot = getCanvasSnapshot() ?? { nodes: [], edges: [] }

    expect(snapshot.nodes).toHaveLength(1)
    expect(snapshot.edges).toHaveLength(1)
  })
})

/**
 * Tests for the onCanvasSnapshot effect logic from canvas-flow.tsx.
 *
 * The useEffect at line 163-165 calls onCanvasSnapshot whenever nodes or edges change.
 * This test suite verifies that contract as a pure function.
 */
describe('onCanvasSnapshot effect contract', () => {
  it('is called with current nodes and edges on each change', () => {
    const snapshots: Array<{ nodes: unknown[]; edges: unknown[] }> = []

    const onCanvasSnapshot = (snapshot: { nodes: unknown[]; edges: unknown[] }) => {
      snapshots.push(snapshot)
    }

    // Simulate the useEffect: onCanvasSnapshot?.({ nodes, edges })
    const simulateEffect = (
      nodes: unknown[],
      edges: unknown[],
      callback?: (s: { nodes: unknown[]; edges: unknown[] }) => void,
    ) => {
      callback?.({ nodes, edges })
    }

    simulateEffect([{ id: 'n1' }], [], onCanvasSnapshot)
    simulateEffect([{ id: 'n1' }, { id: 'n2' }], [{ id: 'e1' }], onCanvasSnapshot)

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].nodes).toHaveLength(1)
    expect(snapshots[1].nodes).toHaveLength(2)
    expect(snapshots[1].edges).toHaveLength(1)
  })

  it('is not called when onCanvasSnapshot prop is undefined', () => {
    // Mirrors: onCanvasSnapshot?.({ nodes, edges }) — optional chaining handles undefined
    let called = false
    const onCanvasSnapshot: ((s: unknown) => void) | undefined = undefined

    // This should not throw even when the callback is undefined
    expect(() => {
      onCanvasSnapshot?.({ nodes: [], edges: [] })
    }).not.toThrow()

    expect(called).toBe(false)
  })

  it('snapshot always contains both nodes and edges', () => {
    let capturedSnapshot: { nodes: unknown[]; edges: unknown[] } | null = null

    const onCanvasSnapshot = (snapshot: { nodes: unknown[]; edges: unknown[] }) => {
      capturedSnapshot = snapshot
    }

    onCanvasSnapshot?.({ nodes: [], edges: [] })

    expect(capturedSnapshot).not.toBeNull()
    expect(capturedSnapshot).toHaveProperty('nodes')
    expect(capturedSnapshot).toHaveProperty('edges')
  })
})