"use client"

import { useEffect, useState } from "react"
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
  const sharedProjects = initialShared

  const ownedKey = initialOwned.map((p) => `${p.id}:${p.name}`).join(",")
  useEffect(() => {
    setOwnedProjects(initialOwned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedKey])

  const { createName, renameName, targetProject, closeDialog, setIsLoading } = dialogues

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
    ownedProjects,
    sharedProjects,
    handleCreate,
    handleRename,
    handleDelete,
  }
}
