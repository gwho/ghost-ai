"use client"

import { useRef, useState } from "react"
import type { ProjectItem } from "@/lib/project-data"

export type DialogType = "create" | "rename" | "delete" | null

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

export interface ProjectDialoguesValue {
  open: DialogType
  targetProject: ProjectItem | null
  createName: string
  createSlug: string
  renameName: string
  isLoading: boolean
  error: string | null
  openCreate: () => void
  openRename: (project: ProjectItem) => void
  openDelete: (project: ProjectItem) => void
  closeDialog: () => void
  setCreateName: (name: string) => void
  setRenameName: (name: string) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export function useProjectDialogues(): ProjectDialoguesValue {
  const [open, setOpen] = useState<DialogType>(null)
  const [targetProject, setTargetProject] = useState<ProjectItem | null>(null)
  const [createName, setCreateNameState] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [renameName, setRenameName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suffixRef = useRef(randomSuffix())

  const setCreateName = (name: string) => {
    setCreateNameState(name)
    const slug = toSlug(name)
    setCreateSlug(slug ? `${slug}-${suffixRef.current}` : "")
  }

  const openCreate = () => {
    suffixRef.current = randomSuffix()
    setCreateNameState("")
    setCreateSlug("")
    setOpen("create")
  }

  const openRename = (project: ProjectItem) => {
    setTargetProject(project)
    setRenameName(project.name)
    setOpen("rename")
  }

  const openDelete = (project: ProjectItem) => {
    setTargetProject(project)
    setOpen("delete")
  }

  const closeDialog = () => {
    setOpen(null)
    setTargetProject(null)
    setIsLoading(false)
    setError(null)
  }

  return {
    open,
    targetProject,
    createName,
    createSlug,
    renameName,
    isLoading,
    error,
    openCreate,
    openRename,
    openDelete,
    closeDialog,
    setCreateName,
    setRenameName,
    setIsLoading,
    setError,
  }
}
