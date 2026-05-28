# Fix: pg SSL Mode Warning

## What broke (and what didn't)

At startup, the terminal printed:

```
Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
are treated as aliases for 'verify-full'. In the next major version
(pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard
libpq semantics, which have weaker security guarantees.
```

The app still **worked** — connections succeeded, queries ran. But the library
was warning that a future version would silently downgrade TLS security unless
we were explicit.

## Why it happened

`DATABASE_URL` ends with `?sslmode=require`. When `@prisma/adapter-pg` creates
a connection pool it passes this string to the `pg` library, which parses the
`sslmode` value. In the current `pg` version, `require` is secretly treated as
`verify-full` (fully verified TLS). Starting with pg v9, `require` will switch
to the libpq definition — which allows connections even if the server certificate
can't be verified. That's a weaker guarantee, so the library warns now.

## The fix

In `lib/prisma.ts`, before the URL reaches the adapter, a regex replaces any of
the three deprecated modes (`prefer`, `require`, `verify-ca`) with `verify-full`:

```ts
const normalizedUrl = url.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
  '$1sslmode=verify-full$3',
)
const adapter = new PrismaPg({ connectionString: normalizedUrl })
```

This runs at startup, silences the warning, and makes the SSL intent explicit in
code rather than relying on a historical quirk of the library.

The `prisma+postgres://` (Accelerate) branch is unchanged — Prisma Accelerate
manages its own TLS internally and never goes through `pg`'s SSL mode parsing.

## Why `verify-full` and not `uselibpqcompat=true&sslmode=require`?

The warning offered two escape hatches:

| Option | What it means |
|---|---|
| `sslmode=verify-full` | Keep the current behavior: verify the server's certificate AND its hostname. Most secure. |
| `uselibpqcompat=true&sslmode=require` | Adopt libpq semantics now: only check that the channel is encrypted, not that the certificate is valid. |

We connect to a managed cloud Postgres host (Prisma Postgres). We want full
certificate verification so we can be certain we're talking to the right server.
`verify-full` is the correct and most secure choice.

## Beginner model — what do SSL modes actually mean?

When two computers talk over the network, anyone on the same network can listen
in (a "man-in-the-middle" attack). TLS (the `S` in HTTPS) solves this by
encrypting the traffic. But encryption alone isn't enough — you also need to
know you're talking to the *right* server, not an impostor.

SSL modes in `pg` control how much checking happens:

| Mode | Encrypted? | Certificate checked? | Hostname checked? |
|---|---|---|---|
| `disable` | No | No | No |
| `allow` / `prefer` | Maybe | No | No |
| `require` (libpq) | Yes | No | No |
| `verify-ca` | Yes | Yes | No |
| `verify-full` | Yes | Yes | Yes |

`verify-full` is the gold standard: the channel is encrypted, the server's
certificate is signed by a trusted authority, and the hostname in the certificate
matches the host you actually connected to. That's what we want for a production
database.

Before this fix, `sslmode=require` gave us `verify-full` behavior only because
of a private convention inside the `pg` library. The fix makes it explicit so
the app's security posture doesn't silently change when `pg` upgrades.
