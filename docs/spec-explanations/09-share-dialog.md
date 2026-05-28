# Spec Explanation — Feature 09: Share Dialog

## Why this feature exists

Collaboration is a core product promise. Without a way to add other users to a
project, every workspace is private forever. The share dialog is the entry point
for the collaboration model: owners grant access, collaborators get a read-only
view of who else has access.

## Key concepts

### Role separation at two layers

The spec distinguishes owners from collaborators both in the UI (owners can
invite and remove; collaborators can only view) and on the server (POST and
DELETE are owner-only). This means a collaborator who discovers the API
endpoint cannot escalate their own access or remove others — the server always
re-checks `isOwner` from `getProjectAccess`, which reads the database, not a
client-supplied value.

### Why collaborators are stored by email, not Clerk user ID

`ProjectCollaborator` stores `email`, not `userId`. This allows inviting someone
who doesn't have a Clerk account yet. When they sign up with that email, they
will already have access — no re-invitation needed. The tradeoff: email is
mutable (users can change it in Clerk), but for this app's scale that's an
acceptable limitation.

### Clerk Backend API for enrichment

Collaborators are bare emails in the database. To show names and avatars, we
call the Clerk Backend API from the route handler (server-side, never in the
browser). The pattern:

```ts
const clerk = await clerkClient()
const { data: users } = await clerk.users.getUserList({ emailAddress: emails })
```

`clerkClient()` (called as a function in v7+) returns an authenticated Clerk
client using the server-side API key from the environment. `getUserList` accepts
a filter of email addresses and returns matching Clerk users. If no Clerk account
exists for an email, the row simply doesn't appear in the result, and the
frontend falls back to showing the raw email.

### Batching the Clerk lookup

Instead of calling Clerk once per collaborator (N+1 pattern), we pass all emails
in a single `getUserList` call and build a `Map<email, enrichment>` in memory.
This keeps the GET endpoint at two network calls regardless of how many
collaborators a project has.

### Why the enrichment maps by all email addresses, not just primary

A Clerk user can have multiple email addresses. The collaborator might have been
invited with a secondary address. Iterating all `u.emailAddresses` and mapping
each to the enrichment data ensures we match even if the stored email isn't the
user's primary address.

### Copy link without a round trip

The "Copy" button reads `window.location.origin` and constructs
`/editor/${projectId}`. This is deterministic from data the client already has —
no API call needed. The 2-second "Copied!" state is a `setTimeout` wired to a
`useRef`-tracked timer so rapid clicks don't stack multiple resets.

### `isOwner` flows from the server

`getProjectAccess()` returns `{ project, isOwner }`. The server component
(`WorkspacePage`) passes `isOwner` as a prop to `WorkspaceShell`, which passes
it to `ShareDialog`. The dialog uses it to conditionally render the invite input
and remove buttons. This means the client never decides ownership for itself —
it only renders what the server told it.

### State resets on dialog open

The dialog uses `useEffect` keyed on `{ open, projectId }` to re-fetch
collaborators each time the dialog opens. This ensures stale data from a
previous open is not shown and that optimistic UI updates (invite/remove) stay in
sync with the server state.

### Error display

Invite errors (duplicate, bad email, own email) are shown inline below the input
field and cleared when the user starts typing again. This keeps the error
contextual and avoids modal-within-modal alert patterns.
