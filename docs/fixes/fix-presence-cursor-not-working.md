# Fix: Live Cursors Not Appearing in Shared Canvas

## What the Screenshots Revealed

Two users opened the same canvas in separate browsers. The screenshots showed:

- **Presence avatars worked**: User 2's view showed TWO circles in the canvas top-right — user 1's avatar appeared via Liveblocks `useOthers()`. The room connection, authentication, and presence subscription were all functioning.
- **Live cursors did not work**: Neither user's screen showed any colored pointer or name badge, even while actively moving the mouse.

This meant the bugs were isolated to the cursor tracking pipeline — not in the Liveblocks connection itself.

---

## Root Cause 1: Mouse events not reaching the handler

The `onMouseMove` handler was attached only to the outer wrapper `<div>` in `CanvasFlowInner`:

```tsx
<div
  className="w-full h-full relative"
  onMouseMove={onMouseMove}   ← only here
  onMouseLeave={onMouseLeave}
>
  <ReactFlow ...>            ← React Flow absorbs events here
```

When the user moves their mouse over the React Flow canvas, the `mousemove` event fires on React Flow's internal elements. React Flow processes it through its own event system (for pan tracking, hover states, connection line updates). By the time the event bubbles up toward the outer `<div>`, React Flow may have already handled it in a way that prevents reliable propagation in certain browsers or interaction modes.

This is the same reason `onDragOver` and `onDrop` are written on **both** the outer div and `<ReactFlow>`. The code comment already said: "belt-and-suspenders reliability." `onMouseMove` simply wasn't given the same treatment.

**Fix**: Add `onMouseMove` and `onMouseLeave` directly to `<ReactFlow>`. Since the handler now fires on both `<ReactFlow>` AND the outer div (events bubble from child to parent), `e.stopPropagation()` inside the handler prevents the update from being sent to Liveblocks twice.

```tsx
// canvas-flow.tsx — handler
const onMouseMove = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation()  // ← prevents double-fire as event bubbles to outer div
    updateMyPresence({ cursor: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
  },
  [updateMyPresence, screenToFlowPosition],
)

// canvas-flow.tsx — JSX
<ReactFlow
  ...
  onMouseMove={onMouseMove}   ← added
  onMouseLeave={onMouseLeave} ← added
  onDragOver={onDragOver}
  onDrop={onDrop}
>
```

---

## Root Cause 2: Fragile coordinate calculation in `LiveCursors`

The original `LiveCursors` component calculated cursor positions like this:

```tsx
const overlayRef = useRef<HTMLDivElement>(null)
// ...
const screenPos = flowToScreenPosition(other.presence.cursor)
const rect = overlayRef.current?.getBoundingClientRect()
if (!rect) return null   // ← silently returns nothing on first render
const x = screenPos.x - rect.left
const y = screenPos.y - rect.top
```

**Two problems with this**:

1. **`overlayRef.current` is `null` on the first render.** React sets refs on elements only AFTER committing them to the DOM (the "commit phase"). During the render phase — which is when the `others.map(...)` body runs — the ref from the CURRENT render hasn't been set yet. On the very first render, `overlayRef.current` is `null`, so every cursor silently returns `null`. On subsequent renders (triggered by `useOthers()` updates), the ref IS set from the previous render. But if the very first presence update arrives while the component is still in its first render, the cursor is dropped.

2. **Calling `getBoundingClientRect()` inside render is a DOM side-effect.** React's render phase is supposed to be a pure calculation. DOM APIs in the render body can cause unexpected behavior in React 18's concurrent rendering mode, where renders may be interrupted, resumed, or discarded without committing to the DOM.

**Fix**: Replace the entire approach with `useViewport()` from `@xyflow/react`.

`useViewport()` returns `{x, y, zoom}` — the current pan translation and zoom scale of the React Flow viewport. These are the same numbers that React Flow uses internally to convert between flow-space and renderer-space coordinates:

```ts
const { x: translateX, y: translateY, zoom } = useViewport()
const localX = cursor.x * zoom + translateX
const localY = cursor.y * zoom + translateY
```

The result (`localX`, `localY`) is the cursor's position in the React Flow **renderer space** — coordinates measured in pixels from the top-left of the React Flow container element. Since the `LiveCursors` overlay div fills that exact same container (`absolute inset-0`), these coordinates are directly usable as `left` and `top` CSS values.

No `useRef`. No DOM API in render. No null check. No race condition. The component re-renders automatically whenever the user pans or zooms, keeping cursors visually correct.

---

## Root Cause 3: Cursor name badge rendered below the cursor

The SVG cursor icon and the name badge `<div>` were in default block flow. In HTML, `<div>` elements always start on a new line, so the badge appeared **below** the cursor tip rather than to its right:

```
🖱️
    [Alice]   ← below, shifted right
```

**Fix**: `flex items-start gap-1` on the wrapper div makes the SVG and badge sit side-by-side:

```
🖱️ [Alice]   ← to the right, aligned to the top
```

---

## The React Flow Coordinate System (Beginner Explanation)

React Flow has three coordinate systems. Understanding which one is in use at any moment is the key to correct cursor tracking.

**1. Screen space (viewport coordinates)**  
Raw pixel positions from the top-left corner of the browser window. `e.clientX` and `e.clientY` from a mouse event are in screen space. `window.innerWidth` / `window.innerHeight` are also in screen space.

**2. Flow space (canvas coordinates)**  
The infinite canvas coordinate system. Node positions in React Flow (`node.position.x`, `node.position.y`) are in flow space. A node at flow position `{x: 400, y: 200}` is always at that logical position regardless of how much the user has panned or zoomed.

**3. Renderer space (canvas-local pixels)**  
Pixels measured from the top-left corner of the React Flow container element (the div that holds the canvas). This is an intermediate space used internally by React Flow when rendering nodes and edges.

**Converting between spaces:**

```
Screen → Flow (storing cursor on mouse move):
  flowX = (clientX - containerLeft - translateX) / zoom
  flowY = (clientY - containerTop  - translateY) / zoom
  (This is what screenToFlowPosition() does)

Flow → Renderer (displaying cursor):
  rendererX = flowX * zoom + translateX
  rendererY = flowY * zoom + translateY
  (This is what useViewport() lets us compute directly)
```

`translateX`, `translateY` are the pan offset (how far the user has dragged the canvas), and `zoom` is the zoom scale (1.0 = 100%).

The key insight: **renderer space = overlay-local pixels** because the `LiveCursors` overlay fills the exact same container as the React Flow canvas. We never need to convert from renderer space to screen space (which would require the container's bounding rect). We can stop at renderer space.

---

## What `e.stopPropagation()` Does

In the DOM, events bubble upward through the element tree. When a `mousemove` fires on the React Flow canvas:

```
React Flow internal element  ← event fires here first
  ↓ (bubbles up)
<ReactFlow> component        ← our onMouseMove handler fires HERE
  ↓ (would bubble)
outer wrapper <div>          ← our onMouseMove handler would ALSO fire here
  ↓ (continues bubbling)
...document root
```

Without `stopPropagation()`, our handler fires **twice** per mouse movement: once on `<ReactFlow>` and once on the outer div. `updateMyPresence` would be called twice, sending two identical presence updates to Liveblocks for every mouse movement.

`e.stopPropagation()` inside the handler stops the event from bubbling past the element where the handler ran. The outer div's handler never fires.

The result: the handler fires exactly once, on whichever element the event reaches first — `<ReactFlow>`, since it's closer to where the mouse event originated.

---

## Why `useViewport()` Re-Renders Are Correct

`useViewport()` subscribes to React Flow's internal store. When the user pans or zooms, the store updates, `useViewport()` returns new values, and `LiveCursors` re-renders with the new `{translateX, translateY, zoom}`. The cursors move to their new screen positions automatically, without any separate logic.

Without this: if you pan the canvas, other users' cursors would appear to "drift" from where they should be — because the stored flow coordinates would be correct, but the rendering wouldn't account for the new viewport transform.

---

## Files Changed

| File | Change |
|---|---|
| `components/editor/canvas-flow.tsx` | Add `onMouseMove` + `onMouseLeave` to `<ReactFlow>`; add `e.stopPropagation()` to handler |
| `components/editor/live-cursors.tsx` | Replace `useRef`/`getBoundingClientRect`/`flowToScreenPosition` with `useViewport()` math; fix flex layout |

---

## Reusable Lessons

**1. Duplicate event handlers on parent and child for reliability.**  
When the parent div and a child component both need to respond to the same event, register the handler on the child (where the event originates) and use `stopPropagation()` to prevent double-firing. Don't assume bubbling is reliable through complex component trees.

**2. Avoid DOM side-effects inside the render body.**  
`getBoundingClientRect()`, `offsetWidth`, `scrollTop`, and other layout APIs belong in effects (`useEffect`, `useLayoutEffect`) or event handlers — not in the render return. They're unreliable during the render phase and can cause issues with React 18's concurrent rendering.

**3. Prefer reactive store hooks over DOM measurements.**  
When a value you need (like the canvas viewport transform) is available as a reactive hook (`useViewport()`), use it. It's simpler, doesn't require refs, and automatically stays in sync with state changes.

**4. Test collaborative features by verifying each layer independently.**  
"It doesn't work" can mean any layer failed: room connection, auth token, presence broadcast, presence reception, or rendering. The screenshots helped isolate the bug to rendering (avatars worked but cursors didn't), which narrowed the search to the cursor-specific code paths.

---

## Topics to Discuss with an LLM / AI to Learn More

1. **"Explain React's synthetic event system and how event bubbling works across parent/child components. When does stopPropagation stop the event?"**  
   Understand the full event lifecycle and why `e.stopPropagation()` on a React component stops bubbling within React's tree.

2. **"What is the difference between React's render phase and commit phase? Why is it bad to call DOM APIs (like getBoundingClientRect) during render?"**  
   Helps understand why the original `getBoundingClientRect()` approach was fragile, and where DOM-touching code actually belongs.

3. **"Explain React 18's concurrent mode and how it changes when renders are committed. Can a render be discarded without committing?"**  
   Concurrent rendering can interrupt and replay renders — refs and DOM state from an uncommitted render are not reliable.

4. **"What are the three coordinate spaces in React Flow (flow-space, renderer-space, screen-space)? Walk me through converting a mouse click position to a node position."**  
   A deep-dive into the coordinate math that makes features like cursor tracking, node placement on drop, and minimap clicks work correctly.

5. **"What does useViewport() return in React Flow 12? What do the x, y, and zoom values represent?"**  
   Understand what the hook exposes, when it re-renders, and how to use it to project coordinates onto the canvas.

6. **"How does Liveblocks presence differ from Liveblocks storage? Why is cursor position better suited to presence than storage?"**  
   The key distinction between ephemeral per-session state (presence) and persistent shared state (storage).

7. **"What is the useOthers() hook in Liveblocks? Does it include the current user? How does it trigger re-renders?"**  
   Understand what `useOthers()` returns, its performance characteristics, and the selector pattern for optimizing re-renders.

8. **"Explain the React useRef hook. When is ref.current populated? Why is it null during the first render?"**  
   The ref lifecycle — understanding why `overlayRef.current` was null on first render and what that meant for cursor rendering.

9. **"What is a React stacking context? How do z-index values interact between parent and child elements with position: absolute?"**  
   Helps understand why `z-40` on the cursor overlay renders above canvas nodes but below the workspace toolbar at `z-20` (which is in a different stacking context).

10. **"In real-time collaborative tools like Figma, how are live cursors implemented? What are the tradeoffs between storing cursor positions in flow-space vs screen-space?"**  
    Architectural discussion — why flow-space storage (what we do) means each client independently transforms to their screen, making it robust to different zoom/pan states.
