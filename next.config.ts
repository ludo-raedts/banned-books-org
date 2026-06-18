import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/allowed-image-hosts";
import { NFD_REDIRECTS } from "./src/lib/redirects/nfd-bulk";

const nextConfig: NextConfig = {
  experimental: {
    // /books/[slug] now prebuilds the full ~15.8k indexable catalogue at build
    // time (see generateStaticParams there). Across that many renders a single
    // transient Supabase/PostgREST blip shouldn't fail the whole build, so
    // retry a failed page generation before giving up. If a deploy build ever
    // pressures the prod PostgREST pool (it shares the same instance), throttle
    // it with `staticGenerationMaxConcurrency` (default 8 pages/worker).
    staticGenerationRetryCount: 2,
  },
  // Include the generated dataset zip in the dataset download route's bundle.
  // private/ sits outside public/ (intentional — must not be served statically),
  // so Next.js's file tracer needs an explicit hint to package it with the function.
  outputFileTracingIncludes: {
    '/api/dataset/download': ['./private/dataset.zip'],
  },
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTS.map(hostname => ({ protocol: 'https' as const, hostname })),
    deviceSizes: [320, 640, 960],
    imageSizes: [160, 240, 360],
    formats: ['image/webp'],
    minimumCacheTTL: 31536000,
  },
  async redirects() {
    return [
      // /reasons/blasphemy collapsed into /reasons/religious on 2026-05-20
      // (see migration 20260520150000_merge_blasphemy_into_religious). The
      // standalone page no longer exists; preserve any external links.
      {
        source: '/reasons/blasphemy',
        destination: '/reasons/religious',
        permanent: true,
      },
      // D.H. Lawrence was duplicated as two author records (`dh-lawrence` and
      // `d-h-lawrence`, the latter seeded by the KDN-Malaysia import on
      // 2026-06-03). Merged onto the canonical `dh-lawrence`; there is no
      // author-slug-alias mechanism, so preserve the dead URL with a redirect.
      {
        source: '/authors/d-h-lawrence',
        destination: '/authors/dh-lawrence',
        permanent: true,
      },
      // The Loi Gayssot page moved from /laws/ into the unified /contexts/
      // section (censorship events: statutes, decrees, and historical lists),
      // 2026-06-18. Preserve the old indexed URL.
      {
        source: '/laws/loi-gayssot',
        destination: '/contexts/loi-gayssot',
        permanent: true,
      },
      // Canonical host enforcement. Google indexed both banned-books.org
      // (apex) and www.banned-books.org until 2026-05-16 — Search Console
      // shows 360 pages on the apex variant vs 640 on www, with click
      // attribution split across both copies (the top page aztec-inca-maya
      // had 22 clicks on www + 17 on apex = 39 spread across two URLs).
      // A 308 host-level redirect tells Google to consolidate on the www
      // form, which our JSON-LD / canonical / sitemap already use.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'banned-books.org' }],
        destination: 'https://www.banned-books.org/:path*',
        permanent: true,
      },
      ...NFD_REDIRECTS,
    ]
  },
  async headers() {
    return [
      {
        // Baseline security headers on every route. No Content-Security-Policy
        // yet: the app renders inline JSON-LD <script> and relies on Next's
        // framework inline scripts, so a strict CSP needs per-request nonce
        // injection via middleware — tracked separately. X-Frame-Options is the
        // priority here (the /admin panel must not be frameable → clickjacking).
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ]
  },
};

export default nextConfig;
