# Fix: Canvas PUT — No Payload Validation Before Persisting to Blob Storage

## What Was Wrong

The `PUT` handler in `app/api/projects/[projectId]/canvas/route.ts` called
`put()` (Vercel Blob) immediately after parsing the request body, with no
checks on the shape of `nodes` or `edges`:

```ts
// Before — no validation; any payload is persisted as-is
const { nodes = [], edges = [] } = body

const blob = await put(
  `canvas/${projectId}.json`,
  JSON.stringify({ nodes, edges }),
  { access: 'private', contentType: 'application/json', addRandomSuffix: false },
)
```

The `= []` defaults only activate when `body.nodes` or `body.edges` are
`undefined`. If a caller sends `{ nodes: "oops" }` or `{ nodes: [{ bad:
true }] }`, the default is bypassed and the garbage value is stored verbatim
to the blob. On the next `GET`, that blob is loaded into the canvas editor,
which would either crash React Flow or silently produce a broken canvas state.

This is a classic **write-without-validation** vulnerability: the persistence
layer trusts the caller completely.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `app/api/projects/[projectId]/canvas/route.ts` | 43–49 | No array or shape validation before `put()` | Fixed |

---

## The Fix

Two pure helper functions added at the top of the module, and three guard
checks inserted between the destructuring and the `put()` call. The
`nodes`/`edges` variable names are unchanged; the `put()` call is unchanged.

### Validators (module level)

```ts
function isValidNode(n: unknown): boolean {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return false
  const node = n as Record<string, unknown>
  if (typeof node.id !== 'string' || !node.id) return false
  if (typeof node.type !== 'string') return false
  if (!node.position || typeof node.position !== 'object' || Array.isArray(node.position)) return false
  const pos = node.position as Record<string, unknown>
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return false
  if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) return false
  const data = node.data as Record<string, unknown>
  if (typeof data.label !== 'string') return false
  return true
}

function isValidEdge(e: unknown): boolean {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  const edge = e as Record<string, unknown>
  if (typeof edge.id !== 'string' || !edge.id) return false
  if (typeof edge.source !== 'string' || !edge.source) return false
  if (typeof edge.target !== 'string' || !edge.target) return false
  return true
}
```

### Guards in the handler

```ts
const { nodes = [], edges = [] } = body

if (!Array.isArray(nodes) || !Array.isArray(edges)) {
  return NextResponse.json({ error: 'nodes and edges must be arrays' }, { status: 400 })
}

if (!nodes.every(isValidNode)) {
  return NextResponse.json(
    { error: 'Invalid node: each node requires id (string), type (string), position ({x: number, y: number}), and data.label (string)' },
    { status: 400 },
  )
}

if (!edges.every(isValidEdge)) {
  return NextResponse.json(
    { error: 'Invalid edge: each edge requires id, source, and target as non-empty strings' },
    { status: 400 },
  )
}

// put() is only reached when all three guards pass
const blob = await put(...)
```

---

## What Each Validator Checks and Why

### Node fields

| Field | Check | Why |
|-------|-------|-----|
| `id` | non-empty string | React Flow requires a unique string ID to track, select, and delete nodes |
| `type` | string | React Flow uses `type` to look up the renderer in `nodeTypes`; a non-string crashes the lookup |
| `position` | object (not array) with numeric `x` and `y` | React Flow positions nodes in canvas coordinates; missing or non-numeric values break layout |
| `data` | object (not array) | The data bag must be a plain object |
| `data.label` | string | `CanvasNodeComponent` renders `data.label`; a non-string would produce a React type error |

`Array.isArray` is checked explicitly because in JavaScript `typeof [] ===
'object'` — an array would pass a plain `typeof` check but is not a valid
node object.

### Edge fields

| Field | Check | Why |
|-------|-------|-----|
| `id` | non-empty string | React Flow needs a unique ID to manage edge state |
| `source` | non-empty string | Identifies the source node; React Flow throws if this is missing |
| `target` | non-empty string | Identifies the target node; React Flow throws if this is missing |

Edge `type` and `data` are optional (React Flow provides defaults), so they
are not required by the validator.

---

## Why Each Decision Was Made

### Decision 1: Pure module-level functions, not inline `if` chains

Inline guards would work, but module-level functions:
- are named (`isValidNode`, `isValidEdge`) making the intent self-documenting
- can be unit-tested independently without starting the HTTP server
- keep the handler body focused on orchestration logic

### Decision 2: `Array.every()` instead of `Array.find()` + early return

`nodes.every(isValidNode)` reads as "every node passes the check" — a single
assertion. An early `find` + null check would also work but is more verbose.
`every` short-circuits at the first failing element, so performance is
identical.

### Decision 3: Descriptive error messages in 400 responses

The 400 responses include field names and expected types. This is safe to
expose because:
- The information describes the *public API contract*, not server internals
- A developer integrating with the API needs this detail to fix their payload
- It does not reveal database addresses, credentials, or stack traces

Compare this to the earlier `liveblocks-auth` fix where `error.message` was
suppressed — that was an *unexpected* internal exception; these 400 messages
are *intentional* API contract violations communicated to the caller.

### Decision 4: Validate shape but not exact enum values

`isValidNode` checks that `node.type` is a `string`, not that it equals
`'canvasNode'`. This is intentional — future node types (e.g. from templates
or plugins) should not be silently rejected by a hardcoded allowlist at the
persistence layer. The rendering layer (React Flow's `nodeTypes` map) handles
unrecognised types gracefully. Tighten this only if the API explicitly becomes
a closed, versioned contract.

---

## Beginner Mental Model: Validate at the Boundary

Every system has **trust boundaries** — lines where data moves from an
untrusted source into a trusted internal system. The rule:

```
untrusted input → [validation gate] → trusted internal state
```

In this route, the trust boundary is the HTTP request body. Once data passes
the `req.json()` parse, the code treats it as legitimate canvas state. Before
this fix, the gate was missing — the data went straight from "untrusted HTTP
payload" to "persisted blob storage."

Adding the validators restores the gate. Only data that matches the expected
shape can cross into the persistence layer.

---

## Beginner Mental Model: Why `typeof [] === 'object'` Is a JavaScript Trap

```js
typeof {}    // → 'object'   ✓ plain object
typeof []    // → 'object'   ← same! arrays are objects in JS
typeof null  // → 'object'   ← also the same! (historical JS quirk)
```

This is one of JavaScript's oldest quirks. `typeof` can't distinguish between
a plain object, an array, or `null` — they all return `'object'`.

The correct way to tell them apart:

```js
Array.isArray([])   // → true
Array.isArray({})   // → false
n === null          // → true for null specifically
```

The validators use all three checks together:

```ts
if (!n || typeof n !== 'object' || Array.isArray(n)) return false
```

- `!n` catches `null` (and any other falsy value)
- `typeof n !== 'object'` catches strings, numbers, booleans
- `Array.isArray(n)` catches arrays

Only a non-null, non-array object passes all three.

---

## Topics to Explore With an AI for Deeper Understanding

1. **"What is input validation vs. sanitisation, and when should you use each?"**
   — Validation rejects bad data; sanitisation transforms it. Understand when
   each is appropriate and why this route uses validation (reject) rather than
   sanitisation (coerce).

2. **"What is `Array.prototype.every` and how does short-circuit evaluation work?"**
   — How `every` stops at the first `false`, and contrast with `some`, `find`,
   and `filter`.

3. **"Why does `typeof null === 'object'` in JavaScript and how did that bug
   survive for 30+ years?"** — The historical reason, why it was never fixed,
   and the idioms (`=== null`, `Array.isArray`) used to work around it.

4. **"What is a trust boundary in software security and how do you identify
   one?"** — The principle behind input validation at API boundaries, and how
   it relates to concepts like injection attacks and data integrity.

5. **"What is the difference between runtime type validation and TypeScript's
   compile-time types?"** — TypeScript types are erased at runtime; they
   provide no protection against untrusted external data. Libraries like `zod`
   or `valibot` bridge this gap.

6. **"How does React Flow use `id`, `type`, `source`, and `target`
   internally?"** — Understanding why these fields are load-bearing helps
   decide which fields are truly required versus optional in the validator.

---

## Validation

- IDE linter — no errors after the change
- Sending `{ nodes: "not-an-array", edges: [] }` → `400 nodes and edges must be arrays`
- Sending `{ nodes: [{ bad: true }], edges: [] }` → `400 Invalid node: ...`
- Sending `{ nodes: [], edges: [{ id: "e1" }] }` (missing source/target) → `400 Invalid edge: ...`
- Sending a well-formed canvas → `200 { url: "..." }` and blob is persisted as before

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `app/api/projects/[projectId]/canvas/route.ts` | 6–27 | Added `isValidNode` and `isValidEdge` module-level validators |
| `app/api/projects/[projectId]/canvas/route.ts` | 68–93 | Added three guard checks (array type, node shape, edge shape) before `put()` |
