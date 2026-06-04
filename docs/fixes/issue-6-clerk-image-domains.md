# Fix: Issue 6 — Collaborator Avatar Image Error

## What Was Broken

Collaborator avatars in the presence panel showed broken images. The browser console
showed errors like:

```
Error: Invalid src prop (https://img.clerk.com/...) on `next/image`,
hostname "img.clerk.com" is not configured under images in your `next.config.js`
```

---

## Root Cause

Next.js's `<Image>` component (and any component built on it) only loads images from
hostnames explicitly listed in `next.config.ts` under `images.remotePatterns`. Any
other hostname is blocked at the framework level, not the network level.

The `next.config.ts` was empty — no `remotePatterns` at all:

```ts
const nextConfig: NextConfig = {
  /* config options here */
}
```

Clerk hosts avatar images at `img.clerk.com`. Since this domain wasn't listed, every
collaborator avatar request was rejected before it left the browser.

---

## The Fix

Add `img.clerk.com` to `remotePatterns` in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },
}
```

`remotePatterns` entries match on `protocol`, `hostname`, and optionally `port` and
`pathname`. Omitting `pathname` allows all paths under that hostname.

---

## The Reusable Lesson

**Every external image domain used in your Next.js app must be listed in
`remotePatterns`. This is a security feature, not a bug.**

Without this restriction, a user could craft an `<Image src="...">` that points to
any server, leaking your Next.js image optimization service as a proxy. Allowlisting
prevents this.

The correct pattern for a domain that serves user-generated content:

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'img.clerk.com' },       // auth avatars
    { protocol: 'https', hostname: 'uploadthing.com' },     // file uploads
    { protocol: 'https', hostname: '**.cloudinary.com' },   // wildcard subdomains
  ],
},
```

Use `**` as a wildcard for subdomain matching (e.g., `res.cloudinary.com`,
`images.cloudinary.com`). Use `*` for a single path segment wildcard.

---

## AI Discussion Topics

**1. Why does Next.js block external images by default?**
The Next.js image component routes requests through its own optimization API
(`/_next/image?url=...`). Without an allowlist, any URL could be proxied through
your server. What attack vectors does this open? Think: bandwidth exhaustion,
SSRF (Server-Side Request Forgery), serving malicious content through your domain.

**2. `remotePatterns` vs the deprecated `domains` array**
Older Next.js docs show `images.domains: ['img.clerk.com']`. This was deprecated in
favor of `remotePatterns` because `domains` matched on hostname only — no protocol,
port, or path control. When would the extra granularity of `remotePatterns` matter
in production?

**3. What happens in production vs development?**
In development, the image optimization server runs locally. In production on Vercel,
it runs on Vercel's edge network. Does your `remotePatterns` config behave the same
in both environments? Are there any cases where an image loads in dev but fails in
prod?

**4. Clerk's image CDN architecture**
Clerk hosts avatars at `img.clerk.com`. These are typically user-uploaded photos
resized and cached at the CDN layer. How does this compare to an alternative where
you store and serve avatars yourself? Consider: security, storage cost, GDPR/data
residency, performance.
