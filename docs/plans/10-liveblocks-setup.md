# Feature 10 — Liveblocks Setup

## What was built

Real-time collaboration infrastructure: typed Liveblocks config, a cached server
client with a color helper, and a guarded auth endpoint that issues session tokens.

## Files created

| File | Purpose |
|---|---|
| `lib/liveblocks.ts` | Lazy-cached `@liveblocks/node` client (`getLiveblocksClient()`) + `getCursorColor()` djb2 hash helper |
| `app/api/liveblocks-auth/route.ts` | POST endpoint — Clerk auth → project access check → room ensure → session token |

## Files modified

| File | Change |
|---|---|
| `liveblocks.config.ts` | Added `Presence` (cursor + isThinking) and filled out `UserMeta` (name, avatar, color); ESLint suppression on empty placeholder types |
| `package.json` / `package-lock.json` | Added `@liveblocks/node ^3.19.3` |

## liveblocks.config.ts

Typed the global `Liveblocks` interface:

```ts
Presence: {
  cursor: { x: number; y: number } | null
  isThinking: boolean
}

UserMeta: {
  id: string
  info: { name: string; avatar: string; color: string }
}
```

`Storage`, `RoomEvent`, `ThreadMetadata`, `RoomInfo` are left as `{}` placeholders
(standard Liveblocks pattern) with `eslint-disable` comments to silence the
`@typescript-eslint/no-empty-object-type` rule.

## lib/liveblocks.ts

### Lazy initialization

The `Liveblocks` client validates `LIVEBLOCKS_SECRET_KEY` at construction time and
throws if the key is absent or malformed. Instantiating at module load would crash
`next build` (page-data collection runs module evaluation without env vars set).
The solution is a `getLiveblocksClient()` getter that constructs on first call:

```ts
export function getLiveblocksClient(): Liveblocks {
  if (globalThis._liveblocks) return globalThis._liveblocks
  const client = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })
  if (process.env.NODE_ENV !== 'production') globalThis._liveblocks = client
  return client
}
```

The `globalThis` cache prevents a new client being created on every hot-reload
in development; in production the module is only evaluated once so no cache is
needed.

### getCursorColor

djb2 hash over the user ID string, mod 10 palette of Tailwind-matching hex colors.
Same user ID always produces the same color — deterministic across all sessions
and server instances.

## app/api/liveblocks-auth/route.ts

Request flow:

1. Parse `room` from JSON body — 400 if missing.
2. `getProjectAccess(room)` — re-uses existing helper; returns `null` for
   unauthenticated or non-member callers → 403.
3. `currentUser()` — Clerk server call to get name/avatar.
4. `getLiveblocksClient().getOrCreateRoom(room, { defaultAccesses: [] })` —
   creates the room as private if it doesn't exist yet. `LiveblocksError` is caught
   and swallowed (room already exists is not fatal); any other error propagates.
5. `prepareSession(userId, { userInfo })` + `session.allow(room, FULL_ACCESS)` —
   grants full read/write on this specific room only.
6. `session.authorize()` returns `{ body, status }` — returned directly as a
   `Response` (not `NextResponse`) so the raw body bytes pass through unchanged.

## Key decisions

- **Access tokens over ID tokens**: access tokens (`prepareSession`) are simpler
  and sufficient here — permissions are per-room, verified server-side before the
  token is issued, so the extra complexity of ID token permission resolution isn't
  needed.
- **`getOrCreateRoom` in the auth route, not at project creation time**: rooms are
  cheap and the auth route always runs before any client connects, so creating the
  room on first connect is safe and keeps project creation simple.
- **403 before Clerk user lookup**: `getProjectAccess` already calls Clerk
  internally (`getCurrentIdentity`), so unauthorized requests are rejected before
  the extra `currentUser()` call.

## Verification

`npm run build` passes clean. `/api/liveblocks-auth` appears in the route table
as a dynamic (ƒ) server-rendered route.
