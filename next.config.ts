import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'https', hostname: 'books.google.fr' },
      { protocol: 'https', hostname: 'books.google.nl' },
      { protocol: 'https', hostname: 'books.google.co.uk' },
      { protocol: 'https', hostname: 'books.google.de' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    deviceSizes: [320, 640, 960],
    imageSizes: [160, 240, 360],
    formats: ['image/webp'],
    minimumCacheTTL: 31536000,
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
    ]
  },
};

export default nextConfig;
