import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/allowed-image-hosts";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTS.map(hostname => ({ protocol: 'https' as const, hostname })),
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
