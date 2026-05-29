"use client"

import { createContext, useContext } from "react"
import { useProjectDialogues, type ProjectDialoguesValue } from "@/hooks/use-project-dialogues"
import { useProjectActions, type ProjectActionsValue } from "@/hooks/use-project-actions"
import { ProjectDialogs } from "./project-dialogs"
import type { ProjectItem } from "@/lib/project-data"

export type ProjectContextValue = ProjectDialoguesValue & ProjectActionsValue

const ProjectDialogsContext = createContext<ProjectContextValue | null>(null)

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
  const dialogues = useProjectDialogues()
  const actions = useProjectActions(initialOwned, initialShared, dialogues)

  return (
    <ProjectDialogsContext.Provider value={{ ...dialogues, ...actions }}>
      {children}
      <ProjectDialogs />
    </ProjectDialogsContext.Provider>
  )
}

export function useProjectDialogsContext(): ProjectContextValue {
  const ctx = useContext(ProjectDialogsContext)
  if (!ctx) throw new Error("useProjectDialogsContext must be used within ProjectDialogsProvider")
  return ctx
}
