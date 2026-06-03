# Feature 13 — Node Shape Rendering + Drag Preview

## What This Feature Does

Before this feature, every node on the canvas looked the same — a plain rounded rectangle — regardless of which shape you dragged onto the canvas. The shape information was being saved to the node, but the renderer ignored it and always drew a box.

This feature fixes that gap in two ways:

1. **Shape rendering** — each node now draws the correct visual shape (rectangle, pill, circle, diamond, hexagon, or cylinder).
2. **Drag ghost preview** — while you're dragging a shape from the toolbar, a semi-transparent copy of that shape follows your cursor, so you can see what you're about to drop before you release the mouse.

---

## How the Six Shapes Are Rendered

Not all shapes are created equal. Some are easy to express with HTML and CSS; others need SVG (Scalable Vector Graphics).

### CSS Shapes (rectangle, pill, circle)

These three are just divs with the right `border-radius`:

- **Rectangle** — moderate `border-radius` (`rounded-xl` in Tailwind). Looks like a slightly rounded box.
- **Pill** — `border-radius` set to `9999px` (`rounded-full`). On a wide div this gives the classic capsule shape.
- **Circle** — also `rounded-full`, but the node's default dimensions are square (80×80), so the result is a perfect circle.

Why CSS and not SVG? Because these shapes map directly onto what CSS `border-radius` already does. SVG would be more work for the same result.

### SVG Shapes (diamond, hexagon, cylinder)

A diamond, hexagon, or cylinder can't be described with `border-radius`. You need to draw the actual outline as a graphic. SVG is the right tool here.

The SVG element is given a `viewBox="0 0 100 100"` — an imaginary 100×100 coordinate space. All the shape geometry is described inside that space. When the browser renders the SVG, it stretches it to fill the actual pixel size of the node (`w-full h-full`). That's the "scales with node size" behaviour the spec requires.

- **Diamond** — a four-pointed polygon: top (50,2), right (98,50), bottom (50,98), left (2,50).
- **Hexagon** — a six-pointed polygon following a regular hexagon inscribed in the 100×100 box.
- **Cylinder** — three parts drawn in layers:
  1. A rectangle forms the body.
  2. An ellipse at the bottom (the far end of the tube).
  3. Two vertical lines as the side edges.
  4. An ellipse at the top — drawn last so it paints over the body's top edge.

The order shapes are drawn in SVG matters — later elements paint over earlier ones, just like stacking pieces of paper.

### Selection Highlighting

When a node is selected (clicked), its border or SVG stroke changes from the subtle dark token (`--border-default`) to the accent cyan (`--accent-primary`). This is driven by the `selected` prop that React Flow automatically passes to every custom node component.

For CSS shapes this is a Tailwind class swap (`border-surface-border` → `border-brand`). For SVG shapes it's an inline `stroke` attribute reading a CSS variable.

---

## How the Drag Ghost Preview Works

### The Problem with the Default Browser Preview

When you drag an HTML element, the browser automatically creates a "drag image" — a faded screenshot of the element you started dragging. This looks fine for file uploads but terrible for a shape toolbar: the button icon is tiny and doesn't represent the shape that will be dropped.

To replace it, we:

1. Create a throwaway invisible `<div>` off-screen.
2. Call `e.dataTransfer.setDragImage(thatDiv, 0, 0)` — this tells the browser to use that invisible div as the drag image instead.
3. Remove the invisible div on the next animation frame (it only needs to exist long enough for the browser to read it).

Now the native drag image is invisible, and we draw our own.

### Tracking the Cursor

While dragging, the browser fires `dragover` events on every element the cursor passes over. Those events carry `clientX` and `clientY` coordinates. We attach a listener to `document` (so it catches all positions, not just over a specific element) and update a React state variable with the latest cursor coordinates.

Why in a `useEffect`? Because the listener only makes sense while a drag is in progress. The effect adds the listener when dragging starts and removes it when dragging stops — preventing memory leaks and stale handlers.

### Rendering the Ghost

With the cursor position in state, we render a fixed-position `<div>` at:

```
left = cursorX - shapeWidth / 2
top  = cursorY - shapeHeight / 2
```

This centres the ghost on the cursor. The div has `pointer-events: none` so it doesn't intercept mouse events meant for the canvas below it. `opacity: 0.65` makes it feel ghostly.

Inside the ghost div, a `ShapeGhost` component renders the same CSS or SVG shape geometry as the real nodes — no handles or labels, just the outline.

### Cleanup

When `onDragEnd` fires (drop or cancel), `dragState` is set to `null`. The ghost div unmounts, and the `useEffect` removes the `dragover` listener — nothing is left running.

---

## Why These Design Decisions?

| Decision | Why |
|---|---|
| CSS for rectangle/pill/circle | Border-radius is exactly what CSS was designed for — no SVG overhead |
| SVG with `preserveAspectRatio="none"` | Lets the shape fill any node size without distorting proportions |
| `viewBox="0 0 100 100"` | Clean relative coordinates — easy to reason about and adjust |
| `setDragImage` with invisible div | Suppresses the browser's auto-preview so we fully control the ghost |
| `document` dragover listener in `useEffect` | Scoped to drag-active period only; no leaked listeners |
| `position: fixed` for ghost | Follows the cursor regardless of canvas scroll or transforms |
| `pointer-events: none` on ghost | Prevents the ghost from stealing mouse/drop events from the canvas |
| Cylinder top ellipse drawn last | SVG paints in document order — the top face must cover the body top edge |

---

## Topics to Explore with an AI

Use these prompts in conversation with an LLM to go deeper on the concepts from this feature.

### Coding & JavaScript

- "Explain how SVG `viewBox` and `preserveAspectRatio` work — what does `none` actually do, and what are the other options?"
- "Why does SVG paint elements in document order? How does that affect how you build layered shapes like a cylinder?"
- "Walk me through the HTML5 Drag and Drop API — what events fire, in what order, and what data does each event carry?"
- "What does `e.dataTransfer.setDragImage` do, and why do you need to add the element to the DOM before calling it?"
- "Why is it important to clean up event listeners in `useEffect`? What happens if you forget the cleanup function?"
- "What's the difference between `requestAnimationFrame` and `setTimeout(fn, 0)` for deferring a DOM cleanup?"

### React & Framework Specifics

- "How does React Flow pass props like `selected`, `data`, and `id` to a custom node component? Where does that happen inside the library?"
- "Why do we use `NodeProps` as the TypeScript component type instead of defining the props by hand?"
- "Explain the `useEffect` dependency array — why does `[isDragging]` cause the effect to re-run only when dragging starts or stops, not on every cursor update?"
- "What is the `useState` updater callback form (`setState(prev => ...)`) and when should you use it over passing a value directly?"
- "What does `pointer-events: none` do in CSS? How is it different from `visibility: hidden` or `opacity: 0`?"

### System Design & Architecture

- "Why separate 'shape type' from 'render logic'? What's the benefit of having `NodeShape` as a TypeScript union type rather than just using `string`?"
- "How would you extend this system to support user-drawn custom SVG paths? What parts of the code would need to change?"
- "The ghost preview uses the same geometry as real nodes. If you later wanted to change a shape's appearance, you'd need to update both places. What patterns could you use to share the geometry — a utility function, a shared component, a render prop?"
- "Why is the canvas coordinate system (React Flow positions) different from screen coordinates (clientX/clientY), and how does `screenToFlowPosition` bridge them?"
- "What trade-offs would you consider when deciding whether to put the `ShapeGhost` component in its own file vs. keeping it inline in `shape-panel.tsx`?"

### Data Structures & TypeScript

- "What is a TypeScript union type? Why is `type NodeShape = 'rectangle' | 'diamond' | ...` safer than using `string`?"
- "What is `as const` on an array and how does it differ from a regular typed array? When would you need it?"
- "How does TypeScript narrow a union type inside an `if` or `switch` block? What is exhaustiveness checking with `never`?"
- "What's the difference between `interface` and `type` in TypeScript? When would you choose one over the other?"

### CSS & SVG Deep Dives

- "What is the SVG coordinate system? How do user units, viewport units, and pixel units relate to each other?"
- "Explain CSS custom properties (`var(--name)`) and why they're preferred over hardcoded hex values in a design system."
- "How does `position: fixed` differ from `position: absolute`? Why does the drag ghost use `fixed` rather than `absolute`?"
- "What does Tailwind's `inset-0` shorthand expand to, and how is `inset` different from setting `top/right/bottom/left` individually?"
- "Why might SVG `strokeWidth` look different on a large node vs a small node when using `preserveAspectRatio='none'`? How would you fix that?"
- "How does the CSS paint order work for SVG — specifically for `fill` and `stroke` — and why does stroke sometimes appear half-inside, half-outside a shape?"
