"use client"

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
import { useProjectShare, type CollaboratorItem } from '@/hooks/use-project-share'

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
  const {
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
  } = useProjectShare(projectId, open)

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
            {collaborators.map((c: CollaboratorItem) => (
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
