"use client"

import { useState } from "react"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"

/**
 * Layout component that provides the editor UI shell with a navbar and project sidebar.
 *
 * @param children - Content rendered inside the editor's main area below the navbar
 * @returns The layout element containing the editor navbar, project sidebar, and main content area
 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-base">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="pt-14 h-full">{children}</main>
    </div>
  )
}
