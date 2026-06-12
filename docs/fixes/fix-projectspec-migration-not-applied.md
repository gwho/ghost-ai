# Fix: ProjectSpec table missing — migration not applied

## What Broke

Every request touching specs failed with:

```
PrismaClientKnownRequestError: The table 'public.ProjectSpec' does not exist in the current database.
  code: 'P2021'
```

This caused:
- `GET /api/projects/[projectId]/specs` → 500 → "Failed to load specs" in the sidebar
- `generate-spec` Trigger.dev task → crash on `prisma.projectSpec.create(...)` → "Spec generation failed" in the sidebar

## Why It Broke

When Feature 28 was built, the `ProjectSpec` Prisma model was written and a migration file was created:

```
prisma/migrations/20260609000000_add_project_spec/migration.sql
```

The migration file exists on disk — it contains the correct SQL to create the `ProjectSpec` table. But the SQL was **never sent to the database**. A migration file is just a text file until `prisma migrate deploy` (or `prisma migrate dev`) actually executes it against a live database connection.

The progress tracker noted "Migration applied," which was optimistic. The cloud Prisma Postgres database had not received this migration.

## The Fix

Run this command once in the project root:

```bash
npx prisma migrate deploy
```

Output confirming it worked:
```
Applying migration `20260609000000_add_project_spec`
All migrations have been successfully applied.
```

This command finds all migration files in `prisma/migrations/` that have not yet been applied to the database and executes their SQL. It is safe to run repeatedly — it skips migrations that are already applied.

No code changes were needed. This was purely a database state issue.

## Beginner Model: Migrations vs Schema Files

Think of it like this:

| Concept | Analogy |
|---|---|
| `prisma/models/project-spec.prisma` | A blueprint for a room you want to build |
| `prisma/migrations/*.sql` | The written instructions for the construction crew |
| Running `prisma migrate deploy` | Actually handing those instructions to the crew |

The blueprint tells Prisma what the database *should* look like. The migration file records *what SQL to run* to get there. But until someone runs `migrate deploy`, the database hasn't changed — it still has its old structure.

This is why Prisma separates "writing a migration" from "applying a migration." In a team with multiple developers, one person writes the migration (usually via `prisma migrate dev` on their machine) and commits the SQL file. Everyone else then runs `prisma migrate deploy` to bring their own database up to date.

## What `prisma migrate deploy` vs `prisma migrate dev` Do

| Command | When to use | What it does |
|---|---|---|
| `prisma migrate dev` | Local development | Detects schema changes, creates a new migration file, applies it |
| `prisma migrate deploy` | Applying existing migrations | Runs any pending `.sql` files without creating new ones |
| `prisma db push` | Prototyping (no migration files) | Syncs schema directly, skips migration history |

For applying known migrations to a shared or cloud database, `migrate deploy` is the right choice.

## AI Discussion Topics

1. **Why does Prisma separate creating a migration file from applying it?** What benefits does this give a team of developers working on the same codebase?

2. **What is a migration history table?** How does Prisma know which migrations have already been applied and which are still pending?

3. **What would happen if you ran `prisma migrate deploy` twice on the same database?** Is it safe? Would it apply the migration again?

4. **When should you use `prisma db push` instead of `prisma migrate dev`?** What does `db push` sacrifice compared to the full migration workflow?

5. **The progress tracker said "Migration applied" but it wasn't.** How could you reliably verify that a migration was actually applied to the database, rather than just assuming it was?

6. **What is the difference between Prisma Accelerate (pooled connection) and a direct database connection in this project?** Does `prisma migrate deploy` work with both?
