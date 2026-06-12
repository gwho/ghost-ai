# Git Best Practices for Upcoming Work

This guide explains a clean Git workflow for future features and fixes. It is
written for beginners and assumes the main integration branch for this project is
`development`.

## The Core Idea

Use one branch for one piece of work.

Good branch examples:

```text
feature/spec-generation-ui
fix/manual-save-error-state
refactor/project-actions-hooks
```

Avoid reusing an old branch for unrelated work:

```text
fix/review-accessibility-email-fetch
```

That branch name describes old review-fix work. If you later use it for database
optimization or a new feature, the branch name stops matching the work. That
makes the Git history and GitHub pull requests harder to understand.

## Recommended Workflow

### 1. Start from `development`

Before starting new work, switch to `development` and update it:

```sh
git checkout development
git pull origin development
```

Why this matters:

- Your new branch starts from the latest shared code.
- You reduce merge conflicts later.
- Your PR only shows your new work, not old missing commits.

### 2. Create a New Branch

Create a branch with a name that describes the work:

```sh
git checkout -b feature/my-new-feature
```

Use prefixes consistently:

- `feature/` for new user-facing capabilities
- `fix/` for bug fixes
- `refactor/` for structural improvements without behavior changes
- `docs/` for documentation-only work
- `chore/` for maintenance tasks

Examples:

```sh
git checkout -b feature/spec-download
git checkout -b fix/canvas-save-error
git checkout -b docs/git-workflow-guide
```

### 3. Make Small Focused Changes

Try to keep one branch focused on one goal.

Good scope:

```text
Fix manual save error handling.
```

Too broad:

```text
Fix save errors, redesign the sidebar, update auth, and refactor Prisma.
```

Broad branches are harder to review, test, and revert.

### 4. Check What Changed

Before staging anything, inspect the working tree:

```sh
git status --short --branch
git diff
```

`git status` tells you which files changed.

`git diff` shows the exact code changes.

This helps catch accidental edits, generated files, debug code, and unrelated
changes before they enter a commit.

### 5. Stage Only the Intended Changes

Stage whole files when every change in the file belongs in the commit:

```sh
git add components/editor/canvas-flow.tsx
```

If a file contains mixed changes, stage only selected hunks:

```sh
git add -p components/editor/workspace-shell.tsx
```

This is useful when a file contains both:

- real fix code
- temporary debug code

The debug code can stay in your working tree but remain unstaged, so it does not
go into the commit.

### 6. Review the Staged Commit

Before committing, always inspect the staged snapshot:

```sh
git diff --cached
```

This is the most important safety check. It answers:

```text
What exactly will be committed?
```

If something appears in `git diff --cached`, it will go into the commit. If it
only appears in `git diff`, it is still local and unstaged.

### 7. Commit with a Clear Message

Use short, descriptive commit messages:

```sh
git commit -m "fix: handle manual save rejections"
git commit -m "feat: add spec download button"
git commit -m "docs: add git workflow guide"
```

Common prefixes:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code restructuring
- `test:` test additions or fixes
- `chore:` maintenance

Good commit messages describe the result, not the process.

Better:

```text
fix: validate saved canvas payload entries
```

Worse:

```text
changes
```

### 8. Push the Branch

Push the branch to GitHub:

```sh
git push -u origin feature/my-new-feature
```

The `-u` sets the upstream branch, so future pushes can be just:

```sh
git push
```

### 9. Open a Pull Request

Open a PR from your feature branch into `development`:

```text
feature/my-new-feature -> development
```

A good PR description should include:

- what changed
- why it changed
- how it was validated
- anything reviewers should pay attention to

### 10. Keep the Branch Updated

If `development` changes while your PR is open, update your branch:

```sh
git fetch origin
git merge origin/development
```

or, if your team prefers rebasing:

```sh
git fetch origin
git rebase origin/development
```

For beginners, merging is usually easier and safer because it does not rewrite
history.

### 11. After Merge, Clean Up

After the PR is merged into `development`, update local `development`:

```sh
git checkout development
git pull origin development
```

Then delete the local branch:

```sh
git branch -d feature/my-new-feature
```

Use `-d`, not `-D`, by default.

`-d` is safe because Git refuses to delete a branch if it thinks the work is not
merged.

`-D` forces deletion and can lose local-only commits if used carelessly.

## What If You Do Not Delete Old Local Branches?

Nothing immediately breaks.

Local branches live only on your machine. Keeping an old branch does not affect
GitHub or your teammates.

But old branches create risk:

- you may accidentally commit new work to the wrong branch
- the branch may fall behind `development`
- the branch name may no longer match the work
- `git branch` becomes cluttered and harder to read

So deletion is not mandatory, but cleanup is a good habit.

## What If the Remote Branch Was Deleted on GitHub?

If a branch is deleted on GitHub, your local copy is not deleted automatically.

Run:

```sh
git fetch --prune origin
```

This removes stale remote-tracking refs like:

```text
origin/feature/old-branch
```

It does not delete your local branch.

To delete the local branch:

```sh
git branch -d feature/old-branch
```

## Stashing Local Work

Sometimes you have local uncommitted changes but need to switch branches or pull
new code.

Use stash:

```sh
git stash push -u -m "local debug work"
```

This temporarily shelves your uncommitted changes.

Then you can update branches:

```sh
git checkout development
git pull origin development
```

Restore the stashed work later:

```sh
git stash pop
```

Important:

- stash is local only
- stash does not affect GitHub
- stash does not change committed PR history
- `-u` includes untracked files

## Handling Generated Files

Generated files should usually not be committed unless the project expects them.

Examples that are often generated:

```text
.trigger/
dist/
build/
.next/
coverage/
```

Before committing, check:

```sh
git status --short
```

If generated files appear and they are not meant to be committed, leave them
unstaged or add them to `.gitignore` if appropriate.

## Committing Locally Before Pushing

`git commit` is a **local-only** operation. It records a checkpoint in your local repository but does not touch GitHub or your teammates' machines. `git push` is what sends commits to the remote.

This means you can — and should — commit after every meaningful chunk of work:

```sh
git commit -m "feat: add spec listing endpoint"
git commit -m "feat: wire generate spec button"
git commit -m "feat: add spec preview modal"
```

Each commit is a safe restore point. If something breaks later you can inspect or revert to any checkpoint without losing the other steps.

**Never hold off on local commits to "avoid cluttering GitHub."** A commit is not visible on GitHub until you push. Committing freely locally has zero cost and significant benefit:

- `git log` tells a clear story of how the feature was built
- `git diff HEAD~1` shows exactly what one step changed
- `git stash` works cleanly between commits
- Branch switches are safe (no risk of carrying over unstaged changes)

Push only when you are ready to open a PR or share progress for review:

```sh
git push -u origin feature/descriptive-name
```

A good rule of thumb: **commit after each feature or fix, push before review.**

## Safe Daily Workflow

Use this checklist for most new work:

```sh
git checkout development
git pull origin development
git checkout -b feature/descriptive-name

# make changes — commit locally after each coherent unit of work

git status --short --branch
git diff
git add -p
git diff --cached
npm test
git commit -m "feat: descriptive message"

# keep committing locally as you go
# git push only when ready for PR / review
git push -u origin feature/descriptive-name
```

After PR merge:

```sh
git checkout development
git pull origin development
git branch -d feature/descriptive-name
git fetch --prune origin
```

## Building a Feature on Top of an Uncommitted Feature

Sometimes you finish a feature but its PR has not been merged into `development` yet. If the next feature depends on the first one, you should branch from the first feature's branch, not from `development`.

### When this applies

```text
feature/generate-spec     ← feature A: written, PR open, not merged
feature/spec-persistence  ← feature B: depends on A's code
```

If you branch `feature/spec-persistence` from `development`, the spec generation task will not be there. Your changes would be built on top of missing code.

### What to do

Branch from the previous feature branch instead:

```sh
git checkout feature/generate-spec
git checkout -b feature/spec-persistence
```

Now `feature/spec-persistence` has feature A's code as its starting point.

### What happens when feature A merges

After `feature/generate-spec` is merged into `development`, update `feature/spec-persistence`:

```sh
git fetch origin
git merge origin/development
```

Or if your team prefers rebasing:

```sh
git fetch origin
git rebase origin/development
```

This replaces the feature A branch as the base with the canonical `development` history. The diff in your PR will then show only feature B's changes.

### Stacking more features

The pattern extends to multiple unmerged features:

```sh
git checkout feature/generate-spec
git checkout -b feature/spec-persistence

git checkout feature/spec-persistence
git checkout -b feature/spec-ui
```

Each branch builds on the one before it. As each PR merges, rebase the next branch onto `development`.

### Why not commit to `development` directly

Committing directly to `development` skips code review, makes it hard to revert individual features, and pollutes the shared branch with work-in-progress. Separate branches keep each unit of work reviewable and reversible.

### Common mistake with stacked branches

Do not stash uncommitted working-tree files and switch branches. If feature A's files are not yet committed, switching away from the branch drops those files or leaves them as untracked. Always commit feature A before branching feature B from it:

```sh
# On feature/generate-spec: make sure everything is committed
git status          # nothing should be untracked or modified
git checkout -b feature/spec-persistence
```

## Common Mistakes

### Mistake 1: Reusing an Old Branch

Problem:

```sh
git checkout fix/old-review-comments
# then build a new unrelated feature
```

Why it is bad:

- branch name is misleading
- old commits may appear in the PR
- merge conflicts are more likely

Better:

```sh
git checkout development
git pull origin development
git checkout -b feature/new-feature
```

### Mistake 2: Committing Debug Code

Problem:

```ts
fetch('http://127.0.0.1:7407/ingest', ...)
```

Local debug code should usually not be committed.

Better:

```sh
git add -p
git diff --cached
```

Stage only the production-ready changes.

### Mistake 3: Using `git add .` Without Checking

`git add .` stages everything under the current directory. That can accidentally
include generated files, local debug code, or unrelated edits.

Safer:

```sh
git status --short
git add specific/file.ts
```

or:

```sh
git add -p
```

### Mistake 4: Force Deleting Branches

Avoid:

```sh
git branch -D branch-name
```

Prefer:

```sh
git branch -d branch-name
```

Use force delete only when you are certain the branch has no needed local-only
commits.

## AI Discussion Suggestions

Use these questions with an AI assistant before committing or opening a PR:

1. Does this branch contain one coherent unit of work?
2. Are any changed files unrelated to the branch name or PR goal?
3. Does `git diff --cached` include generated files or debug code?
4. Should any changes be split into a separate branch or commit?
5. Is this branch based on the latest `development`?
6. What validation commands should run before committing?
7. After merge, which local and remote branches should be cleaned up?

## Simple Rule to Remember

Start every new task from updated `development`.

Create a new branch with a clear name.

Commit only intentional changes.

Delete the branch after the PR is merged.
