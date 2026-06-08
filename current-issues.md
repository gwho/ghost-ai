## Status

No active runtime errors.

## Recently Fixed

### AI Architect tab — messages vanish and no visual feedback (Fix 28)

**Symptoms:**
- Messages disappeared after sending a prompt in the AI Architect tab
- No loading state, no AI completion message despite the backend running successfully

**Root cause:** `RunTracker` (which calls `useRealtimeRun`) was inside the same `ClientSideSuspense fallback={null}` boundary as the rest of the sidebar. Suspense or errors from the Trigger.dev hook propagated to this boundary, unmounting the entire sidebar and losing all local state.

**Fix:** Isolated `RunTracker` with its own `<Suspense>` + error boundary. Hardened completion detection with `useEffect` on `run.status`. Added `sessionStorage` persistence for `runId`/`publicToken` to survive re-mounts.

See: `docs/plans/fix-28-architect-tab-messages-vanishing.md`

### RoomProvider missing from React tree (Fix 25)

Previously fixed — `RoomProvider` was lifted from `canvas-wrapper.tsx` to `workspace-shell.tsx`.

See: `docs/plans/fix-25-roomprovider-not-lifted.md`
