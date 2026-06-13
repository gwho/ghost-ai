---
name: Fix getSpecFilename fallback
overview: Pull the unit test file from the remote branch, fix the `getSpecFilename` nullish coalescing bug in both production and test code, update test expectations, and write an explanation doc.
status: completed
---

# Fix getSpecFilename Nullish Coalescing Fallback Bug

## Context

The `getSpecFilename` function in [`components/editor/ai-sidebar.tsx`](../components/editor/ai-sidebar.tsx) (line 92-93) uses `??` (nullish coalescing) for its fallback:

```ts
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}
```

`String.prototype.split('/').pop()` **always returns a `string`** — never `null` or `undefined`. When the input is empty (`''`) or ends with a slash (`'foo/'`), `pop()` returns `''` (empty string). Since `??` only triggers on `null`/`undefined` (not on falsy values like `''`), the `'spec.md'` fallback never activates when it should.

The fix: change `??` to `||` so empty strings correctly fall back to `'spec.md'`.

## Git Topology

The actual git repo with `origin` remote (`https://github.com/gwho/ghost-ai.git`) is inside `my-app-ghost/`, currently on branch `feature/spec-ui-integration`. The outer `/Users/jessejames/Desktop/ghost-ai` is a bare git init with no commits or remotes. All git operations (fetch, etc.) must run from `my-app-ghost/`.

## Step 1: Pull Unit Tests from Remote Branch

Fetch the remote branch `coderabbitai/utg/0731be6` from `origin` inside `my-app-ghost/`:

```bash
cd my-app-ghost
git fetch origin coderabbitai/utg/0731be6
git checkout FETCH_HEAD -- __tests__/components/editor/ai-sidebar-utils.test.ts
git reset HEAD -- __tests__/components/editor/ai-sidebar-utils.test.ts
```

## Step 2: Verify Finding and Fix Production Code

In `components/editor/ai-sidebar.tsx`, line 93:

- **Before**: `return filePath.split('/').pop() ?? 'spec.md'`
- **After**: `return filePath.split('/').pop() || 'spec.md'`

## Step 3: Fix All Test Copies and Update Expectations

### 3a. New test file: `__tests__/components/editor/ai-sidebar-utils.test.ts`

1. Change the re-implemented `getSpecFilename` from `??` to `||`
2. Update trailing-slash test: `expect(getSpecFilename('specs/project-1/')).toBe('spec.md')`
3. Update empty-input test: `expect(getSpecFilename('')).toBe('spec.md')`
4. Add in-memory `sessionStorage` mock (vitest runs in node environment)

### 3b. Existing test file: `__tests__/helpers/spec-helpers.test.ts`

1. Line 13: change `??` to `||`
2. Line 30-35: update trailing-slash test expectation from `''` to `'spec.md'`

## Step 4: Validate

```bash
npx vitest run __tests__/components/editor/ai-sidebar-utils.test.ts __tests__/helpers/spec-helpers.test.ts
```

## Step 5: Write Explanation Doc

Created [`docs/fixes/fix-getspecfilename-nullish-coalescing-fallback.md`](../fixes/fix-getspecfilename-nullish-coalescing-fallback.md)

## Completion Summary

| Task | Status |
|------|--------|
| Pull test file from `coderabbitai/utg/0731be6` | Done |
| Fix production `getSpecFilename` (`??` → `\|\|`) | Done |
| Fix both test files | Done |
| Runtime verification via debug logs | Done — confirmed `||` returns `'spec.md'` for edge cases |
| All tests pass | Done — 53/53 |
| Explanation doc + plan saved | Done |
