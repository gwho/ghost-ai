import { EditorHomeActions } from "@/components/editor/editor-home-actions"

export default function EditorPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <h2 className="text-lg font-semibold text-copy-primary">
        Create a project or open an existing one
      </h2>
      <p className="text-sm text-copy-muted">
        Start a new architecture workspace, or choose a project from the sidebar.
      </p>
      <EditorHomeActions />
    </div>
  )
}
