# Plan: Feature 29 — Spec UI Integration

## Goal

Wire the existing Specs tab in `ai-sidebar.tsx` to the backend endpoints built in Features 27 & 28. Users should be able to generate a spec, see a list of past specs, preview a spec as rendered Markdown, and download it — all from the sidebar.

## Context

Features 27 & 28 delivered:
- `POST /api/ai/spec` — triggers `generate-spec` Trigger.dev task, returns `{ runId }`
- `POST /api/ai/spec/token` — issues a scoped Trigger.dev public token for realtime run tracking
- `GET /api/projects/[projectId]/specs` — returns `{ specs: [{ id, filePath, createdAt }] }`
- `GET /api/projects/[projectId]/specs/[specId]/download` — returns raw Markdown as `Content-Disposition: attachment`

The Specs tab in `ai-sidebar.tsx` was a static placeholder. This plan replaces it entirely without touching the AI Architect or Chat tabs.

## Scope

Single file changed: `components/editor/ai-sidebar.tsx`

## Decisions

### Reuse existing RunTracker
The `RunTracker` component (already in the file) accepts any `runId + publicToken`. It is reused for spec run tracking by adding a second `specRunId`/`specPublicToken` state pair and a second `RunTracker` render below the existing one.

### Fetch on tab activation
Specs are loaded when the Specs tab becomes active via `onValueChange` on the `<Tabs>` component. This avoids fetching on mount when the user may never visit the tab.

### Avoid nested interactive elements
Spec list items use a `<div role="button">` with `onClick`/`onKeyDown` rather than a `<button>`, because each item also contains a download `<button>`. Nesting `<button>` inside `<button>` is invalid HTML.

### Markdown rendering
`react-markdown` is installed. Custom component map applies existing CSS tokens (`text-copy-primary`, `bg-surface`, `text-ai-text`, etc.) without importing `@tailwindcss/typography`, keeping styling consistent with the rest of the app.

### Download mechanism
The download endpoint returns raw Markdown text. The browser download is triggered client-side:
1. Fetch the endpoint as text
2. Create a `Blob` → `URL.createObjectURL`
3. Click a temporary `<a>` element with `download` attribute
4. Revoke the object URL immediately after

### No long-term state for preview content
Preview content is fetched when the modal opens and stored only in component state (`previewContent`). It is reset to `null` each time a new spec is selected — content is never accumulated.

## State additions (all local)

| State | Purpose |
|---|---|
| `specs` | Fetched spec list |
| `specsLoading` / `specsError` | Spec list loading state |
| `isSpecGenerating` / `specGenError` | Generate Spec run state |
| `specRunId` / `specPublicToken` | Trigger.dev realtime tracking |
| `previewOpen` / `previewSpec` | Modal visibility + selected spec |
| `previewContent` / `previewLoading` | Modal content fetch state |

## Files Modified

- `components/editor/ai-sidebar.tsx` — Specs tab implementation
- `context/progress-tracker.md` — Feature 29 marked complete

## Package Added

- `react-markdown` — Markdown rendering in the preview modal
