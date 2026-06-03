"use client"

import { useEffect } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'

function isEditableTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function useKeyboardShortcuts(
  flow: ReactFlowInstance | null,
  undo: () => void,
  redo: () => void,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e)) return

      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (!meta && (e.key === '+' || e.key === '=')) {
        flow?.zoomIn({ duration: 200 })
        return
      }
      if (!meta && e.key === '-') {
        flow?.zoomOut({ duration: 200 })
        return
      }
      if (meta && !e.shiftKey && key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (meta && e.shiftKey && key === 'z') {
        e.preventDefault()
        redo()
        return
      }
      if (meta && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flow, undo, redo])
}
