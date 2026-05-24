export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import { publishedEssays } from '@/lib/essays-data'

const BASE = 'https://www.banned-books.org'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type FeedItem = {
  title: string
  link: string
  guid: string
  description: string
  pubDate: string
  sourceUrl: string
  sourceName: string
  // Set to false for guid=permalink (essay URLs) — RSS readers will dedupe on
  // URL across feeds, which is what we want for the essay subset of /feed.xml.
  guidIsPermalink: boolean
}

export async function GET() {
  const { data: items } = await adminClient()
    .from('news_items')
    .select('id, title, headline, source_url, source_name, published_at, summary')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  const newsItems: FeedItem[] = (items ?? []).map((item) => {
    const link = item.source_url ?? `${BASE}/news`
    // RSS readers display <title> prominently — use the punchy generated
    // headline when present, fall back to the source title for legacy rows
    // that haven't been backfilled yet.
    const rssTitle = item.headline?.trim() || item.title || ''
    return {
      title: rssTitle,
      link,
      guid: `${BASE}/news#item-${item.id}`,
      description: item.summary ?? '',
      pubDate: item.published_at ? new Date(item.published_at).toUTCString() : '',
      sourceUrl: `${BASE}/news`,
      sourceName: 'Banned Books News',
      guidIsPermalink: false,
    }
  })

  // Essays appear as separate items alongside the news. <source> distinguishes
  // them visually in readers that show it (Feedly, NetNewsWire). The dedicated
  // full-text feed lives at /essays/feed.xml.
  const essayItems: FeedItem[] = publishedEssays().map(essay => {
    const url = `${BASE}${essay.href}`
    return {
      title: essay.title,
      link: url,
      guid: url,
      description: essay.dek,
      pubDate: new Date(essay.publishedAt).toUTCString(),
      sourceUrl: `${BASE}/essays`,
      sourceName: 'Banned Books Essays',
      guidIsPermalink: true,
    }
  })

  const merged = [...newsItems, ...essayItems].sort((a, b) => {
    // Empty pubDate (legacy news rows) sorts last so it doesn't poison the
    // top of the feed.
    if (!a.pubDate) return 1
    if (!b.pubDate) return -1
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  })

  const rssItems = merged.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="${item.guidIsPermalink}">${escapeXml(item.guid)}</guid>
      <description>${escapeXml(item.description)}</description>
      <source url="${escapeXml(item.sourceUrl)}">${escapeXml(item.sourceName)}</source>
      ${item.pubDate ? `<pubDate>${item.pubDate}</pubDate>` : ''}
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Banned Books — Latest Censorship News</title>
    <link>${BASE}</link>
    <description>The latest news on book bans and censorship worldwide, plus long-form essays from banned-books.org.</description>
    <language>en-us</language>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
