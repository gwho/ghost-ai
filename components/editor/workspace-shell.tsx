"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Share2, Bot, LayoutTemplate } from 'lucide-react'
import type { Project } from '@/lib/generated/prisma'
import { cn } from '@/lib/utils'
import { ShareDialog } from '@/components/editor/share-dialog'
import { CanvasWrapper } from '@/components/editor/canvas-wrapper'
import { AISidebar } from '@/components/editor/ai-sidebar'
import type { SaveStatus } from '@/hooks/use-canvas-autosave'

interface WorkspaceShellProps {
  project: Pick<Project, 'id' | 'name'>
  isOwner: boolean
}

export function WorkspaceShell({ project, isOwner }: WorkspaceShellProps) {
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveRef = useRef<(() => Promise<void>) | null>(null)

  const handleManualSaveReady = useCallback((fn: () => Promise<void>) => {
    saveRef.current = fn
  }, [])

  const handleManualSave = useCallback(() => {
    saveRef.current?.()
  }, [])

  // Auto-reset "saved" and "error" indicators after 3 s so the toolbar stays clean
  useEffect(() => {
    if (saveStatus !== 'saved' && saveStatus !== 'error') return
    const t = setTimeout(() => setSaveStatus('idle'), 3000)
    return () => clearTimeout(t)
  }, [saveStatus])

  return (
    <div className="relative h-full">
      {/* Canvas fills the entire area — sidebars and toolbar float over it */}
      <div className="absolute inset-0">
        <CanvasWrapper
          roomId={project.id}
          isTemplatesOpen={isTemplatesOpen}
          onTemplatesOpenChange={setIsTemplatesOpen}
          onSaveStatusChange={setSaveStatus}
          onManualSaveReady={handleManualSaveReady}
        />
      </div>

      {/* Workspace toolbar floats over the top of the canvas */}
      <div className="absolute top-0 left-0 right-0 z-20 h-12 flex items-center justify-between px-4 border-b border-surface-border bg-surface">
        <span className="text-sm font-semibold text-copy-primary truncate">{project.name}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center h-8 px-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-copy-muted hover:text-copy-primary hover:bg-elevated"
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-sm text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors"
          >
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </button>
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-sm text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            type="button"
            onClick={() => setIsAISidebarOpen((prev) => !prev)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-sm text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors"
            aria-label="Toggle AI sidebar"
            aria-pressed={isAISidebarOpen}
          >
            <Bot className="h-4 w-4" />
            AI
          </button>
        </div>
      </div>

      {/* AI sidebar floats over the right side of the canvas, below the toolbar */}
      <div
        className={cn(
          "absolute right-0 top-12 bottom-0 z-10 w-80 transition-transform duration-300 ease-in-out",
          isAISidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <AISidebar onClose={() => setIsAISidebarOpen(false)} />
      </div>

      <ShareDialog
        projectId={project.id}
        projectName={project.name}
        isOwner={isOwner}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
    </div>
  )
}
