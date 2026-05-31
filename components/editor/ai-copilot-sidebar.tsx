"use client"

import { useState } from 'react'
import { Settings, MessageCircle, Send, Sparkles, Workflow, BookOpen } from 'lucide-react'

function ChatPendingCard() {
  return (
    <div className="rounded-2xl border border-surface-border bg-elevated p-4">
      <div className="flex items-start gap-3">
        <div className="flex-none h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-copy-primary">Chat surface pending</p>
          <p className="text-xs text-copy-muted mt-0.5 leading-relaxed">
            The toggle is wired. Messaging and generation are intentionally out of scope here.
          </p>
        </div>
      </div>
    </div>
  )
}

function FutureHooksCard() {
  const hooks = [
    {
      icon: Sparkles,
      label: 'Prompt composer',
      description: 'Craft and refine AI prompts for your project',
    },
    {
      icon: Workflow,
      label: 'Run status',
      description: 'Monitor active generation and tool runs',
    },
    {
      icon: BookOpen,
      label: 'Architecture guidance',
      description: 'AI-assisted design decisions and patterns',
    },
  ]

  return (
    <div className="rounded-2xl border border-surface-border bg-elevated p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-copy-muted mb-3">
        Future Hooks
      </p>
      <p className="text-xs text-copy-muted leading-relaxed mb-4">
        Prompt composer, run status, and architecture guidance will attach to this sidebar.
      </p>
      <div className="flex flex-col gap-2.5">
        {hooks.map((hook) => (
          <div key={hook.label} className="flex items-start gap-2.5">
            <div className="flex-none h-7 w-7 rounded-lg bg-surface flex items-center justify-center mt-0.5">
              <hook.icon className="h-3.5 w-3.5 text-copy-muted" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-copy-primary">{hook.label}</p>
              <p className="text-[11px] text-copy-muted leading-snug">{hook.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AICopilotSidebar() {
  const [message, setMessage] = useState('')

  return (
    <aside className="w-80 h-full flex-none border-l border-surface-border bg-surface flex flex-col">
      <div className="flex-none flex items-center justify-between px-4 h-12 border-b border-surface-border">
        <div>
          <h2 className="text-sm font-semibold text-copy-primary leading-tight">AI Copilot</h2>
          <p className="text-[10px] text-copy-muted">Placeholder panel</p>
        </div>
        <button
          type="button"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors"
          aria-label="Copilot settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <ChatPendingCard />
        <FutureHooksCard />
      </div>

      <div className="flex-none p-3 border-t border-surface-border">
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-elevated px-3 py-2">
          <input
            type="text"
            placeholder="Ask the copilot…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled
            className="flex-1 bg-transparent text-sm text-copy-primary placeholder:text-copy-muted/50 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="flex-none h-7 w-7 rounded-lg flex items-center justify-center text-copy-muted disabled:opacity-30"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-copy-muted/50 text-center mt-1.5">
          Chat integration coming soon
        </p>
      </div>
    </aside>
  )
}
