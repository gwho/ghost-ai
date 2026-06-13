# Fix: getSpecFilename — Nullish Coalescing Fallback Never Activates

## What Was Wrong

The `getSpecFilename` helper in `components/editor/ai-sidebar.tsx` extracts the
last path segment from a blob URL or relative path and falls back to `'spec.md'`
when no filename is present:

```ts
// Before — fallback never activates for empty strings
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}
```

**Symptom:** When `filePath` is empty (`''`) or ends with a slash
(`'specs/project-1/'`), the UI displayed a blank filename instead of `'spec.md'`.

**Root cause:** `String.prototype.split('/').pop()` always returns a `string` —
never `null` or `undefined`. For empty or trailing-slash inputs it returns `''`
(empty string). The nullish coalescing operator (`??`) only falls back when the
left-hand side is `null` or `undefined`, not when it is any other falsy value
(including `''`). So the `'spec.md'` fallback was dead code for those edge cases.

| File | Lines | Issue | Status |
|------|-------|-------|--------|
| `components/editor/ai-sidebar.tsx` | 92–94 | `??` never triggers on empty `pop()` result | Fixed |
| `__tests__/components/editor/ai-sidebar-utils.test.ts` | 16–18, 76–80, 95–98 | Mirrored buggy helper + tests documenting wrong behavior | Fixed |
| `__tests__/helpers/spec-helpers.test.ts` | 12–14, 30–35 | Same mirrored helper + trailing-slash test | Fixed |

---

## Runtime Evidence

Debug instrumentation confirmed the behavior at runtime:

| Input | `pop()` result | `?? 'spec.md'` | `\|\| 'spec.md'` |
|-------|----------------|----------------|-----------------|
| `'specs/project-1/spec-abc.md'` | `'spec-abc.md'` | `'spec-abc.md'` | `'spec-abc.md'` |
| `'specs/project-1/'` | `''` | `''` (bug) | `'spec.md'` (correct) |
| `''` | `''` | `''` (bug) | `'spec.md'` (correct) |

Log lines showed `poppedIsEmpty: true`, `poppedIsNull: false`,
`poppedIsUndefined: false` for both edge cases — confirming that `??` does not
activate but `||` does.

---

## The Fix

```ts
// After — empty strings correctly fall back to 'spec.md'
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() || 'spec.md'
}
```

Test expectations updated in both test files:

- Trailing slash: `expect(getSpecFilename('specs/project-1/')).toBe('spec.md')`
- Empty input: `expect(getSpecFilename('')).toBe('spec.md')`

---

## Why `||` Is Correct Here

The intent of the fallback is: "if there is no meaningful filename segment,
display `'spec.md'`." An empty string is not a meaningful filename — it is the
absence of one. Logical OR (`||`) treats all falsy values (`''`, `0`, `false`,
`null`, `undefined`, `NaN`) as "use the fallback." For this function, the only
falsy value `pop()` can return is `''`, so `||` is semantically correct and
safe.

Normal paths like `'specs/proj/my-spec.md'` produce a truthy string from
`pop()`, so `||` preserves them unchanged.

---

## Beginner Mental Model: `??` vs `||`

Both operators provide a fallback when the left side is "missing," but they
disagree on what "missing" means:

```ts
const a = ''        ?? 'fallback'  // → ''        (empty string is NOT nullish)
const b = ''        || 'fallback'  // → 'fallback' (empty string IS falsy)

const c = null      ?? 'fallback'  // → 'fallback'
const c2 = null     || 'fallback'  // → 'fallback'

const d = undefined ?? 'fallback'  // → 'fallback'
const d2 = undefined|| 'fallback'  // → 'fallback'

const e = 0         ?? 'fallback'  // → 0         (zero is NOT nullish)
const f = 0         || 'fallback'  // → 'fallback' (zero IS falsy)
```

**Rule of thumb:**

- Use `??` when you want to preserve intentional falsy values like `0` or `''`
  and only substitute for `null`/`undefined`.
- Use `||` when any falsy value means "use the default" — common for strings
  where `''` should trigger a fallback display name.

In `getSpecFilename`, an empty filename segment is never intentional — it means
"no filename was found" — so `||` is the right choice.

---

## Topics to Explore With an AI for Deeper Understanding

1. **"When should I use `??` vs `||` vs `??=` in TypeScript?"**
   — Concrete decision tree with string, number, and object examples.

2. **"What does `Array.prototype.pop()` return on an empty array, and why does
   `split('/').pop()` return `''` for trailing slashes?"**
   — Walk through `'foo/'.split('/')` step by step.

3. **"What is a dead code path and how do tests that document buggy behavior
   become misleading?"**
   — Why the original tests asserted `''` and how that masked the bug.

4. **"How do you test module-private helpers without exporting them?"**
   — The mirror-and-test pattern used in this project's test files.

5. **"What is falsy vs nullish in JavaScript, and why did ES2020 add `??`
   separately from `||`?"**
   — Historical context and the `0` / `''` preservation problem.

---

## Validation

```
npx vitest run __tests__/components/editor/ai-sidebar-utils.test.ts __tests__/helpers/spec-helpers.test.ts
```

- All 53 tests pass (36 in ai-sidebar-utils, 17 in spec-helpers)
- IDE linter — no errors on changed files

---

## Files Changed

| File | Change |
|------|--------|
| `components/editor/ai-sidebar.tsx` | `??` → `\|\|` in `getSpecFilename` |
| `__tests__/components/editor/ai-sidebar-utils.test.ts` | Pulled from remote branch; fixed helper + 2 test expectations; added sessionStorage mock for node env |
| `__tests__/helpers/spec-helpers.test.ts` | Fixed mirrored helper + trailing-slash test expectation |
| `docs/fixes/fix-getspecfilename-nullish-coalescing-fallback.md` | This document |
| `docs/plans/fix-getspecfilename-nullish-coalescing-fallback-plan.md` | Implementation plan |
