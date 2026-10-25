// Book + author sitemap entries, built once and served in two scopes.
//
// 'core'  — what robots.txt's sitemap.xml advertises to every crawler. Mirrors
//           the Google-only noindex gates (src/lib/robots-meta.ts): books in
//           the indexable core, authors with a bio. Google is told about
//           exactly the pages it may index, nothing it would reject.
// 'all'   — every public page. Served by sitemap-full.xml, which is NOT in
//           robots.txt and is submitted only in Bing Webmaster Tools, so Bing
//           (and via it DuckDuckGo/Yahoo/Ecosia — 56% of traffic) keeps
//           discovering the long tail that Google is asked to skip.
//
// Same ISR cadence as the routes (6h). Each scan pulls small columns only;
// description presence is fetched as an id list rather than the text itself
// (~20k blurbs would be MBs of egress per regeneration).

import { adminClient } from '@/lib/supabase'
import { withDbRetry } from '@/lib/db-retry'
import { ORGANIZATION_AUTHOR_SLUGS } from '@/lib/organization-authors'
import { isCoreBook } from '@/lib/robots-meta'
import { SITEMAP_BASE_URL, type SitemapEntry } from '@/lib/sitemap-xml'

export type SitemapScope = 'core' | 'all'

type BookRow = {
  id: number
  slug: string
  title: string | null
  updated_at: string | null
  cover_url: string | null
}

type AuthorRow = {
  slug: string | null
  display_name: string | null
  updated_at: string | null
  photo_url: string | null
  bio: string | null
  is_placeholder: boolean | null
}

type PgPage<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>

async function scanAll<T>(
  label: string,
  page: (offset: number) => PgPage<T>,
): Promise<T[]> {
  let rows: T[] = []
  let offset = 0
  while (true) {
    const { data } = await withDbRetry(() => page(offset) as PgPage<T>, label)
    if (!data || data.length === 0) break
    rows = rows.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

export async function buildBookEntries(scope: SitemapScope): Promise<SitemapEntry[]> {
  const supabase = adminClient()

  // updated_at (trigger-maintained) so enrichment + new bans surface as
  // lastmod changes and IndexNow delta re-submits the changed URLs.
  const books = await scanAll<BookRow>('sitemap-books', (offset) => supabase
    .from('books')
    .select('id, slug, title, updated_at, cover_url')
    .not('slug', 'is', null)
    .eq('is_gated', false)
    .eq('is_blanket_works', false) // pseudo-books for author-level (Liste Otto) bans — never index
    .order('updated_at', { ascending: false })
    .range(offset, offset + 999))

  let keep = books
  if (scope === 'core') {
    const [counts, described] = await Promise.all([
      scanAll<{ entity_id: number; total_bans: number }>('sitemap-books-counts', (offset) => supabase
        .from('v_book_ban_counts')
        .select('entity_id, total_bans')
        .order('entity_id')
        .range(offset, offset + 999)),
      scanAll<{ id: number }>('sitemap-books-described', (offset) => supabase
        .from('books')
        .select('id')
        .not('description_book', 'is', null)
        .neq('description_book', '')
        .order('id')
        .range(offset, offset + 999)),
    ])
    const banCount = new Map(counts.map((c) => [c.entity_id, c.total_bans]))
    const hasDesc = new Set(described.map((d) => d.id))
    keep = books.filter((b) => isCoreBook({
      banCount: banCount.get(b.id) ?? 0,
      description: hasDesc.has(b.id) ? 'x' : null,
      coverUrl: b.cover_url,
    }))
  }

  return keep.map((book) => ({
    loc: `${SITEMAP_BASE_URL}/books/${book.slug}`,
    lastmod: book.updated_at,
    changefreq: 'monthly',
    priority: scope === 'core' ? 0.9 : 0.5,
    ...(book.cover_url
      ? {
          images: [{
            loc: book.cover_url,
            ...(book.title ? { title: `${book.title} — book cover` } : {}),
          }],
        }
      : {}),
  }))
}

export async function buildAuthorEntries(scope: SitemapScope): Promise<SitemapEntry[]> {
  const supabase = adminClient()
  const authors = await scanAll<AuthorRow>('sitemap-authors', (offset) => supabase
    .from('authors')
    .select('slug, display_name, updated_at, photo_url, bio, is_placeholder')
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + 999))

  return authors
    .filter((a): a is AuthorRow & { slug: string } => Boolean(a.slug))
    .filter((a) => !a.is_placeholder)
    // Core = the Google-indexable rule in authors/[slug]/page.tsx: bio present
    // or curated organization author. Bio-less pages are name+booklist stubs.
    .filter((a) => scope === 'all' || (a.bio ?? '').trim().length > 0 || ORGANIZATION_AUTHOR_SLUGS.has(a.slug))
    .map((a) => ({
      loc: `${SITEMAP_BASE_URL}/authors/${a.slug}`,
      lastmod: a.updated_at,
      changefreq: 'monthly',
      priority: scope === 'core' ? 0.6 : 0.4,
      ...(a.photo_url
        ? {
            images: [{
              loc: a.photo_url,
              ...(a.display_name ? { title: `${a.display_name} — author portrait` } : {}),
            }],
          }
        : {}),
    }))
}
