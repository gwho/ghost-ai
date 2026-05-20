"use client"

import { X, Plus, Pencil, Trash2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useProjectDialogsContext } from "./project-dialogs-context"
import type { MockProject } from "@/hooks/use-project-dialogs"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function ProjectItem({ project }: { project: MockProject }) {
  const { openRename, openDelete } = useProjectDialogsContext()

  return (
    <div className="group flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-elevated cursor-pointer">
      <span className="text-sm text-copy-primary truncate">{project.name}</span>
      {project.isOwned && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openRename(project)
            }}
            className="flex items-center justify-center h-6 w-6 rounded-xl text-copy-muted hover:text-copy-primary transition-colors"
            aria-label={`Rename ${project.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openDelete(project)
            }}
            className="flex items-center justify-center h-6 w-6 rounded-xl text-copy-muted hover:text-error transition-colors"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const { openCreate, ownedProjects, sharedProjects } = useProjectDialogsContext()

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
          className="flex items-center justify-center h-6 w-6 rounded-xl text-copy-muted hover:text-copy-primary transition-colors"
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

          <TabsContent value="my-projects" className="flex-1 pt-2">
            {ownedProjects.length === 0 ? (
              <p className="text-sm text-copy-muted text-center py-8">No projects yet.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {ownedProjects.map((project) => (
                  <ProjectItem key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shared" className="flex-1 pt-2">
            {sharedProjects.length === 0 ? (
              <p className="text-sm text-copy-muted text-center py-8">No shared projects yet.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {sharedProjects.map((project) => (
                  <ProjectItem key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-auto p-4 border-t border-surface-border">
        <Button className="w-full gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </aside>
  )
}
