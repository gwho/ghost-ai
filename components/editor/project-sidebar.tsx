"use client"

import { X, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <aside
      className={`fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-72 flex flex-col bg-surface border-r border-surface-border transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-sm font-semibold text-copy-primary">Projects</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-lg text-copy-muted hover:text-copy-primary transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-4">
        <Tabs defaultValue="my-projects" className="flex flex-col flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="my-projects" className="flex-1">
              My Projects
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex-1">
              Shared
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects" className="flex-1">
            <p className="text-sm text-copy-muted text-center py-8">No projects yet.</p>
          </TabsContent>

          <TabsContent value="shared" className="flex-1">
            <p className="text-sm text-copy-muted text-center py-8">No shared projects yet.</p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-auto p-4 border-t border-surface-border">
        <Button className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </aside>
  )
}
