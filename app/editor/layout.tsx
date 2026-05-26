import { EditorShell } from "@/components/editor/editor-shell"
import { getEditorProjects } from "@/lib/project-data"

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const { owned, shared } = await getEditorProjects()

  return (
    <EditorShell initialOwned={owned} initialShared={shared}>
      {children}
    </EditorShell>
  )
}
