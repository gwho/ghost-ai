# Build Issues Log — Feature 05: Prisma Schema and Data Layer

Every problem that came up during implementation, explained from scratch.  
If a concept is unfamiliar, follow the linked resources before reading the fix.

---

## Issue 1 — The feature spec file appeared to be empty

### What happened
When I tried to read `context/feature-specs/05-prisma.md` using the file-reading tool, it reported the file had "1 line" and showed no content. But the file was 1,249 bytes — not empty at all.

### Why it happened
The file opened fine when read using the terminal command `cat`. The automated file-reading tool had a display bug for this particular file. The content was always there.

### The fix
Read the file using `cat` in a terminal instead:
```bash
cat context/feature-specs/05-prisma.md
```

### Lesson
**Tools can have bugs.** When a tool gives you a suspicious result (a 1,249-byte file with "1 line"), try a different tool to verify. `cat` is the ground truth for file contents.

---

## Issue 2 — Prisma 7 removed `url` from `datasource` in schema files

### What happened
I wrote a standard `schema.prisma` like this:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   ← THIS LINE
}
```

Running `npx prisma migrate dev` gave this error:
```
error: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts`
```

### Why it happened
Prisma 7 is a major version with **breaking changes**. In all previous versions (1–6), the database URL lived in `schema.prisma`. In Prisma 7, they moved it to a separate config file (`prisma.config.ts`) to better separate *what your data looks like* from *how to connect to it*.

Think of it like separating a blueprint from a map to the construction site. The blueprint (`schema.prisma`) describes the building. The site address (`prisma.config.ts`) describes where to build it.

### The fix
Remove `url` from `schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  // no url here anymore
}
```

Add it to `prisma.config.ts`:
```ts
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma'),
  datasource: {
    url: env('DATABASE_URL'),   ← moved here
  },
})
```

### Lesson
**Always check the major version when reading documentation or tutorials.** A Prisma 5 tutorial and a Prisma 7 project have incompatible rules. The same applies to any library that ships major version bumps (Next.js, React, etc.).

### Resources
- [Prisma 7 migration guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Semantic versioning explained](https://semver.org/) — what "major version" means and why breaking changes happen

---

## Issue 3 — Prisma CLI couldn't read `DATABASE_URL` from `.env.local`

### What happened
After fixing the schema, `npx prisma migrate dev` still failed:
```
PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.
```

`DATABASE_URL` was set in `.env.local`. Prisma couldn't find it.

### Why it happened
`.env.local` and `.env` are two different files with different purposes in Next.js:

| File | Who reads it | What it's for |
|---|---|---|
| `.env` | Many tools (Prisma CLI, dotenv, etc.) | Shared, usually committed to git |
| `.env.local` | Next.js dev server only | Secrets, never committed to git |

The Prisma CLI is a standalone command-line tool. It automatically loads `.env` but has no built-in knowledge of Next.js's `.env.local` convention. From Prisma's perspective, `.env.local` doesn't exist.

### The fix
At the top of `prisma.config.ts`, explicitly tell it to load `.env.local` using the `dotenv` package:

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })   // load .env.local BEFORE calling env()

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),    // now it can find it
  },
})
```

`dotenv` is a tiny library that reads a `.env`-style file and copies its contents into `process.env`, which is the global environment variable store in Node.js. Calling `config()` before `env('DATABASE_URL')` ensures the variable is available when Prisma looks for it.

### Lesson
**Each tool has its own rules about which env files it reads.** Next.js is opinionated about `.env.local`. Most other tools only know about `.env`. When a CLI tool can't find an env variable that Next.js uses fine, this is almost always why.

### Resources
- [Next.js environment variable docs](https://nextjs.org/docs/app/guides/environment-variables) — explains .env, .env.local, .env.production, etc.
- [dotenv npm package](https://www.npmjs.com/package/dotenv)
- [What is `process.env`?](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs) — Node.js official guide

---

## Issue 4 — TypeScript couldn't find `PrismaClient` even after a successful generate

### What happened
`prisma generate` ran successfully and said:
```
✔ Generated Prisma Client (v7.8.0) to ./node_modules/@prisma/client
```

But `npm run build` failed with:
```
Type error: Module '"@prisma/client"' has no exported member 'PrismaClient'.
```

The code ran fine in Node.js. TypeScript alone couldn't find the type.

### Why it happened — in detail

This one is the most complex issue. It requires understanding three separate things:

#### A. Where Prisma 7 puts the generated types

When you run `prisma generate`, Prisma creates TypeScript type definitions that describe your specific schema (`Project`, `ProjectCollaborator`, etc.). By default in Prisma 7, these go into:
```
node_modules/.prisma/client/
```

Note the dot: it's `node_modules/.prisma/`, not `node_modules/@prisma/`.

#### B. How `@prisma/client` re-exports those types

The `@prisma/client` package (the one you import in your code) is just a thin wrapper. Its `default.d.ts` file contains:
```typescript
export * from '.prisma/client/default'
```

This means: "go find a file at the relative path `.prisma/client/default` and export everything from it."

At **runtime**, Node.js sees `.prisma/client/default` (starts with `.` but NOT `./`) and treats it as a **bare package name** — it looks it up in `node_modules` and finds `node_modules/.prisma/client/default.js`. ✅

At **compile time**, TypeScript with `moduleResolution: "bundler"` sees `.prisma/client/default` (starts with `.`) and treats it as a **relative file path** — it looks for `node_modules/@prisma/client/.prisma/client/default.d.ts`. That path doesn't exist. ❌

#### C. The moduleResolution difference

This is the root cause. Node.js CJS (CommonJS) and TypeScript's `bundler` mode use different rules to decide what kind of path something is:

| Path | Node.js CJS | TypeScript bundler |
|---|---|---|
| `./foo` | Relative | Relative |
| `../foo` | Relative | Relative |
| `foo` | Package (node_modules) | Package |
| `.prisma/foo` | **Package** (bare specifier) | **Relative** path |

`.prisma/foo` — starts with `.` but not `./` — is the edge case. Node.js says "that's a package name" and looks in node_modules. TypeScript says "that starts with a dot, must be a relative file path."

This mismatch means the code works at runtime but TypeScript can't verify the types.

### The fix

Tell Prisma to generate the client into a project-owned directory instead of the default `node_modules/.prisma/` location. TypeScript can always find files inside your project:

In `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../lib/generated/prisma"   ← explicit output path
}
```

Then import from that path instead of `@prisma/client`:
```ts
// lib/prisma.ts
import { PrismaClient } from '@/lib/generated/prisma'   ← explicit import
```

After running `prisma generate` again, TypeScript can find the types at `lib/generated/prisma/index.d.ts` — a normal project file.

### Lesson
**"It works at runtime" and "TypeScript is happy" are two different things.** TypeScript has its own module resolution rules, and they don't always match Node.js. When you see a "no exported member" error after a successful generate, the module resolution path is the first thing to investigate.

**The `.prisma/foo` vs `./prisma/foo` distinction matters.** A single missing `/` completely changes how both tools interpret the path.

### Resources
- [TypeScript module resolution docs](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution) — explains all resolution modes
- [Node.js module resolution](https://nodejs.org/api/modules.html#all-together) — CJS resolution algorithm
- [What is `moduleResolution: "bundler"`?](https://www.typescriptlang.org/tsconfig/#moduleResolution) — TypeScript reference
- [Prisma custom output path](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client#using-a-custom-output-path)

---

## Issue 5 — Prisma 7 changed the API for driver adapters and Accelerate

### What happened
The Prisma 5/6 code for using a driver adapter looked like this:
```ts
const pool = new pg.Pool({ connectionString: url })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

And Accelerate looked like this:
```ts
import { withAccelerate } from '@prisma/extension-accelerate'
const prisma = new PrismaClient().$extends(withAccelerate())
```

Neither of these APIs exists in Prisma 7.

### Why it happened
Prisma 7 simplified both APIs:

**Driver adapters** — `PrismaPg` now takes a config object with the connection string directly, instead of a pre-created `pg.Pool`:
```ts
// Prisma 7
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })
```

**Accelerate** — Instead of using an extension (`.`$extends`), Prisma 7 added `accelerateUrl` directly to the `PrismaClient` constructor options:
```ts
// Prisma 7
const prisma = new PrismaClient({ accelerateUrl: url })
```

Prisma 7 also enforces that every `PrismaClient` must use EITHER `adapter` OR `accelerateUrl`. You can't create one with neither. This is a TypeScript-enforced requirement — the types are defined as a union that requires one of the two.

### The fix
```ts
function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? ''

  if (url.startsWith('prisma+postgres://')) {
    return new PrismaClient({ accelerateUrl: url })    // Accelerate path
  }

  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })                 // Direct Postgres path
}
```

### Lesson
**When upgrading a major version, don't assume the API is the same.** A Google search for "prisma singleton typescript" will return dozens of articles using the old `$extends(withAccelerate())` pattern. Always check whether the article matches your installed version.

**TypeScript-enforced APIs (union types that require one of two options) are the library's way of telling you the rules.** When you see "Type X is not assignable to Y", read the type definition — it's documentation.

### Resources
- [Prisma driver adapters docs](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [Prisma Accelerate docs](https://www.prisma.io/docs/accelerate)
- [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — the pattern Prisma uses to enforce adapter OR accelerateUrl

---

## Issue 6 — Multi-file Prisma schemas and IDE false positives

### What happened
After setting up the multi-file schema (`prisma/schema.prisma` + `prisma/models/project.prisma`), the IDE showed red squiggles in `schema.prisma`:
```
The source "db" cannot be defined because a source with that name already exists.
The generator "client" cannot be defined because a generator with that name already exists.
```

### Why it happened
The Prisma VS Code extension was checking each `.prisma` file **independently**, as if each file had to be a complete standalone schema. Since `schema.prisma` has `datasource db` and the extension was also scanning `models/project.prisma`, it thought there were two definitions of `db` — one in each file.

In reality, Prisma merges all `.prisma` files in the folder before validating. The CLI knew this and worked correctly. The IDE extension didn't (at the time of writing).

### The fix
Nothing to fix in the code — this is an IDE display issue. The migration ran successfully, which is the actual proof that the schema is valid. The squiggles can be ignored.

To confirm the schema is valid without running a migration:
```bash
npx prisma validate
```

### Lesson
**IDE errors and actual compiler/tool errors are different things.** IDE language servers are often slightly behind the tools they represent, especially for features like multi-file schemas that were added recently. `npm run build` passing is more authoritative than IDE squiggles.

### Resources
- [Prisma multi-file schemas](https://www.prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema)
- [Prisma validate command](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#validate)

---

## Summary Table

| # | Error message | Root cause | Fix |
|---|---|---|---|
| 1 | File appeared empty | Tool display bug | Use `cat` directly |
| 2 | `url` not supported in schema | Prisma 7 breaking change | Move URL to `prisma.config.ts` |
| 3 | `Cannot resolve DATABASE_URL` | Prisma CLI ignores `.env.local` | Load `.env.local` via dotenv in config |
| 4 | `no exported member 'PrismaClient'` | TypeScript bundler vs Node.js CJS resolve `.prisma/foo` differently | Set generator `output` to a project directory |
| 5 | Wrong adapter / Accelerate API | Prisma 7 changed both APIs | Use `{ connectionString }` and `{ accelerateUrl }` |
| 6 | IDE schema duplicate errors | VS Code extension validates files independently | Ignore; `prisma validate` is authoritative |

---

## The Bigger Pattern

Almost every issue above came from the same underlying cause: **Prisma 7 is a major version with intentional breaking changes, and most online resources were written for Prisma 5 or 6.**

When you install a package and immediately hit confusing errors that don't match the docs you're reading, check:
1. `npm list prisma` — what version is actually installed?
2. Is there an official migration guide for that major version?
3. Are the blog posts and Stack Overflow answers you found from before or after that version released?

This applies to every rapidly-evolving library: Next.js, React, Prisma, Tailwind, etc.
