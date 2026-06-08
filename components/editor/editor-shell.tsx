"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ProjectDialogsProvider } from "@/components/editor/project-dialogs-context"
import type { ProjectItem } from "@/lib/project-data"

interface EditorShellProps {
  children: React.ReactNode
  initialOwned: ProjectItem[]
  initialShared: ProjectItem[]
}

export function EditorShell({ children, initialOwned, initialShared }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isWorkspace = pathname.startsWith('/editor/')

  return (
    <ProjectDialogsProvider initialOwned={initialOwned} initialShared={initialShared}>
      <div className="h-screen overflow-hidden bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          isWorkspace={isWorkspace}
        />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-overlay md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <ProjectSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="pt-14 h-full">{children}</main>
      </div>
    </ProjectDialogsProvider>
  )
}
