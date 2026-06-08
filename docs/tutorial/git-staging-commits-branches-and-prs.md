# Git Tutorial: Staging, Commits, Branches, and Pull Requests

This note explains the Git concepts behind "commit only the review fixes" and
"leave the debug `useEffect` unstaged".

## The Mental Model

Git has three main places to think about:

1. **Working tree**: the files on disk right now.
2. **Staging area / index**: the exact snapshot that will go into the next commit.
3. **Repository history**: the commits that already exist.

When a file is modified, that change starts in the working tree. It is not part
of the next commit until it is staged.

```text
working tree -> git add -> staging area -> git commit -> history
```

This means Git can commit some changes while leaving other changes on disk.

## What "Unstaged" Means

An unstaged change is a change that exists in your working tree but is not in the
staging area.

For example, if `workspace-shell.tsx` has three edits:

- manual save error handling
- `aria-haspopup="dialog"` on dialog buttons
- a local debug `useEffect`

we can stage the first two and leave the debug `useEffect` unstaged. The commit
will include only the staged edits. The debug code stays in the file locally, but
it is not part of the commit.

That is what I meant by "leave unstaged the debug `useEffect` before committing".

## Why This Matters

Clean commits make review and rollback easier.

A good commit should contain one coherent unit of intent. In this case, the
intent is "review fixes". Local diagnostic instrumentation is a different intent.
Mixing it into the same commit would make the pull request noisier and could
accidentally ship local-only behavior.

## Common Commands

Check what changed:

```sh
git status --short --branch
```

Show unstaged changes:

```sh
git diff
```

Show staged changes:

```sh
git diff --cached
```

Stage a whole file:

```sh
git add path/to/file.ts
```

Stage only selected hunks from a file:

```sh
git add -p path/to/file.ts
```

Commit staged changes:

```sh
git commit -m "fix: harden review findings"
```

Push the current branch:

```sh
git push origin HEAD
```

## Partial Staging

Partial staging is how you commit only part of a file.

`git add -p` shows one hunk at a time and asks what to do with it:

```text
Stage this hunk [y,n,q,a,d,s,e,?]?
```

Common answers:

- `y`: stage this hunk
- `n`: do not stage this hunk
- `s`: split this hunk into smaller hunks
- `e`: manually edit the patch before staging
- `q`: quit

For the current situation, the intended outcome is:

- stage the `handleManualSave` hunk
- do not stage the debug `useEffect` hunk
- stage the `aria-haspopup` hunk

If hunks are too close together for `git add -p` to split cleanly, you can create
a small patch and apply it only to the staging area:

```sh
git apply --cached review-fixes.patch
```

That changes the index without changing the working tree.

## Branches

A branch is a movable name pointing at a commit. Feature and fix work usually
happens on a branch so it can be reviewed before merging.

Check the current branch:

```sh
git branch --show-current
```

Create and switch to a new branch:

```sh
git checkout -b fix/my-change
```

Push a branch and set upstream tracking:

```sh
git push -u origin fix/my-change
```

## Pull Requests

A pull request asks to merge one branch into another branch on GitHub.

Typical flow:

```text
local branch -> commit -> push to origin -> open/update PR
```

If a branch already has an open PR, pushing new commits to that branch updates
the PR automatically.

## Safe Commit Checklist

Before committing:

1. Run `git status --short --branch`.
2. Run `git diff` and identify unrelated changes.
3. Stage only the intended files or hunks.
4. Run `git diff --cached` to inspect exactly what will be committed.
5. Run relevant validation commands.
6. Commit with a message describing the staged changes.
7. Push the branch.

## Practical Rule

Use the staging area as a filter.

The working tree can contain experiments, debug helpers, and unfinished ideas.
The staging area should contain only what you are ready to put into the next
commit.
