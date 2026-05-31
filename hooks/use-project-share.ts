"use client"

import { useEffect, useRef, useState } from "react"

export interface CollaboratorItem {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

export interface ProjectShareValue {
  collaborators: CollaboratorItem[]
  inviteEmail: string
  isCopied: boolean
  isLoading: boolean
  error: string | null
  setInviteEmail: (email: string) => void
  setError: (error: string | null) => void
  handleCopy: () => Promise<void>
  handleInvite: () => Promise<void>
  handleRemove: (collaboratorId: string) => Promise<void>
  reloadCollaborators: () => Promise<void>
}

function copyWithTextarea(url: string): boolean {
  const textarea = document.createElement("textarea")
  textarea.value = url
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, url.length)
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

export function useProjectShare(projectId: string, open: boolean): ProjectShareValue {
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = null
    }
  }, [])

  async function fetchCollaborators(): Promise<CollaboratorItem[]> {
    const res = await fetch(`/api/projects/${projectId}/collaborators`)
    if (!res.ok) throw new Error("Failed to load collaborators")
    return res.json()
  }

  useEffect(() => {
    if (!open) return
    void (async () => {
      setError(null)
      setIsLoading(true)
      try {
        setCollaborators(await fetchCollaborators())
      } catch {
        setError("Failed to load collaborators")
      } finally {
        setIsLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  async function handleCopy() {
    const url = `${window.location.origin}/editor/${projectId}`
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = null

    let didCopy = false
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        didCopy = true
      } else {
        didCopy = copyWithTextarea(url)
      }
    } catch {
      didCopy = copyWithTextarea(url)
    }

    if (didCopy) {
      setIsCopied(true)
      copyTimer.current = setTimeout(() => {
        setIsCopied(false)
        copyTimer.current = null
      }, 2000)
      return
    }

    setIsCopied(false)
    window.prompt("Copy this project URL:", url)
  }

  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    setError(null)
    setIsLoading(true)
    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const newCollab: CollaboratorItem = await res.json()
      setCollaborators((prev) => [...prev, newCollab])
      setInviteEmail("")
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? "Failed to invite collaborator")
    }
    setIsLoading(false)
  }

  async function handleRemove(collaboratorId: string) {
    const res = await fetch(
      `/api/projects/${projectId}/collaborators/${collaboratorId}`,
      { method: "DELETE" }
    )
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
    }
  }

  async function reloadCollaborators() {
    setError(null)
    setIsLoading(true)
    try {
      setCollaborators(await fetchCollaborators())
    } catch {
      setError("Failed to load collaborators")
    } finally {
      setIsLoading(false)
    }
  }

  return {
    collaborators,
    inviteEmail,
    isCopied,
    isLoading,
    error,
    setInviteEmail,
    setError,
    handleCopy,
    handleInvite,
    handleRemove,
    reloadCollaborators,
  }
}
