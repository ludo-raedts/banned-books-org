import type { Metadata } from 'next'

// Site-wide robots directives (mirrors the root layout). A page that sets
// `robots` replaces the layout's object wholesale, so every variant below
// re-states the snippet caps instead of silently dropping them.
export const DEFAULT_ROBOTS = {
  index: true,
  follow: true,
  'max-snippet': -1,
  'max-image-preview': 'large',
  'max-video-preview': -1,
} as const satisfies NonNullable<Metadata['robots']>

// Google-only noindex (2026-10-25 indexable-core pilot).
//
// Google has dropped the site almost entirely (1 of 108 inspected URLs
// indexed, including /books/1984) while Bing/DuckDuckGo carry ~56% of
// traffic and index the long tail happily. The site-level thin/rich ratio
// is the one lever we control, so pages outside the "core" are hidden from
// Google ONLY: `<meta name="googlebot" content="noindex,follow">` is honoured
// by Google alone; the generic `robots` meta stays index,follow for Bing,
// Yandex, DDG and AI crawlers. Sitemaps follow the same split: the
// robots.txt-advertised sitemap.xml lists the Google core, sitemap-full.xml
// (submitted only in Bing Webmaster Tools) lists everything.
//
// Core rule for books (9,089 of 20,892 at launch): ≥2 recorded bans, OR a
// description AND a cover. Authors: bio present (or organization author) and
// not a placeholder — the pre-existing thin-author rule, now Google-only too.
export const GOOGLE_ONLY_NOINDEX = {
  ...DEFAULT_ROBOTS,
  googleBot: { index: false, follow: true },
} as const satisfies NonNullable<Metadata['robots']>

export function isCoreBook(b: {
  banCount: number
  description: string | null | undefined
  coverUrl: string | null | undefined
}): boolean {
  if (b.banCount >= 2) return true
  const hasDesc = typeof b.description === 'string' && b.description.trim().length > 0
  return hasDesc && !!b.coverUrl
}
