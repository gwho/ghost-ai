"use client"

import { useState, useRef, useCallback } from 'react'
import { Bot, X, FileText, Download, Send } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTER_CHIPS = [
  'Design an e-commerce backend',
  'Create a chat app architecture',
  'Build a CI/CD pipeline',
]

interface AISidebarProps {
  onClose: () => void
}

export function AISidebar({ onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const submit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 0)
  }, [input])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const handleChip = useCallback((chip: string) => {
    setInput(chip)
    textareaRef.current?.focus()
  }, [])

  return (
    <aside className="w-full h-full flex flex-col bg-base/95 border-l border-surface-border shadow-2xl">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <div className="flex-none h-8 w-8 rounded-xl bg-ai-accent/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-ai-text" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-copy-primary leading-tight">AI Workspace</h2>
          <p className="text-[11px] text-copy-muted leading-tight">Collaborate with Ghost AI</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-none h-7 w-7 rounded-xl flex items-center justify-center text-copy-muted hover:text-copy-primary hover:bg-elevated transition-colors"
          aria-label="Close AI sidebar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="architect" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-none mx-4 mt-3 grid grid-cols-2 h-9 bg-surface rounded-xl">
          <TabsTrigger
            value="architect"
            className="text-copy-muted data-[state=active]:bg-ai-accent/20 data-[state=active]:text-ai-text data-[state=active]:shadow-none"
          >
            AI Architect
          </TabsTrigger>
          <TabsTrigger
            value="specs"
            className="text-copy-muted data-[state=active]:bg-ai-accent/20 data-[state=active]:text-ai-text data-[state=active]:shadow-none"
          >
            Specs
          </TabsTrigger>
        </TabsList>

        {/* AI Architect tab */}
        <TabsContent value="architect" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          {/* Scrollable chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 pt-8 pb-4">
                <div className="h-12 w-12 rounded-2xl bg-ai-accent/20 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-ai-text" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-copy-primary">Ghost AI Architect</p>
                  <p className="text-xs text-copy-muted mt-1 leading-relaxed max-w-[200px]">
                    Describe your system and I&apos;ll help design the architecture.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {STARTER_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChip(chip)}
                      className="text-left px-3 py-2 rounded-xl bg-subtle text-ai-text text-xs hover:bg-elevated transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg, i) =>
                  msg.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-brand-dim border-2 border-brand/50 text-copy-primary text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-elevated border border-surface-border text-ai-text text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="flex-none p-3 border-t border-surface-border">
            <div className="rounded-2xl border border-surface-border bg-elevated overflow-hidden">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  autoResize()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Describe your architecture…"
                rows={1}
                className="min-h-[72px] max-h-[160px] resize-none bg-transparent border-0 rounded-none focus-visible:ring-0 text-sm text-copy-primary placeholder:text-copy-muted/50 px-3 pt-3 pb-1"
              />
              <div className="flex justify-end px-2 pb-2">
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!input.trim()}
                  className="h-7 px-3 bg-ai-accent text-white hover:bg-ai-accent/90 disabled:opacity-40"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Specs tab */}
        <TabsContent value="specs" className="flex-1 px-4 py-3 mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4">
            <Button className="w-full bg-ai-accent text-white hover:bg-ai-accent/90">
              Generate Spec
            </Button>
            <div className="rounded-2xl border border-surface-border bg-elevated p-4">
              <div className="flex items-start gap-3">
                <div className="flex-none h-9 w-9 rounded-xl bg-surface flex items-center justify-center">
                  <FileText className="h-4 w-4 text-ai-text" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-copy-primary leading-tight">
                    Microservices Architecture
                  </p>
                  <p className="text-xs text-copy-muted mt-1 leading-relaxed line-clamp-2">
                    API Gateway → Auth Service → Product Catalog → Order Processing → Notification
                    Service
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  aria-label="Download spec"
                  className="flex-none h-7 w-7 rounded-xl flex items-center justify-center text-copy-muted disabled:opacity-30"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
