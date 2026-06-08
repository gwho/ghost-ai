# AI Discussion Topics — Feature 26: AI Chat Functional

## 1. Why `useRealtimeRun` is called with `runId ?? ''`

React's rules of hooks require that hooks are called on every render in the same order — you can't put a hook inside an `if (runId)` block. Calling `useRealtimeRun('')` when there's no active run is the practical workaround: the hook receives an empty string, doesn't find a matching run, and returns `{ run: undefined }`. Nothing breaks. An alternative is a sub-component that only mounts when `runId` is set — that keeps the hook conditional but adds a layer of indirection. For this feature, the direct approach was chosen because it's simpler and Trigger.dev's hooks handle missing IDs gracefully.

## 2. `onComplete` callback vs watching `run.status` in a `useEffect`

Both approaches can react to a run finishing, but they behave differently:

- **`useEffect` on `run.status`**: fires whenever the status value changes, which could be multiple times (e.g., `QUEUED → EXECUTING → COMPLETED`). You have to guard against firing the "completion" logic more than once, typically with a ref.
- **`onComplete` callback**: provided by `useRealtimeRun`, it fires exactly once when the run first transitions to a terminal state. No guard needed.

The `onComplete` callback is the right tool here because the "push final message + reset state" action should happen exactly once.

## 3. Why the sidebar makes two API calls (design then token)

The spec could have been implemented by modifying `/api/ai/design` to return both `runId` and `publicToken` in one response. The two-call approach was chosen instead because:
- It keeps both existing routes completely unchanged — less surface area for regressions
- It mirrors the existing `/api/ai/design/token` route which was already built for this purpose
- The second call is cheap (just a token generation) and runs immediately after the first

Trade-off: two round-trips instead of one. In practice the latency is negligible on a LAN, but it would add ~50–100ms on a slow connection.

## 4. How `useEventListener` can be used in both `canvas-flow.tsx` and `ai-sidebar.tsx` simultaneously

Liveblocks implements a pub-sub fan-out model. When the design agent broadcasts an `ai-status` event with `broadcastEvent(...)`, Liveblocks delivers it to every client subscribed to the room. On each client, every `useEventListener` hook registered inside the active `RoomProvider` receives the event independently. There's no "first subscriber wins" — both `canvas-flow.tsx` (for presence sync and `onAiComplete`) and `ai-sidebar.tsx` (for status strip text) each get their own copy of the event.

## 5. The two sources that reset `isAiThinking` — why that's safe

`isAiThinking` in `workspace-shell.tsx` can be set to `false` by two independent paths:

1. **`useRealtimeRun.onComplete`** in the sidebar → calls `onThinkingChange(false)` → `setIsAiThinking(false)` in workspace-shell
2. **`canvas-flow.tsx` `useEventListener`** receives `ai-status: 'complete'` broadcast → calls `onAiComplete?.()` → `handleAiComplete()` → `setIsAiThinking(false)`

Both paths may fire for the same AI run. Setting state to `false` when it's already `false` is a no-op in React (no re-render). This is a classic "idempotent reset" pattern — harmless and actually useful as a reliability safety net (if one path fails silently, the other still clears the state).

## 6. How Trigger.dev scoped public tokens protect against unauthorized run access

When the sidebar calls `POST /api/ai/design/token`, the backend:
1. Verifies the caller is the authenticated Clerk user
2. Looks up the `TaskRun` record by `runId` and checks that `taskRun.userId === userId`
3. Only then issues a `createPublicToken` with `scopes: { read: { runs: [runId] } }`

The resulting token can only read that specific run — not list runs, not trigger tasks, not read other users' runs. It expires in 1 hour. This means even if the token leaked (e.g., XSS or browser devtools), an attacker could only read progress of that single already-running task, nothing more.
