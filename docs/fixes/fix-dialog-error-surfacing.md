# Fix: Surface API Errors in Project Dialogs

## Finding

`handleCreate`, `handleRename`, and `handleDelete` in
`hooks/use-project-actions.ts` all silently swallowed errors:

```ts
} catch {
  setIsLoading(false)
}
```

When an API call returned a non-ok status or the fetch itself threw, the user saw
the loading spinner stop but got no explanation of what went wrong. The response
body (which often contains a useful `{ error: "..." }` message) was never read.

## Decision

Add `error` / `setError` to the dialogues state and surface API error details
inline in each dialog. This keeps the error visible in the context where the user
took the action, without requiring a separate toast system.

## What Changed

### `hooks/use-project-dialogues.ts`

- Added `error: string | null` state and `setError` setter to the interface and
  hook return.
- `closeDialog` now also resets `error` to `null`.

### `hooks/use-project-actions.ts`

- Added a small `extractErrorMessage` helper that reads `res.json()` for an
  `error` field, falling back to a sensible default message.
- Each handler now:
  1. Calls `setError(null)` at the start to clear stale errors.
  2. On `!res.ok`, reads the API error message and calls `setError(msg)`.
  3. In the `catch` block, extracts the `Error.message` if available.
  4. Calls `setIsLoading(false)` in every error path.
  5. Only calls `closeDialog()` on success.

### `components/editor/project-dialogs.tsx`

- Each dialog destructures `error` from context.
- A `<p className="text-sm text-error">` line renders the error inline when
  the relevant dialog is open and an error is set.

## Why This Approach

| Option | Why / why not |
|---|---|
| Inline error in dialog (chosen) | Minimal, keeps error next to the action, no new dependencies. |
| Toast notification | Requires a toast system the project doesn't have yet. |
| `window.alert` | Blocks the UI and feels dated. |
| Console-only logging | Invisible to the user — same as the original bug. |

## How the Fix Works

When the user clicks "Create" and the API returns `400 { error: "Name taken" }`:

1. `handleCreate` sees `!res.ok`.
2. `extractErrorMessage` reads the JSON body → `"Name taken"`.
3. `setError("Name taken")` updates dialogue state.
4. `setIsLoading(false)` re-enables the form.
5. `CreateProjectDialog` renders `<p class="text-sm text-error">Name taken</p>`
   below the input.
6. The dialog stays open so the user can correct and retry.
7. On the next attempt, `setError(null)` clears the old message.

If the fetch itself throws (network failure), the `catch` block captures
`err.message` (e.g., `"Failed to fetch"`) and calls `setError` with it.

## Beginner Model — Why Silent Errors Are a Bug

When something goes wrong and the app shows *nothing*, users don't know:
- Whether their action worked or failed
- Whether they should retry or give up
- What they need to fix (wrong input? network? permissions?)

The technical term is "swallowing" the error — the code catches the exception but
discards it. The fix is to **surface** the error: read the details from the
response, translate them into a human-readable message, and show that message
where the user is looking (the open dialog).

## Validation

- `npx tsc --noEmit --pretty false` — passed
- `npm run lint` — only pre-existing `setOwnedProjects` warning (unrelated)
- IDE linter — clean on all three files
