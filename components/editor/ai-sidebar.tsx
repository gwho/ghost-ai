"use client"

import { useState, useRef, useCallback, useEffect, Suspense, Component, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, X, FileText, Download, Send, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useFeedMessages, useCreateFeedMessage, useCreateFeed, useSelf, useEventListener } from '@liveblocks/react'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { validateAiChatMessage, validateAiStatusPayload } from '@/types/tasks'
import type { CanvasNode, CanvasEdge } from '@/types/canvas'

const CHAT_FEED_ID = 'ai-chat'
const ARCHITECT_FEED_ID = 'ai-architect-feed'

interface RunTrackerProps {
  runId: string
  publicToken: string
  onComplete: (succeeded: boolean) => void
}

const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'CRASHED',
  'SYSTEM_FAILURE',
])

function RunTracker({ runId, publicToken, onComplete }: RunTrackerProps) {
  const onCompleteRef = useRef(onComplete)
  const firedRef = useRef(false)

  const { run, error } = useRealtimeRun(runId, { accessToken: publicToken })

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!run || firedRef.current) return
    if (TERMINAL_STATUSES.has(run.status)) {
      firedRef.current = true
      onCompleteRef.current(run.status === 'COMPLETED')
    }
  }, [run])

  useEffect(() => {
    if (!error || firedRef.current) return
    firedRef.current = true
    onCompleteRef.current(false)
  }, [error])

  return null
}

class RunTrackerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    return this.state.hasError ? null : this.props.children
  }
}

const STARTER_CHIPS = [
  'Design an e-commerce backend',
  'Create a chat app architecture',
  'Build a CI/CD pipeline',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}

interface SpecItem {
  id: string
  filePath: string
  createdAt: string
}

interface AISidebarProps {
  onClose: () => void
  roomId: string
  onThinkingChange?: (thinking: boolean) => void
  getCanvasSnapshot?: () => { nodes: CanvasNode[]; edges: CanvasEdge[] } | null
}

function getRunStorageKey(roomId: string) {
  return `ghost-ai-run:${roomId}`
}

function loadPersistedRun(roomId: string): { runId: string; publicToken: string } | null {
  try {
    const raw = sessionStorage.getItem(getRunStorageKey(roomId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed.runId === 'string' && typeof parsed.publicToken === 'string') {
      return parsed
    }
  } catch { /* corrupted or unavailable */ }
  return null
}

function persistRun(roomId: string, runId: string, publicToken: string) {
  try {
    sessionStorage.setItem(getRunStorageKey(roomId), JSON.stringify({ runId, publicToken }))
  } catch { /* storage full or unavailable */ }
}

function clearPersistedRun(roomId: string) {
  try {
    sessionStorage.removeItem(getRunStorageKey(roomId))
  } catch { /* unavailable */ }
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-base font-bold text-copy-primary mb-3 mt-5 first:mt-0 border-b border-surface-border pb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-sm font-semibold text-copy-primary mb-2 mt-4">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-medium text-copy-primary mb-2 mt-3">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-sm text-copy-primary mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-sm text-copy-primary">{children}</li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = Boolean(className)
    return isBlock ? (
      <code className="block p-3 rounded-xl bg-surface text-xs font-mono text-ai-text overflow-x-auto mb-3">{children}</code>
    ) : (
      <code className="px-1 py-0.5 rounded bg-surface text-ai-text text-xs font-mono">{children}</code>
    )
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl">{children}</pre>
  ),
  hr: () => <hr className="border-surface-border my-4" />,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-copy-primary">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-copy-primary">{children}</em>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-ai-accent pl-3 mb-3 text-copy-muted">{children}</blockquote>
  ),
}

export function AISidebar({ onClose, roomId, onThinkingChange, getCanvasSnapshot }: AISidebarProps) {
  const [input, setInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatSendError, setChatSendError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(() => loadPersistedRun(roomId)?.runId ?? null)
  const [publicToken, setPublicToken] = useState<string | null>(() => loadPersistedRun(roomId)?.publicToken ?? null)
  const [isLoading, setIsLoading] = useState(() => loadPersistedRun(roomId) !== null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [trackingWarning, setTrackingWarning] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const architectScrollRef = useRef<HTMLDivElement>(null)
  const completionHandledRef = useRef(false)

  // Specs tab state
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [specsLoading, setSpecsLoading] = useState(false)
  const [specsError, setSpecsError] = useState<string | null>(null)
  const [isSpecGenerating, setIsSpecGenerating] = useState(false)
  const [specGenError, setSpecGenError] = useState<string | null>(null)
  const [specRunId, setSpecRunId] = useState<string | null>(null)
  const [specPublicToken, setSpecPublicToken] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSpec, setPreviewSpec] = useState<SpecItem | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const me = useSelf()
  const createFeed = useCreateFeed()
  const { messages: rawChatMessages } = useFeedMessages(CHAT_FEED_ID)
  const { messages: rawArchitectMessages } = useFeedMessages(ARCHITECT_FEED_ID)
  const createFeedMessage = useCreateFeedMessage()

  useEffect(() => {
    createFeed(CHAT_FEED_ID).catch(() => {})
    createFeed(ARCHITECT_FEED_ID).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chatMessages = (rawChatMessages ?? [])
    .map((m) => ({ id: m.id, data: validateAiChatMessage(m.data) }))
    .filter((m): m is { id: string; data: NonNullable<ReturnType<typeof validateAiChatMessage>> } => m.data !== null)

  const architectMessages = (rawArchitectMessages ?? [])
    .map((m) => ({ id: m.id, data: validateAiChatMessage(m.data) }))
    .filter((m): m is { id: string; data: NonNullable<ReturnType<typeof validateAiChatMessage>> } => m.data !== null)

  // --- Spec list ---

  const fetchSpecs = useCallback(async () => {
    setSpecsLoading(true)
    setSpecsError(null)
    try {
      const res = await fetch(`/api/projects/${roomId}/specs`)
      if (!res.ok) throw new Error('fetch-failed')
      const body: unknown = await res.json()
      if (isObject(body) && Array.isArray(body.specs)) {
        setSpecs(body.specs as SpecItem[])
      }
    } catch {
      setSpecsError('Failed to load specs. Please try again.')
    } finally {
      setSpecsLoading(false)
    }
  }, [roomId])

  const handleTabChange = useCallback((value: string) => {
    if (value === 'specs') {
      fetchSpecs()
    }
  }, [fetchSpecs])

  // --- Download helper ---

  const downloadSpec = useCallback(async (specId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const res = await fetch(`/api/projects/${roomId}/specs/${specId}/download`)
      if (!res.ok) throw new Error('download-failed')
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `spec-${specId}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silently fail — network issues */ }
  }, [roomId])

  // --- Preview modal ---

  const openPreview = useCallback(async (spec: SpecItem) => {
    setPreviewSpec(spec)
    setPreviewContent(null)
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const res = await fetch(`/api/projects/${roomId}/specs/${spec.id}/download`)
      if (!res.ok) throw new Error('fetch-failed')
      const text = await res.text()
      setPreviewContent(text)
    } catch {
      setPreviewContent(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [roomId])

  // --- Generate Spec ---

  const specCompletionHandledRef = useRef(false)

  const handleSpecRunComplete = useCallback(async (succeeded: boolean) => {
    if (specCompletionHandledRef.current) return
    specCompletionHandledRef.current = true
    setIsSpecGenerating(false)
    setSpecRunId(null)
    setSpecPublicToken(null)
    if (succeeded) {
      await fetchSpecs()
    } else {
      setSpecGenError('Spec generation failed. Please try again.')
    }
  }, [fetchSpecs])

  const submitSpec = useCallback(async () => {
    if (isSpecGenerating) return

    setIsSpecGenerating(true)
    setSpecGenError(null)
    specCompletionHandledRef.current = false

    const snapshot = getCanvasSnapshot?.() ?? { nodes: [], edges: [] }
    const chatHistory = architectMessages.map((m) => ({
      sender: m.data.sender,
      role: m.data.role,
      content: m.data.content,
      timestamp: m.data.timestamp,
    }))

    let hasStartedRun = false

    try {
      const res = await fetch('/api/ai/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          chatHistory,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
        }),
      })
      if (!res.ok) throw new Error('spec-api')

      const body: unknown = await res.json()
      if (!isObject(body) || typeof body.runId !== 'string') throw new Error('spec-api-shape')

      const newRunId = body.runId
      hasStartedRun = true

      if (body.trackingUnavailable === true) {
        setSpecGenError('Spec generation started. Refresh the list in a moment.')
        setIsSpecGenerating(false)
        return
      }

      const tokenRes = await fetch('/api/ai/spec/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: newRunId }),
      })
      if (!tokenRes.ok) throw new Error('token-api')

      const tokenBody: unknown = await tokenRes.json()
      if (!isObject(tokenBody) || typeof tokenBody.token !== 'string') throw new Error('token-shape')

      setSpecRunId(newRunId)
      setSpecPublicToken(tokenBody.token)
    } catch {
      setIsSpecGenerating(false)
      setSpecRunId(null)
      setSpecPublicToken(null)
      specCompletionHandledRef.current = true
      if (hasStartedRun) {
        setSpecGenError('Spec generation started. Refresh the list in a moment.')
      } else {
        setSpecGenError('Failed to start spec generation. Please try again.')
      }
    }
  }, [isSpecGenerating, roomId, getCanvasSnapshot, architectMessages])

  // --- Design run ---

  const handleRunComplete = useCallback(
    async (succeeded: boolean) => {
      if (completionHandledRef.current) return
      completionHandledRef.current = true
      const content = succeeded
        ? 'AI design complete! The canvas has been updated.'
        : 'AI run ended unexpectedly. Please try again.'
      createFeedMessage(ARCHITECT_FEED_ID, {
        sender: 'Ghost AI',
        role: 'assistant',
        content,
        timestamp: Date.now(),
      }).catch(() => {})
      clearPersistedRun(roomId)
      setRunId(null)
      setPublicToken(null)
      setIsLoading(false)
      setTrackingWarning(null)
      onThinkingChange?.(false)
    },
    [createFeedMessage, onThinkingChange, roomId],
  )

  useEventListener(({ event }) => {
    const payload = validateAiStatusPayload(event)
    if (!payload) return
    setStatusText(payload.message)
    if (payload.status === 'complete' || payload.status === 'error') {
      setStatusText(null)
      if (isLoading) {
        handleRunComplete(payload.status === 'complete')
      }
    }
  })

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const submitAi = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    let hasStartedRun = false

    try {
      await createFeedMessage(ARCHITECT_FEED_ID, {
        sender: me?.info.name ?? 'Unknown',
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      })
    } catch { /* non-fatal */ }

    setTimeout(() => {
      architectScrollRef.current?.scrollTo({ top: architectScrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 0)

    completionHandledRef.current = false
    setTrackingWarning(null)

    try {
      const designRes = await fetch('/api/ai/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, roomId, projectId: roomId }),
      })
      if (!designRes.ok) throw new Error('design-api')

      const designBody: unknown = await designRes.json()
      if (!isObject(designBody) || typeof designBody.runId !== 'string') {
        throw new Error('design-api-shape')
      }

      const newRunId = designBody.runId
      hasStartedRun = true
      setRunId(newRunId)
      setPublicToken(null)
      setIsLoading(true)
      setStatusText('AI design run started…')
      onThinkingChange?.(true)

      if (designBody.trackingUnavailable === true) {
        throw new Error('tracking-unavailable')
      }

      const tokenRes = await fetch('/api/ai/design/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: newRunId }),
      })
      if (!tokenRes.ok) {
        throw new Error('token-api')
      }

      const tokenBody: unknown = await tokenRes.json()
      if (!isObject(tokenBody) || typeof tokenBody.token !== 'string') {
        throw new Error('token-api-shape')
      }

      persistRun(roomId, newRunId, tokenBody.token)
      setPublicToken(tokenBody.token)
    } catch {
      if (hasStartedRun) {
        const warning = 'Design run started, but realtime tracking is unavailable. Watching canvas status instead.'
        setTrackingWarning(warning)
        setStatusText(warning)
        createFeedMessage(ARCHITECT_FEED_ID, {
          sender: 'Ghost AI',
          role: 'assistant',
          content: warning,
          timestamp: Date.now(),
        }).catch(() => {})
        return
      }

      completionHandledRef.current = true
      setRunId(null)
      setPublicToken(null)
      setIsLoading(false)
      setTrackingWarning(null)
      onThinkingChange?.(false)
      createFeedMessage(ARCHITECT_FEED_ID, {
        sender: 'Ghost AI',
        role: 'assistant',
        content: 'Failed to start AI design run. Please try again.',
        timestamp: Date.now(),
      }).catch(() => {})
    }
  }, [input, isLoading, roomId, createFeedMessage, me, onThinkingChange])

  const submitChat = useCallback(async () => {
    const trimmed = chatInput.trim()
    if (!trimmed) return

    setChatSendError(null)

    try {
      await createFeedMessage(CHAT_FEED_ID, {
        sender: me?.info.name ?? 'Unknown',
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      })
    } catch {
      setChatSendError('Failed to send. Please try again.')
      return
    }

    setChatInput('')
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto'
    }

    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 0)
  }, [chatInput, createFeedMessage, me])

  const handleAiKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submitAi()
      }
    },
    [submitAi],
  )

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submitChat()
      }
    },
    [submitChat],
  )

  const handleChip = useCallback((chip: string) => {
    setInput(chip)
    textareaRef.current?.focus()
  }, [])

  const myName = me?.info.name
  const visibleStatusText = statusText ?? trackingWarning

  return (
    <aside className="w-full h-full flex flex-col bg-base/95 border-l border-surface-border shadow-2xl">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <div className="relative flex-none h-8 w-8 rounded-xl bg-ai-accent/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-ai-text" />
          {isLoading && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ai-accent animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-copy-primary leading-tight">AI Workspace</h2>
          <p className="text-[11px] text-copy-muted leading-tight">
            {isLoading ? 'AI is thinking…' : 'Collaborate with Ghost AI'}
          </p>
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
      <Tabs defaultValue="architect" className="flex-1 flex flex-col min-h-0" onValueChange={handleTabChange}>
        <TabsList className="flex-none mx-4 mt-3 grid grid-cols-3 h-9 bg-surface rounded-xl">
          <TabsTrigger
            value="architect"
            className="text-copy-muted data-[state=active]:bg-ai-accent/20 data-[state=active]:text-ai-text data-[state=active]:shadow-none"
          >
            AI Architect
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="text-copy-muted data-[state=active]:bg-ai-accent/20 data-[state=active]:text-ai-text data-[state=active]:shadow-none"
          >
            Chat
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
          <div ref={architectScrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {architectMessages.length === 0 ? (
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
                {architectMessages.map(({ id, data }) => {
                  const isOwn = data.role === 'user' && data.sender === myName
                  const isAi = data.role === 'assistant'
                  return (
                    <div key={id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isOwn && (
                          <span className="text-[10px] text-copy-muted px-1">
                            {isAi ? 'Ghost AI' : data.sender}
                          </span>
                        )}
                        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          isOwn
                            ? 'bg-ai-accent text-white'
                            : 'bg-elevated border border-surface-border text-ai-text'
                        }`}>
                          {data.content}
                        </div>
                        <span className="text-[10px] text-copy-muted px-1">
                          {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-none p-3 border-t border-surface-border">
            {isLoading && visibleStatusText && (
              <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-ai-accent/30">
                <span className="h-1.5 w-1.5 rounded-full bg-ai-accent animate-pulse flex-none" />
                <p className="text-[11px] text-copy-muted flex-1 truncate">{visibleStatusText}</p>
              </div>
            )}
            <div className="rounded-2xl border border-surface-border bg-elevated overflow-hidden">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  autoResize(textareaRef.current)
                }}
                onKeyDown={handleAiKeyDown}
                placeholder={isLoading ? 'AI is working…' : 'Describe your architecture…'}
                rows={1}
                disabled={isLoading}
                className="min-h-[72px] max-h-[160px] resize-none bg-transparent border-0 rounded-none focus-visible:ring-0 text-sm text-copy-primary placeholder:text-copy-muted/50 px-3 pt-3 pb-1 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-end px-2 pb-2">
                <Button
                  size="sm"
                  onClick={submitAi}
                  disabled={isLoading || !input.trim()}
                  className="h-7 px-3 bg-ai-accent text-white hover:bg-ai-accent/90 disabled:opacity-40"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Thinking…
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Chat tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 pt-8 pb-4">
                <div className="h-12 w-12 rounded-2xl bg-ai-accent/20 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-ai-text" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-copy-primary">Room Chat</p>
                  <p className="text-xs text-copy-muted mt-1 leading-relaxed max-w-[200px]">
                    No messages yet. Start the conversation with your collaborators.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {chatMessages.map(({ id, data }) => {
                  const isOwn = data.role === 'user' && data.sender === myName
                  const isAi = data.role === 'assistant'
                  return (
                    <div key={id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isOwn && (
                          <span className="text-[10px] text-copy-muted px-1">
                            {isAi ? 'Ghost AI' : data.sender}
                          </span>
                        )}
                        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          isOwn
                            ? 'bg-ai-accent text-white'
                            : 'bg-elevated border border-surface-border text-ai-text'
                        }`}>
                          {data.content}
                        </div>
                        <span className="text-[10px] text-copy-muted px-1">
                          {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-none p-3 border-t border-surface-border">
            {chatSendError && (
              <div className="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-elevated border border-surface-border">
                <AlertCircle className="h-3 w-3 text-destructive flex-none" />
                <p className="text-[11px] text-destructive">{chatSendError}</p>
              </div>
            )}
            <div className="rounded-2xl border border-surface-border bg-elevated overflow-hidden">
              <Textarea
                ref={chatTextareaRef}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value)
                  autoResize(chatTextareaRef.current)
                  setChatSendError(null)
                }}
                onKeyDown={handleChatKeyDown}
                placeholder="Message your collaborators…"
                rows={1}
                className="min-h-[72px] max-h-[160px] resize-none bg-transparent border-0 rounded-none focus-visible:ring-0 text-sm text-copy-primary placeholder:text-copy-muted/50 px-3 pt-3 pb-1"
              />
              <div className="flex justify-end px-2 pb-2">
                <Button
                  size="sm"
                  onClick={submitChat}
                  disabled={!chatInput.trim()}
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
        <TabsContent value="specs" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          {/* Generate button */}
          <div className="flex-none px-4 pt-3 pb-2 border-b border-surface-border">
            <Button
              onClick={submitSpec}
              disabled={isSpecGenerating}
              className="w-full bg-ai-accent text-white hover:bg-ai-accent/90 disabled:opacity-60"
            >
              {isSpecGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate Spec'
              )}
            </Button>
            {specGenError && (
              <p className="text-[11px] text-copy-muted mt-2 text-center leading-relaxed">{specGenError}</p>
            )}
          </div>

          {/* Spec list */}
          <ScrollArea className="flex-1">
            {specsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 text-copy-muted animate-spin" />
              </div>
            ) : specsError ? (
              <div className="flex flex-col items-center gap-2 py-8 px-4">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-xs text-copy-muted text-center">{specsError}</p>
                <button
                  type="button"
                  onClick={fetchSpecs}
                  className="text-xs text-ai-text underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : specs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 pt-8 pb-4 px-4">
                <div className="h-10 w-10 rounded-2xl bg-ai-accent/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-copy-muted" />
                </div>
                <p className="text-xs text-copy-muted text-center leading-relaxed max-w-[180px]">
                  No specs yet. Generate one to get started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-3">
                {specs.map((spec) => (
                  <div
                    key={spec.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPreview(spec)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPreview(spec) }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-surface-border bg-elevated hover:bg-surface transition-colors cursor-pointer group"
                  >
                    <div className="flex-none h-8 w-8 rounded-xl bg-surface flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-ai-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-copy-primary truncate">
                        {getSpecFilename(spec.filePath)}
                      </p>
                      <p className="text-[11px] text-copy-muted">
                        {new Date(spec.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => downloadSpec(spec.id, e)}
                      aria-label="Download spec"
                      className="flex-none h-7 w-7 rounded-xl flex items-center justify-center text-copy-muted hover:text-copy-primary hover:bg-surface transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Design run tracker */}
      <RunTrackerErrorBoundary>
        <Suspense fallback={null}>
          {runId && publicToken && (
            <RunTracker runId={runId} publicToken={publicToken} onComplete={handleRunComplete} />
          )}
        </Suspense>
      </RunTrackerErrorBoundary>

      {/* Spec gen run tracker */}
      <RunTrackerErrorBoundary>
        <Suspense fallback={null}>
          {specRunId && specPublicToken && (
            <RunTracker runId={specRunId} publicToken={specPublicToken} onComplete={handleSpecRunComplete} />
          )}
        </Suspense>
      </RunTrackerErrorBoundary>

      {/* Spec preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[80vh] bg-elevated border-surface-border">
          <DialogHeader>
            <DialogTitle className="text-copy-primary text-sm font-semibold">
              {previewSpec ? getSpecFilename(previewSpec.filePath) : 'Spec Preview'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-2 -mx-6 px-6">
            {previewLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 text-copy-muted animate-spin" />
              </div>
            ) : previewContent ? (
              <div className="pb-4">
                <ReactMarkdown components={markdownComponents}>{previewContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-copy-muted">Failed to load spec content.</p>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => previewSpec && downloadSpec(previewSpec.id)}
              disabled={!previewContent}
              className="bg-ai-accent text-white hover:bg-ai-accent/90 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
