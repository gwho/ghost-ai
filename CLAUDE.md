# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # run ESLint
```

No test runner is configured yet.

## What This Project Is

Ghost AI is a real-time collaborative system design workspace. Users describe a system in plain English, an AI agent generates architecture nodes and edges onto a shared canvas, collaborators refine it, and the app exports a Markdown technical spec.

**Full planned stack** (most not yet installed — check `context/progress-tracker.md` for current state):

| Layer | Technology | Role |
|---|---|---|
| Framework | Next.js 16 + TypeScript | Full-stack, App Router |
| UI | Tailwind v4 + shadcn/ui | Styling and components |
| Auth | Clerk | Identity and route protection |
| Database | Prisma + PostgreSQL | Projects, collaborators, specs, task runs |
| Canvas | Liveblocks + React Flow | Real-time shared canvas, presence, cursors |
| Background tasks | Trigger.dev | Durable AI generation workflows |
| Artifact storage | Vercel Blob | Canvas snapshots and generated specs |

## Architecture

System boundaries (when built out):

- `app/api/` — thin route handlers: validate input, check auth/ownership, trigger tasks, persist metadata
- `trigger/` — durable background jobs for AI design and spec generation (long-running work never runs in request handlers)
- `lib/` — Prisma client, auth helpers, utilities
- `components/` — UI composition only; no business logic; `components/ui/` is shadcn-generated, do not modify
- `prisma/` — schema and generated client

**Storage split**: PostgreSQL holds metadata and blob URL references; Vercel Blob holds the actual canvas snapshots (`canvas/{projectId}.json`) and specs (`specs/{projectId}/{specId}.md`).

**Auth model**: every project has one owner (Clerk user ID) plus optional collaborators. Liveblocks room tokens are issued only after verifying membership. Auth and ownership are enforced at every mutation boundary.

## Key Conventions

- Default to React Server Components; add `"use client"` only for browser interactivity, hooks, or real-time state.
- Use CSS custom property tokens defined in `globals.css` — never raw Tailwind color classes like `zinc-*` or hardcoded hex values. Token utilities: `bg-base`, `bg-surface`, `text-copy-primary`, `border-surface-border`, `text-brand`, etc.
- Border radius scale: `rounded-xl` (inline/small), `rounded-2xl` (cards/panels), `rounded-3xl` (modals).
- Dark only — no light mode.
- Add new shadcn components via the `shadcn` CLI, not by hand.
- Update `context/progress-tracker.md` after each meaningful implementation change. If a change affects architecture, storage model, or standards, update the relevant context file before continuing.

## Context Files

Read these in order before any implementation or architectural decision:

1. `context/project-overview.md` — product definition, goals, features, scope
2. `context/architecture-context.md` — system structure, boundaries, storage model, invariants
3. `context/ui-context.md` — theme, colors, typography, canvas design, component conventions
4. `context/code-standards.md` — implementation rules
5. `context/ai-workflow-rules.md` — scoping rules and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, next steps
