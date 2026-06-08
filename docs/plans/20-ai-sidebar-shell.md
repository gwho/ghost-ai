# Plan: Feature 20 — AI Sidebar Shell

## Goal

Replace the stub `AICopilotSidebar` with a fully structured floating chat sidebar named `AISidebar`. No backend logic. The goal is to build the complete UI shell so that future features (AI generation, Liveblocks presence, Trigger.dev jobs) can be wired in without changing the sidebar's structure.

---

## What Already Existed

- `components/editor/ai-copilot-sidebar.tsx` — placeholder with disabled input and stub cards.
- `components/editor/workspace-shell.tsx` — parent that toggles `isAISidebarOpen` state and conditionally renders the sidebar at `absolute right-0 top-12 bottom-0 z-10 w-80`.
- shadcn components available: `Button`, `Textarea`, `Tabs/TabsList/TabsTrigger/TabsContent`, `Dialog`, `Input`, `ScrollArea`.
- Color tokens defined in `globals.css` and mapped to Tailwind utilities via `@theme inline`.

---

## Decision: Always-Mounted Slide Animation

The old code conditionally rendered the sidebar (`{isAISidebarOpen && <...>}`). This means React unmounts and remounts the component on every toggle, losing any in-progress chat state.

**New approach:** Keep the sidebar always mounted; slide it in/out using CSS `translate-x`:

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

Benefits: smooth animation, chat state persists across open/close cycles, and the component tree stays stable.

---

## Component Tree

```
AISidebar (aside)
├── Header (flex-none, border-b)
│   ├── Bot icon — rounded-xl bg-ai-accent/20 container
│   ├── "AI Workspace" title (text-copy-primary, text-sm font-semibold)
│   ├── "Collaborate with Ghost AI" subtitle (text-copy-muted, text-[11px])
│   └── Close X button → calls onClose prop
└── Tabs (flex-1 flex-col min-h-0)
    ├── TabsList (2-col grid, bg-surface, mx-4 mt-3)
    │   ├── TabsTrigger "AI Architect"
    │   │   inactive: text-copy-muted
    │   │   active: bg-ai-accent/20 text-ai-text shadow-none
    │   └── TabsTrigger "Specs" (same styling)
    ├── TabsContent "architect" (flex-1 flex-col min-h-0)
    │   ├── Scroll area (flex-1 overflow-y-auto)
    │   │   ├── Empty state (when messages === [])
    │   │   │   ├── Bot icon (h-12 w-12, bg-ai-accent/20)
    │   │   │   ├── "Ghost AI Architect" heading + description
    │   │   │   └── Starter chips (3×) — bg-subtle text-ai-text rounded-xl
    │   │   └── Message list (when messages.length > 0)
    │   │       ├── User message — flex justify-end, bg-brand-dim border-2 border-brand/50 text-copy-primary
    │   │       └── Assistant message — flex justify-start, bg-elevated border-surface-border text-ai-text
    │   └── Input area (flex-none border-t p-3)
    │       └── rounded-2xl bg-elevated container
    │           ├── Textarea: min-h-[72px] max-h-[160px], auto-resize on change, Enter=submit, Shift+Enter=newline
    │           └── Send button (right-aligned): bg-ai-accent text-white, disabled when input empty
    └── TabsContent "specs" (px-4 py-3)
        ├── Generate Spec Button — w-full bg-ai-accent text-white
        └── Demo spec card — rounded-2xl bg-elevated border-surface-border
            ├── FileText icon in bg-surface container
            ├── "Microservices Architecture" title + snippet text
            └── Download button (disabled, opacity-30)
```

---

## State Design

```ts
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput] = useState('')
const textareaRef = useRef<HTMLTextAreaElement>(null)
const scrollRef = useRef<HTMLDivElement>(null)
```

- `messages` starts empty, which triggers the empty state / starter chip view.
- `input` is two-way bound to the Textarea.
- `textareaRef` is used for manual height manipulation during auto-resize.
- `scrollRef` is used to scroll to the bottom after a new message is added.

---

## Auto-Resize Pattern

```ts
const autoResize = useCallback(() => {
  const el = textareaRef.current
  if (!el) return
  el.style.height = 'auto'          // collapse to natural size first
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'  // grow to content, cap at 160px
}, [])
```

Called on every `onChange` event. On submit, height is reset to `auto` (returns to min-h-[72px]).

---

## Token Choices

| Element | Token | Reason |
|---|---|---|
| Sidebar bg | `bg-base/95` | Near-black with slight transparency; sits over the canvas |
| Active tab bg | `bg-ai-accent/20` | Subtle indigo tint — marks AI context without high contrast |
| Active tab text | `text-ai-text` | `#8b82ff` — readable on the dim bg |
| Inactive tab text | `text-copy-muted` | Recedes without disappearing |
| Starter chips bg | `bg-subtle` | One step lighter than base, giving chip shape |
| Starter chips text | `text-ai-text` | Consistent with AI accent theme |
| User message bg | `bg-brand-dim` | Cyan-tinted bubble — brand accent dim |
| User message border | `border-brand/50` | 2px cyan border at 50% opacity |
| Assistant message | `bg-elevated border-surface-border text-ai-text` | Neutral elevated surface, AI-coloured text |
| Send/Generate button | `bg-ai-accent text-white` | High-contrast call-to-action in AI context |

---

## Files Changed

| File | Change |
|---|---|
| `components/editor/ai-sidebar.tsx` | Created — new component |
| `components/editor/workspace-shell.tsx` | Import swapped; always-mounted slide animation; aria-pressed fix |
| `context/progress-tracker.md` | Feature 20 marked complete |

---

## Verification Checklist

- [ ] `npm run build` passes (Google Fonts env error is pre-existing and unrelated)
- [ ] AI sidebar slides in smoothly when clicking the "AI" button in the workspace toolbar
- [ ] Close button (X) in sidebar header dismisses the sidebar (slides out right)
- [ ] "AI Architect" tab is active by default; switching to "Specs" tab works
- [ ] Empty state with bot icon and three chips is visible when no messages
- [ ] Clicking a chip populates the textarea and focuses it
- [ ] Typing and pressing Enter adds a user message bubble and clears the input
- [ ] Shift+Enter inserts a newline without submitting
- [ ] Textarea grows from 72px up to 160px as text is typed; resets on submit
- [ ] Specs tab shows Generate Spec button and demo card; download icon is disabled/dimmed
