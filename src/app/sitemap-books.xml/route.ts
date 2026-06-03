export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderUrlset,
  type SitemapEntry,
} from '@/lib/sitemap-xml'

type BookRow = {
  slug: string
  title: string | null
  updated_at: string | null
  cover_url: string | null
}

export async function GET() {
  const supabase = adminClient()

  // Pull updated_at (post-migration 20260515143605 — bumped on every UPDATE
  // via the public.set_updated_at trigger). Using updated_at instead of
  // created_at means cover/description enrichment + new-ban additions
  // surface in the next sitemap snapshot, so IndexNow delta re-submits the
  // changed URLs to Bing/Yandex instead of nothing.
  //
  // cover_url + title are pulled per the Image Sitemap extension below: one
  // <image:image> entry per book that has a cover, with the title used as
  // <image:title> for crawler context.
  let books: BookRow[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select('slug, title, updated_at, cover_url')
      .not('slug', 'is', null)
      .eq('is_gated', false)
      .eq('is_blanket_works', false) // pseudo-books for author-level (Liste Otto) bans — never index
      .order('updated_at', { ascending: false })
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    books = books.concat(data as BookRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  const entries: SitemapEntry[] = books.map((book) => ({
    loc: `${SITEMAP_BASE_URL}/books/${book.slug}`,
    lastmod: book.updated_at,
    changefreq: 'monthly',
    priority: 0.9,
    ...(book.cover_url
      ? {
          images: [{
            loc: book.cover_url,
            ...(book.title ? { title: `${book.title} — book cover` } : {}),
          }],
        }
      : {}),
  }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
