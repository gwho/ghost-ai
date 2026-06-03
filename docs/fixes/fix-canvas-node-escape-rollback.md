# Fix: Escape Key Rolls Back Node Label Edits

## What Was Wrong

In `components/editor/canvas-node.tsx`, double-clicking a node opens an inline
textarea for editing the node's label. The component used an **optimistic
per-keystroke update** pattern: every character the user types immediately writes
to the React Flow store via `updateNodeData`. The idea is that collaborators see
changes as you type rather than only after you confirm.

The problem was in the Escape key handler:

```tsx
// BEFORE — Escape only hid the textarea, it did NOT undo the typing
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  e.stopPropagation()
  if (e.key === 'Escape') setEditing(false)   // ← label stays at whatever was typed
}, [])
```

Walk-through of the bug:
1. Node label is `"API Gateway"`.
2. User double-clicks → `startEditing` fires → `draft` set to `"API Gateway"`.
3. User types `"API Gat333"` → each keystroke calls
   `updateNodeData(id, { label: "API Gat3..." })` — the store is updated live.
4. User realises this was a mistake and presses Escape.
5. The textarea disappears but the node still shows `"API Gat333"` — the
   rollback never happened.

## Why It Happens: "Optimistic Updates" Explained

An **optimistic update** means writing a change to your local state immediately,
before any confirmation, so the UI feels instant. Here, `handleChange` fires on
every keystroke and calls `updateNodeData` directly — there is no "pending" or
"staged" buffer. The React Flow store is treated as the live source of truth.

This is a great pattern for confirming edits (Enter / blur), but it creates a
rollback problem: if the user cancels, you need to remember what the value was
*before* editing started and put it back.

## The Fix

Three minimal changes:

### 1. Store the pre-edit value in a ref

```tsx
const originalLabelRef = useRef<string>('')
```

A `useRef` is the right tool here because:
- The original label only needs to be read once (on Escape) — we don't need
  a re-render when it changes.
- Refs are stable objects; their `.current` value can be updated inside a
  `useCallback` without needing to be listed in the dependency array.

### 2. Capture the value when editing begins

```tsx
const startEditing = useCallback((e: React.MouseEvent) => {
  e.stopPropagation()
  originalLabelRef.current = label ?? ''   // ← snapshot the pre-edit label
  setDraft(label ?? '')
  setEditing(true)
}, [label])
```

`startEditing` already had access to `label` in its closure, so the snapshot
costs nothing extra.

### 3. Roll back on Escape

```tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  e.stopPropagation()
  if (e.key === 'Escape') {
    setDraft(originalLabelRef.current)                          // restore textarea
    updateNodeData(id, { label: originalLabelRef.current })    // restore store
    setEditing(false)                                           // hide textarea
  }
}, [id, updateNodeData])
```

`setDraft` resets the visual input value (in case the component re-renders
before `setEditing(false)` takes effect). `updateNodeData` is the critical line:
it writes the original value back to the React Flow store, undoing all the
per-keystroke writes that `handleChange` made.

`id` and `updateNodeData` were added to the dependency array because `handleKeyDown`
now uses them (previously the callback captured nothing closured, so `[]` was
correct; now it must list its dependencies).

### 4. `commitEdit` is left unchanged

```tsx
const commitEdit = useCallback(() => {
  setEditing(false)
}, [])
```

`commitEdit` is called on `onBlur` (clicking away) and the idea is that the
live-typed value in the store is already correct — we just close the editor.
No data write needed here.

## Full Before / After

```diff
+ const originalLabelRef = useRef<string>('')

  const startEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
+   originalLabelRef.current = label ?? ''
    setDraft(label ?? '')
    setEditing(true)
  }, [label])

- const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
-   e.stopPropagation()
-   if (e.key === 'Escape') setEditing(false)
- }, [])

+ const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
+   e.stopPropagation()
+   if (e.key === 'Escape') {
+     setDraft(originalLabelRef.current)
+     updateNodeData(id, { label: originalLabelRef.current })
+     setEditing(false)
+   }
+ }, [id, updateNodeData])
```

## Mental Model: Three-State Edit Lifecycle

```
DISPLAY MODE
  label = "API Gateway"   (React Flow store)
  draft = ""              (irrelevant)
  originalLabelRef = ""   (irrelevant)

↓  user double-clicks (startEditing)

EDITING MODE
  label = "API Gateway"   (store — unchanged so far)
  draft = "API Gateway"   (textarea value)
  originalLabelRef = "API Gateway"   ← snapshot taken here

↓  user types "API Gat333" (handleChange, fires per keystroke)

EDITING MODE (mid-type)
  label = "API Gat333"    (store — optimistically updated)
  draft = "API Gat333"    (textarea value)
  originalLabelRef = "API Gateway"   ← still the original

↓  user presses Escape (handleKeyDown)

DISPLAY MODE (after rollback)
  label = "API Gateway"   (store — restored by updateNodeData)
  draft = "API Gateway"   (restored by setDraft)
  originalLabelRef = "API Gateway"   (unchanged)
```

---

## Suggested Topics to Explore Further with an LLM

1. **`useRef` vs `useState` for mutable values** — Both can store values that
   survive re-renders, but one causes a re-render when changed and the other
   does not. Ask an LLM to explain when each is the right choice and give
   examples of bugs caused by using the wrong one.

2. **Optimistic updates — pattern and rollback strategies** — Optimistic updates
   are common in collaborative apps. How do libraries like React Query, SWR, and
   Zustand handle rollback when an operation fails? How does this compare to the
   "ref snapshot" approach used here?

3. **`useCallback` dependency arrays** — Why did adding `id` and `updateNodeData`
   to the dependency array matter? What happens if you leave a value out of the
   array (stale closure bug)? What is the ESLint rule `react-hooks/exhaustive-deps`
   and how does it help catch these bugs automatically?

4. **Event propagation: `stopPropagation` in canvas apps** — Every keydown
   handler in this file calls `e.stopPropagation()`. Why is this important in
   React Flow? What happens without it? Ask about the difference between
   `stopPropagation`, `preventDefault`, and `stopImmediatePropagation`.

5. **React Flow's `updateNodeData` — where does the data live?** — React Flow
   manages a graph state internally. Ask an LLM to explain how `updateNodeData`
   mutates that internal state, how it triggers re-renders for nodes, and how
   this relates to React Flow's `useNodesState` / `onNodesChange` pattern.

6. **The "controlled input" pattern in React** — The `<textarea>` uses
   `value={draft}` + `onChange={handleChange}`. This is a controlled component.
   Ask about what makes a component controlled vs uncontrolled, why the draft
   state and the store both need to be updated on Escape, and what would happen
   if only one was restored.

7. **Collaborative real-time editing — CRDT and operational transforms** — This
   component uses simple optimistic writes. Production collaborative editors
   (like Google Docs or Liveblocks Text) use more sophisticated algorithms. Ask
   an LLM to explain what CRDTs are and why naive per-keystroke store writes
   can cause conflicts between multiple simultaneous editors.
