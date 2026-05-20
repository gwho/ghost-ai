"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProjectDialogsContext } from "./project-dialogs-context"

function CreateProjectDialog() {
  const {
    open,
    createName,
    createSlug,
    isLoading,
    setCreateName,
    handleCreate,
    closeDialog,
  } = useProjectDialogsContext()

  return (
    <Dialog open={open === "create"} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <Input
            autoFocus
            placeholder="Project name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && createName.trim() && !isLoading) {
                e.preventDefault()
                handleCreate()
              }
            }}
          />
          <p className="font-mono text-xs text-copy-muted">
            ghost.ai/{createSlug || "…"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!createName.trim() || isLoading}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameProjectDialog() {
  const {
    open,
    targetProject,
    renameName,
    isLoading,
    setRenameName,
    handleRename,
    closeDialog,
  } = useProjectDialogsContext()

  return (
    <Dialog open={open === "rename"} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          {targetProject && (
            <DialogDescription>
              Rename &ldquo;{targetProject.name}&rdquo;
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-2">
          <Input
            autoFocus
            placeholder="Project name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameName.trim() && !isLoading) {
                e.preventDefault()
                handleRename()
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={!renameName.trim() || isLoading}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteProjectDialog() {
  const { open, targetProject, isLoading, handleDelete, closeDialog } =
    useProjectDialogsContext()

  return (
    <Dialog open={open === "delete"} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          {targetProject && (
            <DialogDescription>
              This will permanently delete &ldquo;{targetProject.name}&rdquo;. This cannot be
              undone.
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectDialogs() {
  return (
    <>
      <CreateProjectDialog />
      <RenameProjectDialog />
      <DeleteProjectDialog />
    </>
  )
}
