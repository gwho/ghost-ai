"use client"

import { createContext, useContext } from "react"
import { useProjectDialogs, type ProjectDialogsContextValue } from "@/hooks/use-project-dialogs"
import { ProjectDialogs } from "./project-dialogs"

const ProjectDialogsContext = createContext<ProjectDialogsContextValue | null>(null)

export function ProjectDialogsProvider({ children }: { children: React.ReactNode }) {
  const dialogs = useProjectDialogs()

  return (
    <ProjectDialogsContext.Provider value={dialogs}>
      {children}
      <ProjectDialogs />
    </ProjectDialogsContext.Provider>
  )
}

export function useProjectDialogsContext(): ProjectDialogsContextValue {
  const ctx = useContext(ProjectDialogsContext)
  if (!ctx) throw new Error("useProjectDialogsContext must be used within ProjectDialogsProvider")
  return ctx
}
