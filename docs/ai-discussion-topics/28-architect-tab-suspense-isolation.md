# AI Discussion Topics: Architect Tab Suspense Isolation

These topics explore Suspense boundary propagation, error containment, stale closures in hooks, and resilient client-side state.

---

## 1. Suspense boundary propagation — why one boundary is not enough

**Question**: The sidebar was wrapped in `ClientSideSuspense fallback={null}`, and `RunTracker` was a child of the sidebar. Why did suspense from `useRealtimeRun` blank the entire sidebar instead of just affecting `RunTracker`? What determines which Suspense boundary catches a thrown promise?

**What to understand**: React Suspense works by walking up the component tree from the throwing component until it finds the nearest `<Suspense>` boundary. That boundary unmounts all its children and renders its fallback. If there's only one boundary wrapping both the chat UI and the risky hook, both are affected. Adding a nested boundary around just the risky component isolates its suspense. This is the same principle as try/catch scoping — a catch block at the top of a function handles all errors from that function, but a catch block around a single line only handles that line.

---

## 2. Error boundaries vs. Suspense boundaries — two containment mechanisms

**Question**: The fix adds both a `<Suspense>` boundary and an error boundary around `RunTracker`. Why are both needed? What's the difference between what they catch?

**What to understand**: Suspense boundaries catch thrown promises (the mechanism React uses for lazy loading and data fetching). Error boundaries catch thrown errors (runtime exceptions). A hook like `useRealtimeRun` could do either: throw a promise while connecting (suspense), or throw an error if the connection fails (runtime). Without both boundaries, one failure mode is unhandled. Neither boundary catches the other's failure type. Think of them as two different types of safety net — one for planned pauses, one for unplanned crashes.

---

## 3. Stale closures — why callbacks passed to hooks can go stale

**Question**: The original `RunTracker` passed an inline callback to `useRealtimeRun`'s `onComplete` option. Why might this callback reference outdated state? How does storing it in a `useRef` fix the problem?

**What to understand**: When a component renders, each callback creates a new closure that captures the current values of variables in scope. If a hook like `useRealtimeRun` stores the callback internally on mount and never re-reads it, it holds a reference to the first render's closure — which has the first render's state values. A `useRef` is a mutable container that persists across renders. By updating `ref.current` on every render and reading from `ref.current` inside the closure, you always get the latest values regardless of when the closure was created.

---

## 4. Dual-path completion detection — belt and suspenders

**Question**: The fix watches `run.status` via a `useEffect` instead of relying on the `onComplete` callback option. Why not just use one approach? What are the trade-offs of each?

**What to understand**: The `onComplete` callback is convenient when supported — it fires exactly once at the right time. But it depends on the hook's internal implementation: if the hook doesn't support it, silently ignores it, or captures it with a stale closure, it fails silently. Watching `run.status` in a `useEffect` is explicit and debuggable — you can log the status, see it in React DevTools, and verify the guard logic. The trade-off is more code and the need for a `firedRef` to prevent double-firing. Using both approaches is a "belt and suspenders" pattern: if one fails, the other still works. Discuss when redundancy is worth the complexity and when it's over-engineering.

---

## 5. sessionStorage for state resilience — surviving component re-mounts

**Question**: The fix persists `runId` and `publicToken` in `sessionStorage` keyed by `roomId`. Why can't React state or refs survive a component unmount/remount? When is sessionStorage the right tool vs. other persistence options?

**What to understand**: React `useState` initializes from its default value on every mount — it has no memory of previous mounts. `useRef` similarly resets on mount. Both are tied to the component instance, which is destroyed on unmount. `sessionStorage` persists across the browser tab's lifetime — it survives component unmounts, React re-renders, and even page navigations within the same tab. It's the right tool when: (a) the data is short-lived (tab-scoped, not cross-session), (b) the data is small (a run ID and token string), and (c) you need it to survive React lifecycle events. Compare with `localStorage` (persists across sessions — too sticky for a run ID), URL state (visible to the user and shareable — wrong for a token), and React context (destroyed with the provider — same problem as useState).

---

## 6. The fallback={null} trap — invisible failures

**Question**: The `ClientSideSuspense` wrapping the sidebar uses `fallback={null}`. What does the user see when this boundary activates? Why is `null` a dangerous fallback choice, and when is it appropriate?

**What to understand**: `fallback={null}` renders nothing — the sidebar simply vanishes. The user gets no loading indicator, no error message, no feedback at all. It looks like a bug, not a loading state. `null` is appropriate when the suspense is expected to resolve near-instantly (e.g., synchronous lazy imports) or when showing a placeholder would cause layout thrashing. It's dangerous when the suspense could last longer than a frame or could fail entirely — the user is left staring at a blank space with no way to diagnose the problem. A spinner or skeleton would at least communicate "something is happening." Discuss what the right fallback would be for this sidebar and how you'd decide.
