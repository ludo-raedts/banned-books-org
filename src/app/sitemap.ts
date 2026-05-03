import type { MetadataRoute } from 'next'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://banned-books.org'
  const supabase = adminClient()

  // Paginate books to avoid Supabase 1000-row cap
  let allBooks: { slug: string; created_at: string | null }[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books').select('slug, created_at').range(offset, offset + 999)
    if (!data || data.length === 0) break
    allBooks = allBooks.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }

  const [{ data: countries }, { data: bans }, { data: authors }, { data: reasons }] = await Promise.all([
    supabase.from('countries').select('code'),
    supabase.from('bans').select('country_code'),
    supabase.from('authors').select('slug').not('slug', 'is', null),
    supabase.from('reasons').select('slug'),
  ])

  const countriesWithBans = new Set((bans ?? []).map((b) => b.country_code))

  return [
    // Core
    { url: base, changeFrequency: 'daily', priority: 1.0 },
    // Top-level nav pages
    { url: `${base}/countries`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/stats`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/reasons`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/news`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/history`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/reading-list`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/sources`, changeFrequency: 'monthly', priority: 0.4 },
    // Scope pages
    { url: `${base}/scope/school`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/scope/government`, changeFrequency: 'weekly', priority: 0.8 },
    // Reason detail pages
    ...(reasons ?? []).map((r) => ({
      url: `${base}/reasons/${r.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // All books (paginated above)
    ...allBooks.map((book) => ({
      url: `${base}/books/${book.slug}`,
      lastModified: book.created_at ? new Date(book.created_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    // Countries with at least one ban
    ...(countries ?? [])
      .filter((c) => countriesWithBans.has(c.code))
      .map((c) => ({
        url: `${base}/countries/${c.code}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    // Authors
    ...(authors ?? [])
      .filter((a) => a.slug)
      .map((a) => ({
        url: `${base}/authors/${a.slug}`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ]
}
