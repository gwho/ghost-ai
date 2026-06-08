"use client"

import { useState, useRef, useCallback, useEffect, Suspense, Component, type ReactNode } from 'react'
import { Bot, X, FileText, Download, Send, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useFeedMessages, useCreateFeedMessage, useCreateFeed, useSelf, useEventListener } from '@liveblocks/react'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { validateAiChatMessage, validateAiStatusPayload } from '@/types/tasks'

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

interface AISidebarProps {
  onClose: () => void
  roomId: string
  onThinkingChange?: (thinking: boolean) => void
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

export function AISidebar({ onClose, roomId, onThinkingChange }: AISidebarProps) {
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

  // Listen for ai-status broadcasts directly from the Liveblocks room. This is
  // also the fallback completion signal if Trigger realtime tracking is unavailable.
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

  // AI Architect: push user message to architect feed, call design API, fetch token, track run
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

  // Chat: writes to ai-chat feed only — does NOT trigger the AI design agent
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
      <Tabs defaultValue="architect" className="flex-1 flex flex-col min-h-0">
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

        {/* AI Architect tab — full submit/track/complete flow */}
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
            {/* Status strip — compact bar above input, visible only while run is active */}
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

        {/* Chat tab — real-time room chat via ai-chat Liveblocks feed */}
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

      <RunTrackerErrorBoundary>
        <Suspense fallback={null}>
          {runId && publicToken && (
            <RunTracker runId={runId} publicToken={publicToken} onComplete={handleRunComplete} />
          )}
        </Suspense>
      </RunTrackerErrorBoundary>
    </aside>
  )
}
