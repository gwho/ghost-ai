"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
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

export interface ProjectActionsContextValue {
  open: DialogType
  targetProject: ProjectItem | null
  createName: string
  createSlug: string
  renameName: string
  isLoading: boolean
  openCreate: () => void
  openRename: (project: ProjectItem) => void
  openDelete: (project: ProjectItem) => void
  closeDialog: () => void
  handleCreate: () => void
  handleRename: () => void
  handleDelete: () => void
  setCreateName: (name: string) => void
  setRenameName: (name: string) => void
  ownedProjects: ProjectItem[]
  sharedProjects: ProjectItem[]
}

export function useProjectActions(
  initialOwned: ProjectItem[],
  initialShared: ProjectItem[]
): ProjectActionsContextValue {
  const router = useRouter()
  const pathname = usePathname()

  const [ownedProjects, setOwnedProjects] = useState(initialOwned)
  const [sharedProjects, setSharedProjects] = useState(initialShared)
  const [open, setOpen] = useState<DialogType>(null)
  const [targetProject, setTargetProject] = useState<ProjectItem | null>(null)
  const [createName, setCreateNameState] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [renameName, setRenameName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const suffixRef = useRef(randomSuffix())

  // Re-sync when server re-fetches after router.refresh()
  const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
  useEffect(() => {
    setOwnedProjects(initialOwned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedKey])

  useEffect(() => {
    setSharedProjects(initialShared)
  }, [initialShared])

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
  }

  const handleCreate = async () => {
    if (!createName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      })
      if (!res.ok) throw new Error()
      const project = await res.json()
      closeDialog()
      router.push(`/editor/${project.id}`)
    } catch {
      setIsLoading(false)
    }
  }

  const handleRename = async () => {
    if (!targetProject || !renameName.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setOwnedProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p))
      )
      closeDialog()
      router.refresh()
    } catch {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!targetProject) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      const deletedId = targetProject.id
      setOwnedProjects((prev) => prev.filter((p) => p.id !== deletedId))
      closeDialog()
      if (pathname === `/editor/${deletedId}`) {
        router.push("/editor")
      } else {
        router.refresh()
      }
    } catch {
      setIsLoading(false)
    }
  }

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
