export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderUrlset,
  type SitemapEntry,
} from '@/lib/sitemap-xml'

export async function GET() {
  const supabase = adminClient()

  let authors: { slug: string | null }[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('authors')
      .select('slug')
      .not('slug', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    authors = authors.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }

  const entries: SitemapEntry[] = authors
    .filter((a): a is { slug: string } => Boolean(a.slug))
    .map((a) => ({
      loc: `${SITEMAP_BASE_URL}/authors/${a.slug}`,
      changefreq: 'monthly',
      priority: 0.6,
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
