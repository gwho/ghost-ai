---
title: Fix — "fatal: not a git repository"
date: 2026-06-02
---

## What broke

Running any git command from the project root (`/Users/jessejames/Desktop/ghost-ai`) produced:

```
fatal: not a git repository (or any of the parent directories): .git
```

The IDE (Claude Code) surfaced this as a temporary error file.

## Why it happened

The project has two folder levels:

```
/Users/jessejames/Desktop/ghost-ai/       ← outer folder (no .git)
└── my-app-ghost/                         ← real Next.js app + git repo (.git lives here)
```

Claude Code's working directory is set to the **outer folder** (`ghost-ai/`). Git searches for a `.git` directory starting at the current folder and walking up through all parent directories. Because neither `ghost-ai/` nor any of its ancestors contain a `.git`, git gives up and throws the "not a git repository" error.

The real `.git` directory lives one level down at `my-app-ghost/.git`. Git never finds it because it only searches *up* (toward the root), not *down* into subdirectories.

## The wrong fix (what not to do)

Running `git init` at the outer `ghost-ai/` level creates a new empty repo that treats `my-app-ghost/` as an **embedded repository** (a git-within-a-git). This causes:

- The inner repo's history and branches to become invisible to the outer repo
- Git warnings about "embedded repository" on every `git add`
- Confusion about which `.git` is authoritative

This was tried and immediately undone.

## The correct fix

Git commands must be run from inside `my-app-ghost/`:

```bash
# Option 1 — change into the app directory first
cd my-app-ghost
git status

# Option 2 — use the -C flag to target the right directory
git -C my-app-ghost status
git -C my-app-ghost log --oneline -5
```

In Claude Code, this means any tool that shells out to `git` needs to operate from `my-app-ghost/`, not from the workspace root. The outer `ghost-ai/` folder is a container only — it holds config files (`.env`, `.vscode/`, `.claude/`) but is not itself a git repo.

## Reusable lesson

**Git only searches upward for `.git`, never downward.** If your terminal or IDE is in a parent folder above the real `.git`, every git command will fail with "not a git repository". The fix is always to move into the correct directory (or use `git -C <path>`), never to create a new outer repo.

## Topics to explore with AI in a Socratic Q&A session

These questions build naturally on each other — start at the top and let each answer raise the next question.

1. **How does git actually find `.git`?** Walk through exactly what git does when you type `git status` — which directories does it check, in which order, and when does it stop?

2. **What is a git submodule, and when would you intentionally put one repo inside another?** (Compare this to what went wrong here — an *accidental* embedded repo vs. a deliberate submodule.)

3. **What does `git init` actually create?** Look inside `.git/` — what is each file and folder (`HEAD`, `refs/`, `objects/`, `config`)? What does git store before your first commit?

4. **What is a working tree vs. an index vs. a commit?** When you run `git add`, where does the file actually go? What does `git commit` do with it from there?

5. **How do git branches work internally?** A branch is just a text file with 40 characters in it — what does that mean, and how does `git checkout` use it?
