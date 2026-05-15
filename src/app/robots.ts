import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/canonical-host'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Block the Next.js image-optimisation endpoint. Crawlers should fetch
      // the original cover URL (stored as books.cover_url), not the proxied
      // /_next/image variant — both because the proxy is expensive and
      // because the proxied URL would change shape across deploys.
      disallow: '/_next/image/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
