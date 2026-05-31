"use client"

import { useState } from 'react'
import { Share2, Bot } from 'lucide-react'
import type { Project } from '@/lib/generated/prisma'
import { ShareDialog } from '@/components/editor/share-dialog'
import { CanvasWrapper } from '@/components/editor/canvas-wrapper'
import { AICopilotSidebar } from '@/components/editor/ai-copilot-sidebar'

interface WorkspaceShellProps {
  project: Pick<Project, 'id' | 'name'>
  isOwner: boolean
}

export function WorkspaceShell({ project, isOwner }: WorkspaceShellProps) {
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)

  return (
    <div className="relative h-full">
      {/* Canvas fills the entire area — sidebars and toolbar float over it */}
      <div className="absolute inset-0">
        <CanvasWrapper roomId={project.id} />
      </div>

      {/* Workspace toolbar floats over the top of the canvas */}
      <div className="absolute top-0 left-0 right-0 z-20 h-12 flex items-center justify-between px-4 border-b border-surface-border bg-surface">
        <span className="text-sm font-semibold text-copy-primary truncate">{project.name}</span>
        <div className="flex items-center gap-1">
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
      {isAISidebarOpen && (
        <div className="absolute right-0 top-12 bottom-0 z-10 w-80">
          <AICopilotSidebar />
        </div>
      )}

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
