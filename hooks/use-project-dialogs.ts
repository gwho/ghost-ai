"use client"

import { useEffect, useRef, useState } from "react"

export type DialogType = "create" | "rename" | "delete" | null

export interface MockProject {
  id: string
  name: string
  slug: string
  isOwned: boolean
}

export const MOCK_PROJECTS: MockProject[] = [
  { id: "1", name: "E-Commerce Platform", slug: "e-commerce-platform", isOwned: true },
  { id: "2", name: "Auth Service", slug: "auth-service", isOwned: true },
  { id: "3", name: "Data Pipeline", slug: "data-pipeline", isOwned: false },
  { id: "4", name: "Notification System", slug: "notification-system", isOwned: false },
]

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
}

export interface ProjectDialogsContextValue {
  open: DialogType
  targetProject: MockProject | null
  createName: string
  createSlug: string
  renameName: string
  isLoading: boolean
  openCreate: () => void
  openRename: (project: MockProject) => void
  openDelete: (project: MockProject) => void
  closeDialog: () => void
  handleCreate: () => void
  handleRename: () => void
  handleDelete: () => void
  setCreateName: (name: string) => void
  setRenameName: (name: string) => void
  ownedProjects: MockProject[]
  sharedProjects: MockProject[]
}

export function useProjectDialogs(): ProjectDialogsContextValue {
  const [open, setOpen] = useState<DialogType>(null)
  const [targetProject, setTargetProject] = useState<MockProject | null>(null)
  const [createName, setCreateNameState] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [renameName, setRenameName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const setCreateName = (name: string) => {
    setCreateNameState(name)
    setCreateSlug(toSlug(name))
  }

  const openCreate = () => {
    setCreateName("")
    setOpen("create")
  }

  const openRename = (project: MockProject) => {
    setTargetProject(project)
    setRenameName(project.name)
    setOpen("rename")
  }

  const openDelete = (project: MockProject) => {
    setTargetProject(project)
    setOpen("delete")
  }

  const closeDialog = () => {
    setOpen(null)
    setTargetProject(null)
    setIsLoading(false)
  }

  const scheduleClose = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setIsLoading(false)
      closeDialog()
    }, 400)
  }

  const handleCreate = () => {
    setIsLoading(true)
    scheduleClose()
  }

  const handleRename = () => {
    setIsLoading(true)
    scheduleClose()
  }

  const handleDelete = () => {
    setIsLoading(true)
    scheduleClose()
  }

  const ownedProjects = MOCK_PROJECTS.filter((p) => p.isOwned)
  const sharedProjects = MOCK_PROJECTS.filter((p) => !p.isOwned)

  return {
    open,
    targetProject,
    createName,
    createSlug,
    renameName,
    isLoading,
    openCreate,
    openRename,
    openDelete,
    closeDialog,
    handleCreate,
    handleRename,
    handleDelete,
    setCreateName,
    setRenameName,
    ownedProjects,
    sharedProjects,
  }
}
