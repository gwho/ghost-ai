import { z } from 'zod'

// ai-chat feed: typed payload for persistent room chat messages.
export const AiChatMessageSchema = z.object({
  sender: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.number(),
})
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>
export function validateAiChatMessage(raw: unknown): AiChatMessage | null {
  const result = AiChatMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}

// ai-status-feed: the logical name for the ai-status RoomEvent channel.
// Messages broadcast by the design-agent via broadcastEvent({ type: 'ai-status', ... })
// flow through useEventListener in canvas-flow.tsx and are validated here before display.

export interface AiStatusPayload {
  type: 'ai-status'
  message: string
  status: 'start' | 'processing' | 'complete' | 'error'
  text?: string
}

const VALID_STATUSES = new Set(['start', 'processing', 'complete', 'error'])

export function validateAiStatusPayload(raw: unknown): AiStatusPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.type !== 'ai-status') return null
  if (typeof obj.message !== 'string') return null
  if (!VALID_STATUSES.has(obj.status as string)) return null
  if (obj.text !== undefined && typeof obj.text !== 'string') return null
  return obj as unknown as AiStatusPayload
}
