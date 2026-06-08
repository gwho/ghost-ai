# Fix: Architect Tab — Suspense Isolation and Resilient Run Tracking

## What Changed

`components/editor/ai-sidebar.tsx` was updated to isolate `RunTracker` from the sidebar's Suspense boundary and make run tracking resilient to component re-mounts.

**Before:** `RunTracker` (which calls `useRealtimeRun`) was a direct child of `AISidebar`, sharing the parent `ClientSideSuspense fallback={null}` boundary. Any suspense or error from the Trigger.dev hook would unmount the entire sidebar, losing all local state and blanking the UI.

**After:** `RunTracker` is wrapped in its own `<Suspense>` + error boundary. The completion callback uses a ref to avoid stale closures. Run status is watched via both `onComplete` and a `useEffect` safety net. `runId` and `publicToken` are persisted in `sessionStorage` so they survive re-mounts.

---

## Why

### 1. Suspense propagation blanks the sidebar

`ClientSideSuspense` from Liveblocks is a standard React `<Suspense>` boundary. When `RunTracker` mounts and `useRealtimeRun` initializes its WebSocket subscription, any thrown promise or error propagates up to this boundary. The fallback is `null`, so the entire sidebar disappears — messages, input, status strip, everything.

With its own `<Suspense>` boundary, `RunTracker` suspense is contained. The rest of the sidebar stays mounted and interactive.

### 2. Errors from useRealtimeRun crash the tree

`useRealtimeRun` has already caused crashes before (documented in `fix-realtime-run-access-token.md`). Without an error boundary between `RunTracker` and the rest of the sidebar, any runtime error from the hook takes down the entire sidebar. The new `RunTrackerErrorBoundary` catches these errors and renders nothing, keeping the sidebar alive.

### 3. Stale closures in the onComplete callback

The `onComplete` callback passed to `useRealtimeRun` is captured when the hook first reads its options. If the hook doesn't re-read options on subsequent renders, it uses a stale version of the callback that references outdated state. Storing the callback in a ref and reading from the ref in the closure ensures the latest version is always called.

### 4. State loss on re-mount

When `AISidebar` unmounts and remounts (from suspense resolution or any parent re-render), `useState` initializes with defaults — `runId` and `publicToken` become `null`. `RunTracker` doesn't mount, nobody tracks the run, and the completion message is never posted. Persisting these values in `sessionStorage` allows the component to restore tracking on remount.

---

## How It Works Now

### Suspense + Error Boundary isolation

```
AISidebar
  ├── useFeedMessages (architect feed)
  ├── Tabs UI
  └── RunTrackerErrorBoundary        ← catches runtime errors
        └── Suspense (fallback=null)  ← catches suspense promises
              └── RunTracker          ← useRealtimeRun lives here
```

The two boundaries form a containment shell around `RunTracker`. The rest of the sidebar is unaffected by anything that happens inside.

### Dual-path completion detection

```
useRealtimeRun(runId, { accessToken })
       │
       ├── returns { run }
       │      └── useEffect watches run.status
       │            └── terminal status? → fire onCompleteRef.current()
       │
       └── (onComplete option removed — not reliably supported)
```

A `firedRef` guard ensures the completion callback runs exactly once, even if `run.status` updates multiple times.

### sessionStorage persistence

On submit:
```
sessionStorage[`ghost-ai-run:${roomId}`] = JSON.stringify({ runId, publicToken })
```

On mount:
```
const stored = sessionStorage[`ghost-ai-run:${roomId}`]
if (stored) → restore runId + publicToken + isLoading
```

On completion:
```
sessionStorage.removeItem(`ghost-ai-run:${roomId}`)
```

---

## Beginner Mental Model: Suspense Boundaries as Blast Shields

**The core idea:** A React `<Suspense>` boundary is like a blast shield in a laboratory. It contains the effect of an "explosion" (a thrown promise or loading state) to a specific area. Without a shield, the blast propagates outward and takes down everything in its path.

**Before the fix:** There was one blast shield around the entire sidebar. When `RunTracker` "exploded" (threw a suspense promise), the shield activated and replaced everything inside with nothing (`fallback={null}`). The chat messages, input, status strip — all gone.

**After the fix:** `RunTracker` has its own personal blast shield. When it explodes, only the tiny invisible `RunTracker` component is affected. The sidebar keeps showing messages, the input stays active, and the user sees nothing unusual.

**Error boundaries work the same way** — they're blast shields for runtime errors instead of suspense promises. Both serve the same purpose: containment. The principle is: wrap risky code in its own boundary so that failures are localized.

**The sessionStorage pattern** is like a fire-proof safe inside the lab. Even if the blast shield activates and everything inside gets reset, the critical values (`runId`, `publicToken`) survive in the safe and can be retrieved when the lab is rebuilt.
