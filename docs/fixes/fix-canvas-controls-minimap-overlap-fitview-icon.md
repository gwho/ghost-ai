# Fix: Canvas Controls — MiniMap Overlap and Fit View Icon Ambiguity

## What Was Wrong

Two separate problems appeared together in the canvas controls bar introduced in Feature 17.

### Problem 1: MiniMap covering the Zoom Out button

React Flow's `<MiniMap>` was rendered without an explicit `position` prop:

```tsx
<MiniMap />
```

React Flow panel components (MiniMap, Controls, etc.) are positioned absolutely
inside the `<ReactFlow>` container using a `<Panel>` wrapper with a hardcoded
`z-index: 5`. The `<CanvasControls>` bar is rendered **outside** `<ReactFlow>` in
the same wrapper `<div>`, using `absolute bottom-6 left-6` with no `z-index` set.

Two things combined to cause the overlap:
1. In `@xyflow/react 12.x`, the default MiniMap position is `bottom-right`, but
   without an explicit value the library reserves the right to change this default
   across minor versions. In the version deployed here, the MiniMap ended up
   rendering at or near the bottom-left corner.
2. The React Flow panel layer has its own stacking context. Without an explicit
   `z-index` on `<CanvasControls>`, the MiniMap panel sat on top of the controls
   because React Flow's internal CSS declares `z-index: 5` on its panel elements —
   higher than the default `z-index: auto` on the controls wrapper.

The result: the MiniMap partially covered the leftmost button (Zoom Out / `−`),
making it invisible and unreachable.

### Problem 2: Fit view button not recognizable

The fit view button used the `Maximize2` icon from lucide-react:

```tsx
<ControlButton onClick={() => fitView({ duration: 200 })} title="Fit view">
  <Maximize2 size={14} />
</ControlButton>
```

`Maximize2` renders as two diagonal arrows pointing outward from opposite corners
(↗↙). This is the same visual used for "fullscreen" or "expand" actions in most
interfaces. Users correctly skipped it when looking for "fit view," because nothing
about the icon suggests "frame the content" or "show all nodes." The button was
present but effectively invisible due to the icon mismatch.

| File | What was wrong |
|---|---|
| `components/editor/canvas-controls.tsx` | `Maximize2` icon ambiguous; no `z-index` on wrapper |
| `components/editor/canvas-flow.tsx` | `<MiniMap>` had no explicit `position` prop |

---

## The Fix

### Fix 1 — Pin MiniMap to `bottom-right` explicitly

```tsx
// Before
<MiniMap />

// After
<MiniMap position="bottom-right" />
```

This removes any dependency on the library default and guarantees the MiniMap
always renders in the bottom-right corner, regardless of future React Flow version
changes.

### Fix 2 — Add `z-10` to the controls wrapper

```tsx
// Before
<div className="absolute bottom-6 left-6 flex items-center ...">

// After
<div className="absolute bottom-6 left-6 z-10 flex items-center ...">
```

`z-10` (CSS `z-index: 10`) places the controls bar above React Flow's internal
panel layer (`z-index: 5`). This ensures the bar is never hidden by any React Flow
panel component regardless of position.

### Fix 3 — Replace `Maximize2` with `Scan`

```tsx
// Before
import { Minus, Plus, Maximize2, Undo2, Redo2 } from 'lucide-react'
<Maximize2 size={14} />

// After
import { Minus, Plus, Scan, Undo2, Redo2 } from 'lucide-react'
<Scan size={14} />
```

`Scan` renders as a square with four L-shaped brackets at its corners — the
universal "frame/capture/fit" metaphor used by cameras, QR code scanners, and
design tools when indicating "constrain this view to the content." It reads
immediately as "fit/frame what's on the canvas."

---

## Why These Design Decisions?

### Why `position="bottom-right"` rather than adjusting the offset?

Moving the controls bar further right to avoid the MiniMap would fix this specific
viewport size but break on other widths. Explicitly declaring the MiniMap's intended
position is the correct solution: it communicates intent, is independent of the
controls bar layout, and survives any future MiniMap default changes in the library.

### Why `z-10` on the controls, not `z-5` to match React Flow panels?

`z-index` values only compare meaningfully within the same stacking context.
`z-10` (Tailwind's step above the default) is the minimum needed to beat React Flow's
`z-index: 5`. Using `z-10` rather than `z-6` keeps the value in Tailwind's standard
scale, which other components in the project can reason about consistently. Going
higher than `z-10` would be unnecessary and could mask future z-index bugs.

### Why `Scan` and not `Crosshair`, `LocateFixed`, or `Expand`?

| Icon | What it communicates | Why not chosen |
|---|---|---|
| `Maximize2` | Fullscreen / expand | Confused with browser fullscreen |
| `Expand` | Make larger | Suggests zoom-in, not fit |
| `Crosshair` | Target / locate a point | Suggests navigating to a point, not framing all content |
| `LocateFixed` | GPS / find current location | Too navigation-specific |
| `Scan` | Frame / capture / fit | Matches design-tool convention for "show all" |

The four L-brackets of `Scan` are the closest icon to the "fit-to-frame" metaphor
in the lucide-react library. Major design tools (Figma: `⇧1`, Miro, FigJam) all use
a similar scanning-frame glyph or the keyboard shortcut labelled "Fit to Screen."

---

## Beginner Mental Model: z-index and Stacking Contexts

CSS `z-index` controls which element appears in front when two elements overlap.
The rule sounds simple — higher number = in front — but it only works within the
same **stacking context**.

A stacking context is created whenever an element has a `position` other than
`static` and a `z-index` other than `auto`, or uses `transform`, `opacity < 1`,
`filter`, etc. Elements in *different* stacking contexts compare their contexts'
z-indexes, not their own.

In this case:
- React Flow creates its own stacking context (the `<ReactFlow>` container is
  positioned with transform-based viewport management).
- The MiniMap panel inside React Flow has `z-index: 5` within React Flow's stacking
  context.
- `<CanvasControls>` sits outside React Flow in the parent wrapper, with no
  explicit z-index.

Without `z-10` on CanvasControls, the browser renders React Flow (and everything
inside it, including the MiniMap) on top of anything outside it with a lower stacking
priority. Adding `z-10` pushes CanvasControls above React Flow's stacking context.

---

## Beginner Mental Model: Icons as Communication

An icon's job is to be understood without a label. When you pick an icon, ask:
*"What is the first thing a user thinks when they see this, with no context?"*

- `Maximize2` → "make this fullscreen" (browser/OS mental model)
- `Scan` → "frame / capture / show everything" (camera/design mental model)

The user already has a mental model of what each symbol means from other apps.
Matching that existing model is more important than picking the most "technically
accurate" icon for what the function does. `Scan` wins because users have already
seen it used for "fit/frame" in design tools.

---

## Suggested Questions for AI Deep-Dive

### CSS & Stacking

- "What is a CSS stacking context? What properties create a new stacking context, and how do parent and child z-indexes interact?"
- "If a parent has `z-index: 1` and its child has `z-index: 9999`, can an element with `z-index: 2` outside the parent appear in front of the child? Why?"
- "What is the difference between `z-index: auto` and `z-index: 0`? Why does `auto` not create a stacking context but `0` does?"
- "React Flow sets a `z-index` on its panel elements. How would you find this in the library's CSS without reading its source code? What browser dev tools technique would you use?"

### React Flow Architecture

- "What is a React Flow `<Panel>`? How does React Flow use it to position built-in components like MiniMap and Controls? What props does Panel accept?"
- "Why does React Flow render MiniMap and Controls inside the ReactFlow container rather than as siblings? What would break if you moved the MiniMap outside the `<ReactFlow>` wrapper?"
- "In `@xyflow/react`, what is the difference between a prop with a library default value versus a prop with an `undefined` default? Why is it risky to depend on library defaults across minor version upgrades?"
- "What does `position='bottom-right'` actually do inside React Flow's panel system? What CSS does it generate, and how does it know the dimensions of the container?"

### UI Design Principles

- "What is the difference between an icon's literal meaning and its conventional meaning? Give three examples where the conventional meaning has diverged from what the icon literally depicts (e.g. the floppy disk for save)."
- "Why do design tools like Figma and Miro use keyboard shortcuts like `⇧1` or `Cmd+Shift+H` for 'fit to screen'? What does this tell you about how frequently that action is used?"
- "What is icon affordance? How does a user form an expectation of what an icon does before clicking it? How would you test whether an icon communicates the right action to users?"
- "When should you use an icon alone versus an icon with a text label? What threshold of icon familiarity justifies removing the label?"

### Versioning & Defensive Code

- "What does 'depending on a library default' mean, and why is it fragile across upgrades? Give an example of a library default that changed in a major version and caused bugs."
- "What is semantic versioning (semver)? What do major, minor, and patch version numbers mean? Under semver, can a default value change in a minor release?"
- "When should you add `z-index` to a component proactively versus waiting until there's an overlap bug? What are the trade-offs of setting explicit z-indexes everywhere?"
