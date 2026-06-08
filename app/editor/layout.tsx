import { EditorShell } from "@/components/editor/editor-shell"
import { getEditorProjects, type ProjectItem } from "@/lib/project-data"
import { AsyncTimeoutError, withTimeout } from "@/lib/async-timeout"
import { isTransientUpstreamError } from "@/lib/upstream-errors"

const EDITOR_PROJECTS_TIMEOUT_MS = 5_000

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  let owned: ProjectItem[] = []
  let shared: ProjectItem[] = []

  try {
    const projects = await withTimeout(
      getEditorProjects(),
      EDITOR_PROJECTS_TIMEOUT_MS,
      'Timed out while loading editor projects',
    )
    owned = projects.owned
    shared = projects.shared
  } catch (error) {
    if (!(error instanceof AsyncTimeoutError) && !isTransientUpstreamError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unable to load editor projects'
    console.error('[editor-layout]', message)
  }

  return (
    <EditorShell initialOwned={owned} initialShared={shared}>
      {children}
    </EditorShell>
  )
}
