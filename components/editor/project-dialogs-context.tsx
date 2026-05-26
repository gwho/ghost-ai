"use client"

import { createContext, useContext } from "react"
import { useProjectActions, type ProjectActionsContextValue } from "@/hooks/use-project-actions"
import { ProjectDialogs } from "./project-dialogs"
import type { ProjectItem } from "@/lib/project-data"

const ProjectDialogsContext = createContext<ProjectActionsContextValue | null>(null)

interface ProjectDialogsProviderProps {
  children: React.ReactNode
  initialOwned: ProjectItem[]
  initialShared: ProjectItem[]
}

export function ProjectDialogsProvider({
  children,
  initialOwned,
  initialShared,
}: ProjectDialogsProviderProps) {
  const actions = useProjectActions(initialOwned, initialShared)

  return (
    <ProjectDialogsContext.Provider value={actions}>
      {children}
      <ProjectDialogs />
    </ProjectDialogsContext.Provider>
  )
}

export function useProjectDialogsContext(): ProjectActionsContextValue {
  const ctx = useContext(ProjectDialogsContext)
  if (!ctx) throw new Error("useProjectDialogsContext must be used within ProjectDialogsProvider")
  return ctx
}
