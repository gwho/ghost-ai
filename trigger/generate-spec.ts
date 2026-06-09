import { schemaTask, metadata } from '@trigger.dev/sdk'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { AiChatMessageSchema } from '@/types/tasks'

const CanvasNodeSchema = z
  .object({
    id: z.string(),
    data: z
      .object({
        label: z.string(),
        shape: z.string().optional(),
        color: z.string().optional(),
      })
      .passthrough(),
    position: z.object({ x: z.number(), y: z.number() }),
  })
  .passthrough()

const CanvasEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    data: z.object({ label: z.string().optional() }).optional(),
  })
  .passthrough()

const SpecPayloadSchema = z.object({
  projectId: z.string(),
  roomId: z.string(),
  chatHistory: z.array(AiChatMessageSchema),
  nodes: z.array(CanvasNodeSchema),
  edges: z.array(CanvasEdgeSchema),
})

const SYSTEM_PROMPT = `You are a senior software architect producing a technical specification document.

Given a system architecture diagram (as a list of components and their connections) and an optional design discussion, write a clear Markdown technical specification.

Structure your output as follows:

# [System Name] — Technical Specification

## Overview
A brief summary of the system's purpose, its primary users, and the key architectural decisions.

## Components
One sub-section per component. For each, describe:
- What it does
- Its responsibilities
- Any notable implementation constraints

## Data Flows
Describe the key paths data takes through the system, referencing the connections between components.

## Design Decisions
If the design discussion contains decisions, trade-offs, or constraints the team agreed on, capture them here as bullet points.

Rules:
- Write in plain, precise technical prose
- Do not invent components or flows that are not in the input
- If the diagram is empty, write a brief placeholder noting no architecture has been defined yet
- Output only the Markdown document — no preamble, no code fences around the whole document`

export const generateSpec = schemaTask({
  id: 'generate-spec',
  schema: SpecPayloadSchema,
  retry: { maxAttempts: 2 },
  run: async (payload) => {
    const { projectId, nodes, edges, chatHistory } = payload

    metadata.set('status', 'generating')

    const nodesText =
      nodes.length > 0
        ? nodes
            .map((n) => `- ${n.data.label}${n.data.shape ? ` (${n.data.shape})` : ''} [id: ${n.id}]`)
            .join('\n')
        : '(no components defined)'

    const edgesText =
      edges.length > 0
        ? edges
            .map((e) => {
              const src = nodes.find((n) => n.id === e.source)
              const tgt = nodes.find((n) => n.id === e.target)
              const srcLabel = src?.data.label ?? e.source
              const tgtLabel = tgt?.data.label ?? e.target
              const rel = e.data?.label ? ` (${e.data.label})` : ''
              return `- ${srcLabel} → ${tgtLabel}${rel}`
            })
            .join('\n')
        : '(no connections defined)'

    const chatText =
      chatHistory.length > 0
        ? chatHistory
            .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n')
        : ''

    const sections = [
      `## Architecture Components\n${nodesText}`,
      `## Connections\n${edgesText}`,
      ...(chatText ? [`## Design Discussion\n${chatText}`] : []),
    ]

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      system: SYSTEM_PROMPT,
      prompt: sections.join('\n\n'),
    })

    metadata.set('status', 'saving')

    const specId = crypto.randomUUID()

    const blob = await put(
      `specs/${projectId}/${specId}.md`,
      result.text,
      { access: 'private', contentType: 'text/markdown; charset=utf-8', addRandomSuffix: false },
    )

    await prisma.projectSpec.create({
      data: { id: specId, projectId, filePath: blob.url },
    })

    metadata.set('status', 'complete')

    return { spec: result.text, specId, specUrl: blob.url }
  },
})
