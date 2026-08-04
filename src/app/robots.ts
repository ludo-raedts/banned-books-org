import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/canonical-host'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block the Next.js image-optimisation endpoint. Crawlers should fetch
        // the original cover URL (stored as books.cover_url), not the proxied
        // /_next/image variant — both because the proxy is expensive and
        // because the proxied URL would change shape across deploys.
        disallow: '/_next/image/',
      },
      {
        // Policy: AI may READ + CITE the catalogue, but not ingest it to TRAIN
        // language models. These are the training / bulk-ingest crawlers, told
        // politely to stay out. Enforcement for those that ignore robots lives
        // in the Cloudflare WAF (custom firewall, "Block scrapers + AI training
        // crawlers"). Search / citation agents — OAI-SearchBot, ChatGPT-User,
        // Claude-User, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot,
        // Applebot — are deliberately NOT listed here and remain fully allowed.
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'anthropic-ai',
          'CCBot',
          'Google-Extended',
          'meta-externalagent',
          'Applebot-Extended',
          'Bytespider',
          'Amazonbot',
          'Omgilibot',
          'Diffbot',
        ],
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
