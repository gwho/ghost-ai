# Feature 29: Spec UI Integration — Explanation

## What This Feature Does

Feature 29 makes the Specs tab in the AI sidebar fully functional. Before this, the tab had a non-working "Generate Spec" button and a static placeholder card. After this feature:

- Clicking "Generate Spec" sends the current canvas + chat history to the AI, which produces a Markdown technical spec
- The Specs tab loads and displays a list of all past specs for the project
- Clicking a spec opens a preview modal showing it rendered as proper Markdown
- A download button (on both list items and the modal) saves the Markdown file to the user's machine

## How It Works

### Generating a Spec

When the user clicks "Generate Spec":

1. The sidebar reads the current canvas state using the `getCanvasSnapshot` callback (already threaded from `canvas-flow.tsx` via `workspace-shell.tsx`)
2. It also reads the architect chat history from the Liveblocks feed
3. Both are sent to `POST /api/ai/spec` along with the `roomId`
4. The backend triggers the `generate-spec` Trigger.dev task and returns a `runId`
5. A second call to `POST /api/ai/spec/token` gets a public read token for realtime tracking
6. The existing `RunTracker` component (already in the file) is reused — it subscribes to the run via `useRealtimeRun` and calls back when the run completes or fails
7. On success, the spec list refreshes automatically

### Loading the Spec List

When the user clicks the Specs tab, `fetchSpecs()` runs:

1. Calls `GET /api/projects/{projectId}/specs`
2. The backend returns `{ specs: [{ id, filePath, createdAt }] }`
3. The list renders each spec with a filename (extracted from the blob path) and a formatted date

### Preview Modal

When the user clicks a spec:

1. A `Dialog` modal opens immediately (before content loads) so the UI feels responsive
2. `GET /api/projects/{projectId}/specs/{specId}/download` is called as text
3. The response (raw Markdown) is rendered using `react-markdown` with a custom component map that applies the app's existing design tokens
4. The modal has a close button (built into shadcn's `DialogContent`) and Esc key support (handled by Radix)

### Download

Both the list item's download button and the modal footer's Download button:

1. Fetch the raw Markdown text from the download endpoint
2. Create a temporary in-memory file using `URL.createObjectURL(new Blob([text]))`
3. Trigger the browser's native save dialog by clicking a programmatically created `<a>` element
4. Revoke the object URL immediately to free memory

## Key Concepts for Beginners

### Why not access Vercel Blob directly from the browser?

Vercel Blob's private blobs require a signed URL or a server-side access token. Fetching them directly from the browser would require exposing credentials in client code — a security risk. Instead, the download endpoint in the backend fetches the blob with server credentials and streams the content back to the browser.

### Why use `URL.createObjectURL` for download?

The download endpoint returns `Content-Disposition: attachment`, which tells the browser to save the file. But when triggered via a `fetch()` call (not a direct navigation), the browser doesn't automatically save it. The object URL + temporary `<a>` click trick is the standard pattern for programmatic file downloads in React apps.

### What is RunTracker?

`RunTracker` is a tiny React component (already in the file since Feature 26) that renders nothing visible. It subscribes to a Trigger.dev run via `useRealtimeRun` and calls `onComplete(succeeded)` when the run reaches a terminal state. Feature 29 reuses it for spec runs without any modification — it just needs a different `runId` and `publicToken`.

### Why fetch specs only when the tab is active?

Fetching on mount would load specs even when the user never visits the Specs tab, wasting a network request. `onValueChange` on the `<Tabs>` component fires when a tab is selected, making the fetch lazy and demand-driven.

## Files Involved

| File | Role |
|---|---|
| `components/editor/ai-sidebar.tsx` | All Specs tab logic + preview modal |
| `app/api/ai/spec/route.ts` | Triggers the spec generation task |
| `app/api/ai/spec/token/route.ts` | Issues public token for realtime tracking |
| `app/api/projects/[projectId]/specs/route.ts` | Returns spec list |
| `app/api/projects/[projectId]/specs/[specId]/download/route.ts` | Returns raw Markdown content |
| `trigger/generate-spec.ts` | The Trigger.dev task that generates the spec |
