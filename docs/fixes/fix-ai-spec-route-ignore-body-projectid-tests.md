# Fix: AI Spec Route Tests — Harden Against Body projectId Spoofing

## What Was Wrong

The `POST /api/ai/spec` handler in `app/api/ai/spec/route.ts` resolves project
access and triggers background work using **`roomId` only** — it never reads
`projectId` from the request body:

```ts
const { roomId, chatHistory, nodes, edges } = body as Record<string, unknown>
// roomId IS the projectId in this system — never trust a client-supplied projectId
const access = await getProjectAccess(roomId)
...
handle = await tasks.trigger('generate-spec', {
  projectId: roomId,
  roomId,
  chatHistory,
  nodes,
  edges,
})
```

**Production code was already correct.** No route change was required.

**Tests were insufficient.** Two test blocks in
`__tests__/api/ai/spec/route.test.ts` documented the intent ("never trust
client-supplied projectId") but did not include an attacker-controlled
`projectId` in the request body. A future regression that started reading
`body.projectId` for access checks or task payloads would not fail those tests.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `__tests__/api/ai/spec/route.test.ts` | ~205–212 | `getProjectAccess` test lacked spoofed `body.projectId` | Fixed |
| `__tests__/api/ai/spec/route.test.ts` | ~298–311 | Task trigger test lacked spoofed `body.projectId` | Fixed |
| `app/api/ai/spec/route.ts` | 23, 41–55 | Handler already ignores `body.projectId` | No change (skipped) |

---

## The Fix

Both tests now send `projectId: 'attacker-project'` alongside a distinct
`roomId` and assert the handler uses `roomId`-derived values only.

### Test 1 — `getProjectAccess` uses roomId

```ts
await POST(makeRequest({
  ...validBody,
  roomId: 'room-abc',
  projectId: 'attacker-project',
}))

expect(mockGetProjectAccess).toHaveBeenCalledWith('room-abc')
expect(mockGetProjectAccess).not.toHaveBeenCalledWith('attacker-project')
expect(mockGetProjectAccess).not.toHaveBeenCalledWith(expect.anything(), expect.anything())
```

### Test 2 — `tasks.trigger` payload uses roomId as projectId

```ts
await POST(makeRequest({
  ...validBody,
  roomId: 'room-id-is-project-id',
  projectId: 'attacker-project',
}))

expect(mockGetProjectAccess).toHaveBeenCalledWith('room-id-is-project-id')
expect(mockTasksTrigger).toHaveBeenCalledWith('generate-spec', expect.objectContaining({
  projectId: 'room-id-is-project-id',
  roomId: 'room-id-is-project-id',
}))
expect(mockTasksTrigger).not.toHaveBeenCalledWith(
  'generate-spec',
  expect.objectContaining({ projectId: 'attacker-project' }),
)
```

---

## Why No Route Change

Adding explicit rejection of `body.projectId` (e.g. returning 400 when present)
would be defense-in-depth but is out of scope here. The handler uses allowlist
destructuring — only `roomId`, `chatHistory`, `nodes`, and `edges` are read.
Extra fields are silently ignored, which is safe as long as no code path reads
them. The hardened tests act as a regression guard for that invariant.

---

## Beginner Mental Model: Trust Boundaries

An API route is a **trust boundary** between the client and server. Anything in
the request body is attacker-controlled unless proven otherwise.

In Ghost AI, `roomId` in the editor URL is the canonical project identifier.
A malicious client could add `"projectId": "someone-elses-project"` to the JSON
body hoping the server uses it for authorization or storage. Secure handlers:

1. **Allowlist** which body fields they read (this route does).
2. **Never** use client-supplied IDs for auth when a server-known ID exists.
3. **Test** with spoofed values so regressions are caught in CI.

This is related to **IDOR** (Insecure Direct Object Reference): using a client
ID without verifying the caller owns that resource.

```
Client body                Route handler
┌─────────────────┐       ┌──────────────────────────┐
│ roomId (trusted)│──────▶│ getProjectAccess(roomId) │
│ projectId (?)   │       │ tasks.trigger({          │
│ chatHistory     │       │   projectId: roomId      │
│ nodes, edges    │       │ })                       │
└─────────────────┘       └──────────────────────────┘
        │
        └── projectId never read ──▶ ignored
```

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is IDOR and how do allowlisted body parsing and server-side ID
   resolution prevent it?"** — Walk through a spec-generation request where
   the attacker swaps `projectId` in the body.

2. **"Allowlist vs denylist when parsing JSON request bodies"** — Why
   destructuring only known fields is safer than rejecting unknown fields one
   by one.

3. **"How do you write regression tests for security invariants?"** — Pattern:
   include the attack vector in the test input, assert the safe code path was
   taken, assert the unsafe path was not.

4. **"When should an API return 400 for unexpected body fields vs silently
   ignore them?"** — Trade-offs for strict schemas (Zod) vs minimal handlers.

5. **"How does roomId map to projectId in this codebase?"** — Liveblocks room
   naming, editor routing, and why they are the same identifier here.

---

## Validation

```
npx vitest run __tests__/api/ai/spec/route.test.ts
```

- 22/22 tests pass
- IDE linter — no errors on changed file

---

## Files Changed

| File | Change |
|------|--------|
| `__tests__/api/ai/spec/route.test.ts` | Hardened two tests with spoofed `body.projectId` |
| `docs/fixes/fix-ai-spec-route-ignore-body-projectid-tests.md` | This document |
| `docs/plans/harden-ai-spec-route-body-projectid-tests-plan.md` | Implementation plan |
