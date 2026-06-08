# Plan: Feature 23 — Design Agent Logic

## Goal

Wire up the full AI design loop: user submits a prompt in the AI sidebar → Gemini interprets it → canvas is mutated via Liveblocks → real-time status events are broadcast to all participants → submitting user's presence shows "thinking" state.

## Model

`gemini-2.5-flash-lite` — cheapest current Gemini model ($0.10/$0.40 per 1M input/output tokens).

## Key Architectural Constraint

The `AISidebar` is rendered in `workspace-shell.tsx` as a sibling to `CanvasWrapper`, meaning it is **outside** the Liveblocks `RoomProvider`. It cannot use Liveblocks hooks directly. The solution is a callback chain:

```
design-agent (server) → broadcastEvent → Liveblocks room
  ↓
CanvasFlowInner (useEventListener) → onAiStatus callback
  ↓
workspace-shell (appends to aiMessages state)
  ↓
AISidebar (renders as status chips in the chat feed)
```

## Files Changed

| File | What changed |
|---|---|
| `liveblocks.config.ts` | Added `RoomEvent` union type for `ai-status` events |
| `trigger/design-agent.ts` | Full Gemini + mutateFlow + broadcastEvent implementation |
| `components/editor/canvas-flow.tsx` | Added `isAiThinking`, `onAiStatus`, `onAiComplete` props; `useEffect` for presence sync; `useEventListener` for room events |
| `components/editor/canvas-wrapper.tsx` | Forwarded the three new AI props to `CanvasFlow` |
| `components/editor/workspace-shell.tsx` | Added `isAiThinking` + `aiMessages` state, `handleAiSubmit/Status/Complete` callbacks, wired to `CanvasWrapper` and `AISidebar` |
| `components/editor/ai-sidebar.tsx` | Wired `onSubmit` prop, `statusMessages` injection via `useEffect`, status chip rendering |

## Design Agent Execution Flow

1. Broadcast `start` → "Gemini is reading your prompt…"
2. Call `generateObject` with `gemini-2.5-flash-lite` and zod schema
3. Broadcast `processing` → "Updating canvas…"
4. `mutateFlow`: clear existing nodes/edges, add generated ones
5. Broadcast `complete` → "Design complete — N nodes added."
6. On error: broadcast `error` → "Something went wrong — canvas unchanged."

## Design Constraints Enforced

- Shapes: `rectangle | diamond | circle | pill | cylinder | hexagon`
- Colors: the 8 `NODE_COLORS` fill values (dark theme palette)
- Layout: left-to-right, starting x=100 y=100, min 180px/150px spacing
- Node count: 4–12
- Labels: max 30 chars, kebab-case IDs
