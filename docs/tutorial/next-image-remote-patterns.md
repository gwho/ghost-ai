# Tutorial: Next.js Image Remote Patterns

## What You'll Learn

- Why Next.js blocks external images by default
- How to configure `remotePatterns` correctly
- Wildcard patterns for subdomains and paths
- Common external image sources and their patterns

---

## Part 1: Why Next.js Blocks External Images

Next.js's `<Image>` component doesn't load external images directly from the
browser. Instead, it routes them through its own image optimization server at
`/_next/image?url=<encoded-url>`. This server fetches the source image, resizes it,
converts it to a modern format (WebP/AVIF), and caches the result.

If any URL were allowed, anyone could use your server as a free image proxy — or
worse, trick your server into fetching internal resources (SSRF attack). The
`remotePatterns` allowlist prevents this.

---

## Part 2: The `remotePatterns` Config

Add it to `next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
}

export default nextConfig
```

Each entry in `remotePatterns` can have four fields:

| Field | Required | Description |
|---|---|---|
| `protocol` | yes | `'https'` or `'http'` |
| `hostname` | yes | Domain name (exact or wildcard) |
| `port` | no | Port number string, e.g. `'3000'` |
| `pathname` | no | Path prefix, supports `*` and `**` wildcards |

Omitting `port` allows any port. Omitting `pathname` allows any path.

---

## Part 3: Wildcard Patterns

**Exact hostname** — only `img.clerk.com`:
```ts
{ protocol: 'https', hostname: 'img.clerk.com' }
```

**Single-level subdomain wildcard** (`*`) — matches `res.cloudinary.com` but NOT
`a.b.cloudinary.com`:
```ts
{ protocol: 'https', hostname: '*.cloudinary.com' }
```

**Multi-level subdomain wildcard** (`**`) — matches any depth:
```ts
{ protocol: 'https', hostname: '**.cloudinary.com' }
// matches: res.cloudinary.com, a.res.cloudinary.com, etc.
```

**Path restriction** — only allow images under `/public/`:
```ts
{
  protocol: 'https',
  hostname: 'cdn.example.com',
  pathname: '/public/**',
}
```

---

## Part 4: Common External Image Sources

| Service | Pattern |
|---|---|
| Clerk avatars | `{ protocol: 'https', hostname: 'img.clerk.com' }` |
| Gravatar | `{ protocol: 'https', hostname: 'www.gravatar.com' }` |
| Google user content | `{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }` |
| GitHub avatars | `{ protocol: 'https', hostname: 'avatars.githubusercontent.com' }` |
| Cloudinary | `{ protocol: 'https', hostname: '**.cloudinary.com' }` |
| S3 (fixed bucket) | `{ protocol: 'https', hostname: 'mybucket.s3.amazonaws.com' }` |
| S3 (any bucket) | `{ protocol: 'https', hostname: '**.amazonaws.com' }` |
| Vercel Blob | `{ protocol: 'https', hostname: '**.blob.vercel-storage.com' }` |

---

## Part 5: The Deprecated `domains` Array

Older Next.js projects use:
```ts
images: {
  domains: ['img.clerk.com'],  // ← deprecated
}
```

This was replaced by `remotePatterns` because `domains` only matched on hostname —
no protocol, port, or path control. `remotePatterns` is more secure and more
flexible. Use `remotePatterns` for all new projects.

---

## Part 6: What Happens Without the Config

If you use `<Image src="https://img.clerk.com/...">` without the remotePatterns
entry, Next.js throws at runtime:

```
Error: Invalid src prop on `next/image`, hostname "img.clerk.com" is not
configured under images in your `next.config.js`
```

The image renders as a broken image in the browser. No network request is ever made
to the external host — the error is caught server-side.

---

## Summary

1. Any external hostname used in `<Image src="...">` must be in `remotePatterns`
2. Use exact hostnames for known services, wildcards only when needed
3. Omit `pathname` unless you need to restrict which paths are allowed
4. `remotePatterns` replaced the deprecated `domains` array — use `remotePatterns`
