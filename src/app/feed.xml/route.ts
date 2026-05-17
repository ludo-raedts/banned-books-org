export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'

const BASE = 'https://www.banned-books.org'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const { data: items } = await adminClient()
    .from('news_items')
    .select('id, title, headline, source_url, source_name, published_at, summary')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  const rssItems = (items ?? []).map((item) => {
    const pubDate = item.published_at
      ? new Date(item.published_at).toUTCString()
      : ''
    const link = item.source_url ?? `${BASE}/news`
    const guid = `${BASE}/news#item-${item.id}`
    // RSS readers display <title> prominently — use the punchy generated
    // headline when present, fall back to the source title for legacy rows
    // that haven't been backfilled yet.
    const rssTitle = item.headline?.trim() || item.title || ''
    return `
    <item>
      <title>${escapeXml(rssTitle)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <description>${escapeXml(item.summary ?? '')}</description>
      <source url="${escapeXml(`${BASE}/news`)}">${escapeXml('Banned Books News')}</source>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Banned Books — Latest Censorship News</title>
    <link>${BASE}</link>
    <description>The latest news on book bans and censorship worldwide.</description>
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
