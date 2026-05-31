# Spec Explanation — Feature 10: Liveblocks Setup

## Why this feature exists

Ghost AI is a real-time collaborative canvas. Multiple users need to see each
other's cursors, know who else is "thinking" (waiting on AI), and eventually
share live canvas state. Liveblocks is the infrastructure layer that handles all
of this — it manages WebSocket connections, conflict resolution, and presence
syncing so we don't have to. This feature lays the foundation before any visible
real-time UI is built.

## Key concepts

### What is "presence"?

Presence is the live, ephemeral state each connected user broadcasts to everyone
else in the same room. It disappears when the user disconnects. In this app,
presence tracks two things:

| Field | Type | What it means |
|---|---|---|
| `cursor` | `{ x, y } \| null` | Where the user's mouse is on the canvas right now |
| `isThinking` | `boolean` | Whether this user is waiting for an AI response |

`null` cursor means the user's mouse is outside the canvas — rather than
snapping other people's cursors to an old position, it hides them entirely.

### What is `UserMeta`?

UserMeta is the fixed profile information attached to a user when they
authenticate with Liveblocks. Unlike presence (which updates constantly), UserMeta
is set once per session. It's what shows up in an avatar stack or cursor label:

```ts
info: {
  name: string    // "Jesse James"
  avatar: string  // Clerk profile photo URL
  color: string   // deterministic hex color, e.g. "#60A5FA"
}
```

### Why does TypeScript need a global `interface Liveblocks` declaration?

Liveblocks uses a technique called **declaration merging**. The `liveblocks.config.ts`
file declares additions to the `Liveblocks` interface that Liveblocks itself
defined in its package. TypeScript merges these together, so every hook in the
codebase — `useMyPresence()`, `useOthers()`, `useSelf()` — is automatically
typed with your specific `Presence` and `UserMeta` shapes. You never have to pass
generic type parameters.

### Why does the `liveblocks.config.ts` have empty `{}` types for Storage, RoomEvent, etc.?

These are intentional placeholders. Liveblocks requires all six slots to be
declared in the interface even if they're empty today. Future features will fill
them in — for example, `Storage` will hold the canvas node/edge data when we add
multiplayer React Flow. The `eslint-disable` comments suppress a TypeScript lint
rule that flags `{}` as too permissive; in this context the emptiness is correct
and intentional.

---

## The client: why lazy initialization?

The `Liveblocks` class (from `@liveblocks/node`) validates your secret key the
moment it is constructed. If the key is missing or wrong, it throws immediately.

The problem: during `next build`, Next.js evaluates every module file to collect
page metadata. If the client is instantiated at the top level of the file:

```ts
// WRONG — runs at module load time
export const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })
```

…then the build crashes with `Invalid value for field 'secret'` because build
machines don't have your secret key set.

The fix is a **lazy getter** — a function that creates the client only when it is
first called (i.e., at actual request time, not at import time):

```ts
export function getLiveblocksClient(): Liveblocks {
  if (globalThis._liveblocks) return globalThis._liveblocks
  const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })
  if (process.env.NODE_ENV !== 'production') globalThis._liveblocks = client
  return client
}
```

The `globalThis` cache prevents a new client being re-created on every hot-reload
in development. In production the module is only evaluated once anyway, so the
cache is skipped there.

---

## The color helper: why not just pick a random color?

```ts
export function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}
```

If we picked a random color on each session, the same user would get a different
color every time they open the app — and a different color on each browser tab.
Collaborators would find it confusing.

The **djb2 hash** converts the user's ID string (which is fixed and unique) into
a number, then takes `mod 10` to pick from a fixed palette. The result:

- Same user ID → always same color, on any machine, in any session
- Different users → usually different colors (not guaranteed, but statistically
  likely with a 10-color palette)
- No database lookup or storage needed — pure computation

---

## The auth route: what happens step by step

When a Liveblocks-powered component mounts in the browser, it calls your
`authEndpoint` (which we'll configure to `/api/liveblocks-auth`) and sends the
room ID it wants to join. Here's what the route does:

### Step 1 — Parse the room ID

```ts
const { room } = await request.json()
```

The room ID is the project ID (e.g. `clx123abc`). We use the project ID directly
as the Liveblocks room ID — one project = one room.

### Step 2 — Verify project membership

```ts
const access = await getProjectAccess(room)
if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

`getProjectAccess` is the same helper used by all project API routes. It checks
Clerk auth + database membership in one call. If the user isn't logged in, or
isn't a project member, we return 403 here — the client never gets a token.

### Step 3 — Get Clerk user info

```ts
const user = await currentUser()
```

We need the user's name and avatar to attach to the session. `currentUser()` is
a Clerk server helper that returns the full user profile.

### Step 4 — Ensure the room exists

```ts
await lb.getOrCreateRoom(room, { defaultAccesses: [] })
```

Liveblocks rooms must be created before users can connect. `getOrCreateRoom`
creates it if it doesn't exist yet, or returns the existing room if it does.
`defaultAccesses: []` means the room is private by default — nobody can enter
without an explicit token, which our auth route controls.

A `LiveblocksError` is caught and ignored here: if the room was already created
by a previous request, Liveblocks may return an error instead of silently
returning — we swallow it because the "already exists" case is not a failure.

### Step 5 — Issue the session token

```ts
const session = lb.prepareSession(user.id, {
  userInfo: { name, avatar, color },
})
session.allow(room, session.FULL_ACCESS)
const { body, status } = await session.authorize()
return new Response(body, { status })
```

`prepareSession` creates a scoped token for this user. `session.allow(room, FULL_ACCESS)`
grants them read + write access on this specific room only — not any other room.
`session.authorize()` exchanges this with the Liveblocks API and returns a signed
JWT that the browser client will use to open the WebSocket connection.

### Why `new Response(body, { status })` instead of `NextResponse.json(...)`?

`session.authorize()` returns a raw JWT string in `body`. `NextResponse.json()`
would serialize it as a JSON-encoded string (i.e., wrap it in quotes), which
would break the Liveblocks client parser. `new Response(body, { status })` passes
the raw string through unchanged.

---

## Access tokens vs ID tokens

Liveblocks offers two auth patterns:

| | Access tokens (`prepareSession`) | ID tokens (`identifyUser`) |
|---|---|---|
| **How it works** | You grant per-room permissions in the endpoint | Liveblocks resolves permissions from its dashboard config |
| **Best for** | Apps with custom permission logic (like ours) | Apps with simple or static permissions |
| **Where access is enforced** | In your endpoint code | In Liveblocks dashboard rules |

We use **access tokens** because we already have our own membership model
(`ProjectCollaborator`). Each call to the auth endpoint re-checks the database,
so revoking access (removing a collaborator) takes effect on the next token
refresh automatically.
