# Fix: PrismaPg Connection Options

## Finding

`lib/prisma.ts` had a still-valid adapter construction issue:

```ts
const adapter = new PrismaPg(normalizedUrl)
```

The code passed the normalized database URL as a raw string.

## Decision

Use the explicit options object expected by the current `@prisma/adapter-pg`
constructor:

```ts
const adapter = new PrismaPg({ connectionString: normalizedUrl })
```

## What Changed

Only the `PrismaPg` instantiation changed. The `normalizedUrl` calculation and
the `new PrismaClient({ adapter })` call stayed the same.

## Why

The adapter needs to receive connection configuration as named options. Passing
`{ connectionString: normalizedUrl }` makes it clear that the normalized URL is
the database connection string and matches the adapter API shape.

## How To Fix This Bug

1. Keep normalizing `DATABASE_URL` before it reaches the adapter.
2. Pass the normalized value as `connectionString`.
3. Reuse the resulting `adapter` in `new PrismaClient({ adapter })`.

Skipped broader Prisma client or SSL normalization changes because the reported
bug was isolated to the constructor argument shape.
