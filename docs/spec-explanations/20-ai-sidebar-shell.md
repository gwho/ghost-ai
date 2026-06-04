# Spec Explanation: Feature 20 — AI Sidebar Shell

## What This Feature Does

Feature 20 turns the placeholder AI panel on the right side of the workspace into a real, structured sidebar. Users see it when they click the "AI" button in the workspace toolbar.

The sidebar has:
- A header with the "AI Workspace" title and a close button
- Two tabs: **AI Architect** (a chat interface) and **Specs** (a spec generator)
- In the AI Architect tab: an empty state with starter prompt chips, a message history area, and a text input
- In the Specs tab: a "Generate Spec" button and a static demo card

No AI backend is connected yet — this feature is the UI shell. The structure is ready for generation logic in a future feature.

---

## Why Separate the Sidebar into Its Own Component?

The old code rendered a placeholder (`AICopilotSidebar`) directly inside `workspace-shell.tsx`. The new code creates a standalone `AISidebar` component in its own file.

**Why this is better:**
- The sidebar is now self-contained: its own state (messages, input), its own layout, its own tabs.
- `workspace-shell.tsx` only needs to know one thing: is the sidebar open? It passes `onClose` as a prop so the close button inside the sidebar can tell the parent to close it.
- As the sidebar grows (AI calls, real-time presence, spec generation), none of that complexity leaks into `workspace-shell.tsx`.

**Rule of thumb:** A component that manages its own state and is visually distinct belongs in its own file. The workspace shell's job is layout — not chat logic.

---

## How the Slide Animation Works

Previously the sidebar was conditionally rendered:
```tsx
{isAISidebarOpen && <AICopilotSidebar />}
```

This means every time the user clicks "AI", React destroys and recreates the component. Any in-progress chat messages would disappear.

The new approach keeps the sidebar **always mounted** and slides it in/out using a CSS transform:

```tsx
<div
  className={cn(
    "absolute right-0 top-12 bottom-0 z-10 w-80 transition-transform duration-300 ease-in-out",
    isAISidebarOpen ? "translate-x-0" : "translate-x-full",
  )}
>
  <AISidebar onClose={() => setIsAISidebarOpen(false)} />
</div>
```

- `translate-x-0` — sidebar is visible at its normal position
- `translate-x-full` — sidebar is pushed 100% of its own width to the right (off-screen)
- `transition-transform duration-300 ease-in-out` — smooth 300ms animation

The component stays mounted, so chat history survives open/close cycles.

---

## How the Tabs Work

We use the `Tabs` component from shadcn/ui, which is built on `@radix-ui/react-tabs`. Radix handles keyboard navigation and accessibility automatically.

```tsx
<Tabs defaultValue="architect">
  <TabsList>
    <TabsTrigger value="architect">AI Architect</TabsTrigger>
    <TabsTrigger value="specs">Specs</TabsTrigger>
  </TabsList>
  <TabsContent value="architect">...</TabsContent>
  <TabsContent value="specs">...</TabsContent>
</Tabs>
```

The `defaultValue="architect"` sets the initial active tab. Radix handles showing/hiding content panels automatically — you only describe what each tab renders.

The active tab gets custom classes to show the AI accent color:
```
data-[state=active]:bg-ai-accent/20 data-[state=active]:text-ai-text
```
`data-[state=active]` is a Tailwind variant that applies styles only when the Radix data attribute equals "active". This avoids any JavaScript state for tab styling — CSS handles it.

---

## Why the AI Accent Colors?

Ghost AI uses two accent palettes:
- **Brand/cyan** (`--accent-primary`, `#00c8d4`) — used for interactive canvas controls, primary actions
- **AI/indigo** (`--accent-ai`, `#6457f9`) — used for AI-specific UI elements

Since this is the AI Workspace panel, indigo is the right choice. A soft background (`bg-ai-accent/20` = 20% opacity indigo) marks the active tab without overwhelming the dark theme. The text color (`text-ai-text`, `#8b82ff`) is the lighter tinted purple that reads clearly on that background.

The send button and generate spec button use `bg-ai-accent text-white` — solid indigo with white text — making them the most prominent calls to action in the sidebar.

---

## How the Auto-Resizing Textarea Works

Standard `<textarea>` elements have a fixed height. To make them grow as the user types:

```ts
const autoResize = useCallback(() => {
  const el = textareaRef.current
  if (!el) return
  el.style.height = 'auto'                                     // Step 1: collapse
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'     // Step 2: grow
}, [])
```

**Step 1** resets the height to `auto` so the browser recalculates the natural scrollHeight.  
**Step 2** sets the height to `scrollHeight` (the content's natural height), but caps it at 160px. Beyond that, the textarea becomes scrollable internally.

The Tailwind class `min-h-[72px]` sets the starting height. `resize-none` removes the browser's built-in resize handle since we're handling it manually.

On submit, height is manually reset to `auto` so it returns to the minimum.

---

## How Messages Are Submitted

```ts
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()   // prevent newline on bare Enter
    submit()
  }
  // Shift+Enter falls through — browser inserts newline naturally
}
```

`e.preventDefault()` stops the default browser behavior (inserting a newline) when bare Enter is pressed. When Shift is held, the condition is false and the browser handles it normally.

---

## The Message Bubble Pattern

User messages are **right-aligned** (what the user typed):
```
flex justify-end
  └── bg-brand-dim border-2 border-brand/50 text-copy-primary rounded-2xl
```
The cyan-dim background with a 50%-opacity cyan border subtly marks it as "my message" without being loud.

Assistant messages are **left-aligned** (what the AI responds):
```
flex justify-start
  └── bg-elevated border border-surface-border text-ai-text rounded-2xl
```
A neutral elevated surface with the AI text color (soft indigo-purple) distinguishes it from user messages.

Both are capped at `max-w-[85%]` so they never span the full sidebar width.

---

## The Empty State + Starter Chip Pattern

When `messages.length === 0`, the chat area shows:
1. A large bot icon (visual anchor)
2. A short description of what the AI does
3. Three starter prompt chips

The chips are not just decorative — clicking one calls `handleChip(chip)`, which sets the textarea value and focuses the input. The user can then press Enter to submit immediately, or edit the prompt first.

This pattern lowers the "blank page" friction: instead of staring at an empty input, the user sees concrete examples of what to ask.

---

## What the Specs Tab Is Setting Up

The Specs tab is a placeholder for the spec generation feature (planned for a future milestone). Right now it shows:
- A "Generate Spec" button (not wired to any logic yet)
- A demo card styled exactly how real spec cards will look

Building the card and button now means that when the generation feature is built, the UI only needs to swap mock data for real data — the layout and styling decisions are already made.

---

## Token Quick Reference

| Class | CSS Variable | Value |
|---|---|---|
| `bg-base/95` | `--bg-base` at 95% opacity | `#080809` (near-black) |
| `bg-surface` | `--bg-surface` | `#111114` |
| `bg-elevated` | `--bg-elevated` | `#18181c` |
| `bg-subtle` | `--bg-subtle` | `#1e1e23` |
| `text-copy-primary` | `--text-primary` | `#f0f0f4` |
| `text-copy-muted` | `--text-muted` | `#808090` |
| `bg-ai-accent` | `--accent-ai` | `#6457f9` (indigo) |
| `text-ai-text` | `--accent-ai-text` | `#8b82ff` (soft indigo) |
| `bg-brand-dim` | `--accent-primary-dim` | `rgba(0,200,212,0.12)` |
| `border-brand/50` | `--accent-primary` at 50% | cyan border |
| `border-surface-border` | `--border-default` | `#2a2a30` |

---

## AI Discussion Topics

These are questions worth exploring to deepen understanding of the patterns used here.

### Component design
- Why is the open/close state kept in `workspace-shell.tsx` rather than inside `AISidebar` itself? What would break if we moved it inside the sidebar?
- What is the difference between a "controlled" and "uncontrolled" component? Is `AISidebar` controlled or uncontrolled with respect to its open state?

### CSS layout
- What does `flex flex-col min-h-0` on the `Tabs` container do? Why is `min-h-0` needed for flex children to scroll correctly?
- How does `translate-x-full` differ from `display: none` or `visibility: hidden` for hiding the sidebar?
- Why is the sidebar `absolute` positioned rather than part of the normal document flow?

### React patterns
- Why does `useCallback` wrap `submit` and `handleKeyDown`? When does memoizing a callback actually matter?
- What would happen to messages if the sidebar were conditionally rendered (`{isOpen && <AISidebar />}`) instead of always mounted?
- What is a `useRef` used for here? How is it different from `useState`?

### Auto-resize
- Why must `el.style.height = 'auto'` run before reading `el.scrollHeight`? What happens if you skip that step?
- What is `scrollHeight` vs `clientHeight` vs `offsetHeight`? When would each be useful?

### Accessibility
- What does `aria-pressed` communicate to screen reader users? Why does it accept `"true"` / `"false"` strings rather than a boolean?
- Why do the starter chip buttons use `type="button"` rather than just `<button>`?

### Styling
- How does the `data-[state=active]:` Tailwind variant work? What HTML attribute does it read?
- Why use `bg-ai-accent/20` (20% opacity) for the active tab background rather than the solid `bg-ai-accent`?
- Why cap the message bubble at `max-w-[85%]` instead of `max-w-full`?
