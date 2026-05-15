import { SITE_URL } from './canonical-host'

// Re-export under the long-standing name used by every sitemap route. The
// host-normalisation logic lives in canonical-host.ts so robots.ts and the
// root layout share the same definition.
export const SITEMAP_BASE_URL = SITE_URL

export const SITEMAP_RESPONSE_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const

export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export type SitemapEntry = {
  loc: string
  lastmod?: Date | string | null
  changefreq?: ChangeFreq
  priority?: number
  /**
   * Optional Google Image Sitemap extension. Each entry maps the page URL
   * (`loc`) to one or more associated images, e.g. a book cover or an
   * author portrait that should be eligible for Google Images results. The
   * urlset xmlns is upgraded automatically when any entry carries images.
   * See https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
   */
  images?: ReadonlyArray<{ loc: string; title?: string; caption?: string }>
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function renderUrlset(entries: SitemapEntry[]): string {
  let anyImages = false
  const urls = entries
    .map((entry) => {
      const lastmod = toIso(entry.lastmod)
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`]
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`)
      if (typeof entry.priority === 'number') {
        parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
      }
      if (entry.images && entry.images.length > 0) {
        anyImages = true
        for (const img of entry.images) {
          const inner = [`      <image:loc>${escapeXml(img.loc)}</image:loc>`]
          if (img.title)   inner.push(`      <image:title>${escapeXml(img.title)}</image:title>`)
          if (img.caption) inner.push(`      <image:caption>${escapeXml(img.caption)}</image:caption>`)
          parts.push(`    <image:image>\n${inner.join('\n')}\n    </image:image>`)
        }
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  // Only declare the image: namespace when at least one entry carries images,
  // so urlsets without images stay byte-identical to the previous format.
  const xmlns = anyImages
    ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${xmlns}>
${urls}
</urlset>`
}

export function renderSitemapIndex(
  sitemaps: { loc: string; lastmod?: Date | string | null }[],
): string {
  const items = sitemaps
    .map((s) => {
      const lastmod = toIso(s.lastmod)
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`]
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`
}
