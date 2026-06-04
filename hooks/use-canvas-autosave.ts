"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CanvasNode, CanvasEdge } from '@/types/canvas'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useCanvasAutosave(
  projectId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): { saveStatus: SaveStatus; save: () => Promise<void> } {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const isFirstRender = useRef(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs mirror the latest nodes/edges so the save callback stays stable
  // (it only depends on projectId) and never closes over stale data.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // React 18 silently ignores setState calls on unmounted components —
  // the isMounted guard that was here is unnecessary and breaks in React
  // Strict Mode (dev), where the simulated unmount cleanup sets the ref
  // to false permanently, making every save() call a silent no-op.

  const save = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodesRef.current, edges: edgesRef.current }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    }
  }, [projectId])

  useEffect(() => {
    // Skip autosave on initial mount — don't re-upload data that was just loaded
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(save, 2000)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [nodes, edges, save])

  return { saveStatus, save }
}
