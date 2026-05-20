import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/allowed-image-hosts";
import { NFD_REDIRECTS } from "./src/lib/redirects/nfd-bulk";

const nextConfig: NextConfig = {
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
