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

  let books: { slug: string; created_at: string | null }[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select('slug, created_at')
      .not('slug', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    books = books.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }

  const entries: SitemapEntry[] = books.map((book) => ({
    loc: `${SITEMAP_BASE_URL}/books/${book.slug}`,
    lastmod: book.created_at,
    changefreq: 'monthly',
    priority: 0.9,
  }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
