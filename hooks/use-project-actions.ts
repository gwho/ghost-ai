"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { ProjectItem } from "@/lib/project-data"
import type { ProjectDialoguesValue } from "./use-project-dialogues"

export interface ProjectActionsValue {
  ownedProjects: ProjectItem[]
  sharedProjects: ProjectItem[]
  handleCreate: () => Promise<void>
  handleRename: () => Promise<void>
  handleDelete: () => Promise<void>
}

export function useProjectActions(
  initialOwned: ProjectItem[],
  initialShared: ProjectItem[],
  dialogues: ProjectDialoguesValue
): ProjectActionsValue {
  const router = useRouter()
  const pathname = usePathname()

  const [ownedProjects, setOwnedProjects] = useState(initialOwned)
  const [prevOwnedKey, setPrevOwnedKey] = useState(() =>
    initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
  )
  const sharedProjects = initialShared

  const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
  if (ownedKey !== prevOwnedKey) {
    setPrevOwnedKey(ownedKey)
    setOwnedProjects(initialOwned)
  }

  const { createName, renameName, targetProject, closeDialog, setIsLoading, setError } = dialogues

  async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json()
      return (body as { error?: string }).error ?? fallback
    } catch {
      return fallback
    }
  }

  const handleCreate = async () => {
    if (!createName.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, "Failed to create project")
        setError(msg)
        setIsLoading(false)
        return
      }
      const project = await res.json()
      closeDialog()
      router.push(`/editor/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
      setIsLoading(false)
    }
  }

  const handleRename = async () => {
    if (!targetProject || !renameName.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, "Failed to rename project")
        setError(msg)
        setIsLoading(false)
        return
      }
      const updated = await res.json()
      setOwnedProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p))
      )
      closeDialog()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project")
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!targetProject) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, { method: "DELETE" })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, "Failed to delete project")
        setError(msg)
        setIsLoading(false)
        return
      }
      const deletedId = targetProject.id
      setOwnedProjects((prev) => prev.filter((p) => p.id !== deletedId))
      closeDialog()
      if (pathname === `/editor/${deletedId}`) {
        router.push("/editor")
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project")
      setIsLoading(false)
    }
  }

  return {
    ownedProjects,
    sharedProjects,
    handleCreate,
    handleRename,
    handleDelete,
  }
}
