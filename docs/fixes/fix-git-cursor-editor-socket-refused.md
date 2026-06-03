---
title: Fix — Git Commit Failed Because Cursor's Git Editor Socket Was Refused
date: 2026-06-02
---

# Fix: Git Commit Editor Socket Refused

## What Broke

Git failed during commit with:

```text
Error: connect ECONNREFUSED /var/folders/9w/d1zvf07n34l92sbgrgddn7m40000gn/T/vscode-git-698169bb47.sock
error: there was a problem with the editor '"/Applications/Cursor.app/Contents/Resources/app/extensions/git/dist/git-editor.sh"'
Please supply the message using either -m or -F option.
```

The commit command did not include a message:

```bash
git -c user.useConfigOnly=true commit --quiet
```

When `git commit` has no `-m` or `-F` message, Git opens an editor so the commit
message can be written. In this case, Git tried to use Cursor's temporary Git
editor helper, but that helper connects to a socket that was no longer accepting
connections.

## Why It Happened

Cursor and VS Code provide a special Git editor script:

```text
git-editor.sh
```

That script talks back to the running editor through a temporary IPC socket:

```text
/var/folders/.../vscode-git-...sock
```

Those socket paths are session-specific. If Cursor reloads, crashes, updates,
starts a new extension host, or if a terminal keeps old environment variables
from a previous editor session, Git can still try to call a stale socket. The
socket path exists in the command environment, but nothing is listening there
anymore, so macOS returns:

```text
ECONNREFUSED
```

The repository and staged files are not the problem. The failure happens before
Git can collect the commit message.

## The Fix Applied

Configured a repo-local fallback editor:

```bash
git config --local core.editor nano
```

Verified it with:

```bash
git config --show-origin --get core.editor
git var GIT_EDITOR
```

Expected result:

```text
file:.git/config nano
nano
```

This gives Git a normal terminal editor to use when a commit message is not
provided inline.

## Important Caveat

Environment variables can override `core.editor`.

If the current terminal still has stale Cursor Git editor variables, this local
config may not be enough for that already-open terminal. In that case, use one
of these fixes:

```bash
unset GIT_EDITOR
unset VISUAL
unset EDITOR
unset VSCODE_GIT_IPC_HANDLE
```

Or open a fresh terminal after Cursor has fully restarted.

## Fastest Commit Command

The most reliable way to avoid editor problems is to pass the message directly:

```bash
git commit -m "Describe the change"
```

That bypasses the editor entirely.

For a longer commit message, use a file:

```bash
git commit -F commit-message.txt
```

## Debugging Steps

1. Read the command and noticed it had no `-m` or `-F` message.
2. Read the error path and saw it was Cursor's Git editor helper, not a Git
   repository corruption error.
3. Checked whether the repo had a configured editor:

   ```bash
   git config --show-origin --get-all core.editor
   ```

4. Found no existing repo editor configuration.
5. Added a repo-local fallback editor with `git config --local core.editor nano`.
6. Verified Git now resolves its editor to `nano`.

## Reusable Lesson

`git commit` needs a commit message. If the command does not include `-m` or
`-F`, Git must launch an editor. IDE Git integrations often replace the editor
with a temporary helper script. When that helper's socket goes stale, Git cannot
open the message editor and the commit fails.

Use `git commit -m "..."` when you already know the message. Configure
`core.editor` when you want plain `git commit` to open a predictable editor.

## Files Changed

| File | Change |
| --- | --- |
| `.git/config` | Added repo-local `core.editor = nano` |
| `docs/fixes/fix-git-cursor-editor-socket-refused.md` | Added this debugging and learning note |
