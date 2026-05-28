"use client"

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CollaboratorItem {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

interface ShareDialogProps {
  projectId: string
  projectName: string
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

function initials(str: string): string {
  const parts = str.split(/[\s@]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return str.slice(0, 2).toUpperCase()
}

function copyWithTextarea(url: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = url
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, url.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

function CollaboratorAvatar({
  name,
  email,
  avatarUrl,
}: {
  name?: string
  email: string
  avatarUrl?: string
}) {
  const label = name ?? email
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label}
        className="h-8 w-8 rounded-full object-cover flex-none"
      />
    )
  }
  return (
    <div className="h-8 w-8 rounded-full bg-elevated text-copy-muted text-xs font-medium flex items-center justify-center flex-none select-none">
      {initials(label)}
    </div>
  )
}

export function ShareDialog({
  projectId,
  projectName,
  isOwner,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
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

  useEffect(() => {
    if (!open) return
    setError(null)
    setIsLoading(true)
    fetch(`/api/projects/${projectId}/collaborators`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: CollaboratorItem[]) => {
        setCollaborators(data)
        setIsLoading(false)
      })
      .catch(() => {
        setError('Failed to load collaborators')
        setIsLoading(false)
      })
  }, [open, projectId])

  async function handleCopy() {
    const url = `${window.location.origin}/editor/${projectId}`
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = null

    let didCopy = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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
    window.prompt('Copy this project URL:', url)
  }

  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    setError(null)
    setIsLoading(true)
    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const newCollab: CollaboratorItem = await res.json()
      setCollaborators((prev) => [...prev, newCollab])
      setInviteEmail('')
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to invite collaborator')
    }
    setIsLoading(false)
  }

  async function handleRemove(collaboratorId: string) {
    const res = await fetch(
      `/api/projects/${projectId}/collaborators/${collaboratorId}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
    }
  }

  const projectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/editor/${projectId}`
      : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &ldquo;{projectName}&rdquo;</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Invite collaborators by email to give them access to this project.'
              : 'People with access to this project.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={projectUrl}
            className="flex-1 h-9 px-3 rounded-xl text-sm bg-base border border-surface-border text-copy-muted truncate"
          />
          <Button variant="outline" size="sm" onClick={handleCopy} className="flex-none w-20">
            {isCopied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        {isOwner && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inviteEmail.trim() && !isLoading) {
                    e.preventDefault()
                    handleInvite()
                  }
                }}
                disabled={isLoading}
              />
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isLoading}
                size="sm"
                className="flex-none"
              >
                Invite
              </Button>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        )}

        {collaborators.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-copy-muted font-medium uppercase tracking-wide">
              Collaborators
            </p>
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <CollaboratorAvatar name={c.name} email={c.email} avatarUrl={c.avatarUrl} />
                <span className="flex-1 text-sm text-copy-primary truncate">
                  {c.name ?? c.email}
                </span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(c.id)}
                    className="flex-none text-copy-muted hover:text-error"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {collaborators.length === 0 && !isLoading && (
          <p className="text-sm text-copy-muted text-center py-2">No collaborators yet.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
