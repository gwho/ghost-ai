# Feature 18 — Starter Templates: Implementation Plan

## Context

Feature 18 adds a pre-built template library so users can start a canvas from a ready-made
architecture diagram instead of building from scratch. The spec is at
`docs/spec-explanations/18-starter-templates.md`. This plan covers the full implementation
approach — new files, files to modify, and the docs to produce.

---

## Files Created

### 1. `components/editor/starter-templates.ts`

Pure data layer — no React. Exports:

- `CanvasTemplate` interface: `id`, `name`, `description`, `nodes: CanvasNode[]`, `edges: CanvasEdge[]`
- Private `makeNode` / `makeEdge` helpers that keep template definitions readable (one line per node)
- `CANVAS_TEMPLATES` array with three templates: Microservices Architecture, CI/CD Pipeline, Event-Driven System

Each node uses `type: 'canvasNode'`, a `NODE_COLORS` fill colour, a valid `NodeShape`, and
explicit `width`/`height`. Each edge uses `type: 'canvasEdge'`.

---

### 2. `components/editor/starter-templates-modal.tsx`

`"use client"` component. Exports `StarterTemplatesModal`.

Props: `open`, `onOpenChange`, `onImport(template)`.

Structure:
- shadcn `Dialog` (same pattern as `ShareDialog`, `project-dialogs.tsx`)
- Scrollable 2-column card grid (`overflow-y-auto max-h-[60vh] grid grid-cols-2 gap-4`)
- Each card: `TemplatePreview` + name + description + Import button

**Private `TemplatePreview`** component:
- `<canvas width={220} height={130}>` drawn in `useEffect([template])`
- Steps: compute bounding box → uniform scale → build `Map<id, center>` → draw edges as lines → draw nodes as filled `roundRect`
- No React Flow instance — HTML Canvas 2D API only

---

## Files Modified

### 3. `components/editor/canvas-flow.tsx`

- Added `CanvasFlowProps`: `isTemplatesOpen: boolean`, `onTemplatesOpenChange: (open: boolean) => void`
- Both `CanvasFlow` and `CanvasFlowInner` accept these props
- Added `loadTemplate` callback (closes over `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `reactFlow`):
  - Remove all current nodes → remove all current edges → add template nodes → add template edges → `fitView({ duration: 200 })`
- Renders `<StarterTemplatesModal>` inside `CanvasFlowInner`

### 4. `components/editor/canvas-wrapper.tsx`

- Added `isTemplatesOpen` and `onTemplatesOpenChange` to `CanvasWrapperProps`
- Forwards both props to `<CanvasFlow>`

### 5. `components/editor/workspace-shell.tsx`

- Added `isTemplatesOpen` state
- Added Templates navbar button (before Share): `LayoutTemplate` icon from `lucide-react`
- Passes `isTemplatesOpen` / `onTemplatesOpenChange={setIsTemplatesOpen}` to `CanvasWrapper`

### 6. `context/progress-tracker.md`

- Current Phase updated to Feature 18 complete
- Feature 18 Completed entry added
- Next Up updated to Feature 19

---

## Docs Created

### 7. `docs/spec-explanations/18-starter-templates-explanation.md`

Comprehensive post-implementation explanation following the feature 17 format:
- What This Feature Does
- How the Template Data Works
- How the Modal Works
- How the Canvas Preview Works
- How Template Import Works
- Why These Design Decisions? (table)
- Topics to Explore with an AI (5 sections × 5 questions)

---

## Verification

1. `npm run build` passes
2. Workspace navbar shows a "Templates" button with `LayoutTemplate` icon
3. Clicking Templates opens the modal with 3 cards, each with a diagram preview
4. Import button clears the canvas and loads the template; viewport fits to the content
5. A second Import replaces the first template
6. Collaborators in the same room see the loaded template (Liveblocks sync)

---

## Constraints (from spec)

- No template saving
- No custom user templates
- No server persistence
- No changes to node or edge rendering behaviour
- `docs/spec-explanations/18-starter-templates.md` is not modified
