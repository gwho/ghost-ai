# Fix: Canvas Drop Payload — Defensive JSON Parse and Shape Validation

## What Was Wrong

In `components/editor/canvas-flow.tsx`, the `onDrop` handler read the drag
payload and parsed it like this:

```ts
const raw = e.dataTransfer.getData('application/ghost-shape')
if (!raw) return

const { shape, width, height } = JSON.parse(raw) as {
  shape: string
  width: number
  height: number
}
```

Two problems combined here.

### Problem 1: Unguarded `JSON.parse`

`JSON.parse` throws a `SyntaxError` when the input is not valid JSON. The `!raw`
guard only catches an empty string — it does not protect against a non-empty
string that is not valid JSON (e.g. `"hello"`, `undefined`, or a partially
written payload). If that happened, the thrown error would be uncaught inside the
`useCallback`, silently killing the drop handler and potentially causing a React
error boundary to fire.

### Problem 2: The TypeScript type assertion does nothing at runtime

```ts
JSON.parse(raw) as { shape: string; width: number; height: number }
```

The `as` keyword is TypeScript syntax only. It is erased at compile time and
produces no JavaScript. At runtime, `JSON.parse` returns `unknown` and the type
assertion is purely a promise to the compiler — it does not actually check that
`shape` is a string or that `width` is a positive finite number.

This means a payload like `{ "shape": null, "width": -50, "height": Infinity }`
would pass straight through to `onNodesChange`, creating a node with a null
shape, a negative width, or an infinite height — all of which can silently
corrupt the canvas state.

| File | Lines | Issue | Status |
| --- | --- | --- | --- |
| `components/editor/canvas-flow.tsx` | 64–68 | `JSON.parse` unguarded, type assertion not a runtime check | Fixed |

---

## The Fix

Replaced the single destructuring line with a try/catch around the parse step,
followed by an explicit runtime validation guard. All existing variable names
(`raw`, `shape`, `width`, `height`) and the rest of the handler are untouched.

```ts
// Before
const { shape, width, height } = JSON.parse(raw) as {
  shape: string
  width: number
  height: number
}
```

```ts
// After
let shape: string, width: number, height: number
try {
  const parsed = JSON.parse(raw)
  shape = parsed?.shape
  width = parsed?.width
  height = parsed?.height
} catch {
  return
}
if (
  typeof shape !== 'string' || !shape ||
  typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
  typeof height !== 'number' || !Number.isFinite(height) || height <= 0
) return
```

The rest of the handler — `screenToFlowPosition`, building `newNode`,
`onNodesChange` — is completely unchanged.

---

## Why This Approach

### Why declare the variables with `let` before the try block?

Inside a `try` block, variables declared with `const` or `let` are scoped to
that block. The validation guard and the rest of the handler are *outside* the
try block, so they cannot see variables declared inside it. Declaring `shape`,
`width`, and `height` with `let` before the try makes them visible in the whole
handler scope. TypeScript also narrows them correctly — after the validation
guard passes, it knows each variable is the right type.

### Why `parsed?.shape` rather than `parsed.shape`?

`JSON.parse` returns `unknown` at runtime. If the payload is valid JSON but not
an object — for example `42` or `true` — then `parsed.shape` would throw
`TypeError: Cannot read properties of a primitive`. The optional chaining
`parsed?.shape` safely returns `undefined` instead, and the validation guard
below catches it.

### Why `Number.isFinite(width) && width > 0`?

`typeof x === 'number'` is true for `NaN`, `Infinity`, and `-Infinity`. All
three are legal `number` values in JavaScript, but none of them are safe node
dimensions for a canvas:

- `NaN` propagates through arithmetic silently.
- `Infinity` causes the layout engine to break.
- Negative values produce invisible or reversed nodes.

`Number.isFinite` rejects all three. The `> 0` check additionally rejects zero,
which would produce a node with no visible area.

---

## Beginner Mental Model: TypeScript Types Are Compile-Time Only

TypeScript's type system lives entirely in the editor and compiler. When your
code is compiled to JavaScript, every type annotation and `as` cast is stripped
out. The runtime — the browser or Node.js — has no idea about types.

```ts
// TypeScript sees: "shape is a string"
const { shape } = JSON.parse(raw) as { shape: string }

// JavaScript (what actually runs):
const { shape } = JSON.parse(raw)
// shape could be null, undefined, a number, an array — anything.
```

This is why external inputs — user events, API responses, drag payloads, URL
parameters — always need *runtime* validation, not just TypeScript types. The
type tells the compiler what you expect; the runtime check enforces it.

---

## Beginner Mental Model: Two Separate Failure Modes, Two Separate Guards

The fix has two separate guards because there are two separate failure modes:

```
JSON.parse(raw)  →  try/catch  →  returns early if the string is not valid JSON
parsed?.shape     →  type check →  returns early if the values are wrong types
```

It might be tempting to combine them into one big try/catch that catches
everything. But that would hide type errors inside the catch and make it harder
to tell why the drop was rejected. Keeping the two guards separate makes the
failure modes explicit.

---

## Validation

- IDE diagnostics for `components/editor/canvas-flow.tsx`: no linter errors.
- The handler structure is unchanged — `e.preventDefault()`, `e.stopPropagation()`,
  `!raw` guard, parse+validate, `screenToFlowPosition`, `onNodesChange` — all
  in the same order, with only the parse block replaced.

---

## Files Changed

| File | Change |
| --- | --- |
| `components/editor/canvas-flow.tsx` | Replaced bare `JSON.parse` + type cast with try/catch parse and runtime validation guard |
| `docs/fixes/fix-canvas-drop-payload-validation.md` | Added this fix log |
