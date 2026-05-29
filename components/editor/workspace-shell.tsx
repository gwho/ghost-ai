"use client"

import { useState } from 'react'
import { Share2, Bot } from 'lucide-react'
import type { Project } from '@/lib/generated/prisma'
import { ShareDialog } from '@/components/editor/share-dialog'
import { CanvasWrapper } from '@/components/editor/canvas-wrapper'

interface WorkspaceShellProps {
  project: Pick<Project, 'id' | 'name'>
  isOwner: boolean
}

export function WorkspaceShell({ project, isOwner }: WorkspaceShellProps) {
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 flex-none flex items-center justify-between px-4 border-b border-surface-border bg-surface">
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

      <ShareDialog
        projectId={project.id}
        projectName={project.name}
        isOwner={isOwner}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CanvasWrapper roomId={project.id} />
        </div>

        {isAISidebarOpen && (
          <aside className="w-80 flex-none border-l border-surface-border bg-surface flex items-center justify-center">
            <p className="text-sm text-copy-muted">AI chat coming soon</p>
          </aside>
        )}
      </div>
    </div>
  )
}
