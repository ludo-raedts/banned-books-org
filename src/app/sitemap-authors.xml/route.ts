export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderUrlset,
  type SitemapEntry,
} from '@/lib/sitemap-xml'

type AuthorRow = {
  slug: string
  display_name: string | null
  updated_at: string | null
  photo_url: string | null
}

export async function GET() {
  const supabase = adminClient()

  // updated_at lives behind the trigger added in migration 20260515143605
  // and bumps on every author UPDATE (bio fill, photo enrichment, etc.).
  // Author photo emits as an Image Sitemap entry — ~2.5k authors have one
  // and they're under-discoverable in Google Images right now.
  let authors: AuthorRow[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('authors')
      .select('slug, display_name, updated_at, photo_url')
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    authors = authors.concat(data as AuthorRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  const entries: SitemapEntry[] = authors
    .filter((a): a is AuthorRow & { slug: string } => Boolean(a.slug))
    .map((a) => ({
      loc: `${SITEMAP_BASE_URL}/authors/${a.slug}`,
      lastmod: a.updated_at,
      changefreq: 'monthly',
      priority: 0.6,
      ...(a.photo_url
        ? {
            images: [{
              loc: a.photo_url,
              ...(a.display_name ? { title: `${a.display_name} — author portrait` } : {}),
            }],
          }
        : {}),
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
