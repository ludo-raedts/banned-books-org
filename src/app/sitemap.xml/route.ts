export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderSitemapIndex,
} from '@/lib/sitemap-xml'

// Most-recent updated_at for a table whose rows carry the set_updated_at
// trigger (migration 20260515143605). This is the strictly-cheaper limit-1
// twin of the full `.order('updated_at')` scan the child sitemaps already run.
// Returns null on error / empty so the child entry omits <lastmod> rather than
// carrying a fabricated one.
async function latestUpdatedAt(table: 'books' | 'authors'): Promise<string | null> {
  const { data } = await adminClient()
    .from(table)
    .select('updated_at')
    .not('updated_at', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.updated_at as string | undefined) ?? null
}

// Latest of several timestamps (compared as dates, not lexically). Null-safe.
function newest(...values: (string | null)[]): string | null {
  let best: string | null = null
  let bestT = -Infinity
  for (const v of values) {
    if (!v) continue
    const t = new Date(v).getTime()
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t
      best = v
    }
  }
  return best
}

export async function GET() {
  // Real per-child <lastmod> instead of `now`: a child only claims to have
  // changed when its underlying data actually changed, so Google can trust the
  // signal and re-crawl on genuine freshness rather than on every fetch (which
  // a request-time `now` trains it to ignore — costly when crawl budget is
  // already tight). Books and authors expose updated_at directly; the
  // country/reason landing pages and the DB-driven static pages (news,
  // top-100, leaderboards, …) are dominated by book/author data, so they reuse
  // those maxima as an honest freshness proxy.
  const [booksMod, authorsMod] = await Promise.all([
    latestUpdatedAt('books'),
    latestUpdatedAt('authors'),
  ])
  const staticMod = newest(booksMod, authorsMod)

  const xml = renderSitemapIndex([
    { loc: `${SITEMAP_BASE_URL}/sitemap-static.xml`, lastmod: staticMod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-books.xml`, lastmod: booksMod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-authors.xml`, lastmod: authorsMod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-countries.xml`, lastmod: booksMod },
    { loc: `${SITEMAP_BASE_URL}/sitemap-reasons.xml`, lastmod: booksMod },
  ])

  return new Response(xml, { headers: SITEMAP_RESPONSE_HEADERS })
}
