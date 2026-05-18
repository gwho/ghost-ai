"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

/**
 * Render the fixed top editor navigation bar with a sidebar toggle button.
 *
 * @param isSidebarOpen - Whether the editor sidebar is currently open; controls the toggle icon and aria-label
 * @param onToggleSidebar - Click handler invoked to toggle the sidebar open state
 * @returns The navigation bar element containing the sidebar toggle and layout placeholders
 */
export function EditorNavbar({ isSidebarOpen, onToggleSidebar }: EditorNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-3 bg-surface border-b border-surface-border">
      <div>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-xl text-copy-muted hover:text-copy-primary transition-colors"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="flex-1" />

      <div />
    </nav>
  )
}
