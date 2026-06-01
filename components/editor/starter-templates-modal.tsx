"use client"

import { useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { type CanvasTemplate, CANVAS_TEMPLATES } from '@/components/editor/starter-templates'

interface StarterTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (template: CanvasTemplate) => void
}

interface TemplatePreviewProps {
  template: CanvasTemplate
}

function TemplatePreview({ template }: TemplatePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const W = el.width
    const H = el.height
    const PAD = 12

    const nodes = template.nodes
    const edges = template.edges

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const w = n.width ?? 120
      const h = n.height ?? 40
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w)
      maxY = Math.max(maxY, n.position.y + h)
    }

    const dataW = maxX - minX || 1
    const dataH = maxY - minY || 1
    const scaleX = (W - PAD * 2) / dataW
    const scaleY = (H - PAD * 2) / dataH
    const scale = Math.min(scaleX, scaleY)

    // Center within the canvas
    const offsetX = PAD + ((W - PAD * 2) - dataW * scale) / 2
    const offsetY = PAD + ((H - PAD * 2) - dataH * scale) / 2

    const toCanvas = (x: number, y: number) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (y - minY) * scale,
    })

    ctx.clearRect(0, 0, W, H)

    // Node centre lookup for edge drawing
    const centers = new Map<string, { x: number; y: number }>()
    for (const n of nodes) {
      const w = n.width ?? 120
      const h = n.height ?? 40
      const p = toCanvas(n.position.x + w / 2, n.position.y + h / 2)
      centers.set(n.id, p)
    }

    // Draw edges first (behind nodes)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    for (const edge of edges) {
      const src = centers.get(edge.source)
      const tgt = centers.get(edge.target)
      if (!src || !tgt) continue
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.stroke()
    }

    // Draw nodes
    for (const n of nodes) {
      const w = (n.width ?? 120) * scale
      const h = (n.height ?? 40) * scale
      const p = toCanvas(n.position.x, n.position.y)

      ctx.fillStyle = (n.data.color as string) ?? '#1F1F1F'
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      // Use roundRect when available; fall back to rect
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(p.x, p.y, w, h, 2)
      } else {
        ctx.rect(p.x, p.y, w, h)
      }
      ctx.fill()
      ctx.stroke()
    }
  }, [template])

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={130}
      className="w-full rounded-xl bg-base"
    />
  )
}

export function StarterTemplatesModal({
  open,
  onOpenChange,
  onImport,
}: StarterTemplatesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Starter Templates</DialogTitle>
          <DialogDescription>
            Choose a pre-built architecture to start from. This will replace your current canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] grid grid-cols-2 gap-4 pr-1">
          {CANVAS_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-3"
            >
              <TemplatePreview template={template} />

              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-copy-primary">
                  {template.name}
                </span>
                <span className="text-xs text-copy-muted leading-relaxed">
                  {template.description}
                </span>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  onImport(template)
                  onOpenChange(false)
                }}
                className="w-full"
              >
                Import
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
