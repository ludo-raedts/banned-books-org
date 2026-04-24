import type { MetadataRoute } from 'next'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://banned-books.org'
  const supabase = adminClient()

  const [{ data: books }, { data: countries }, { data: bans }] = await Promise.all([
    supabase.from('books').select('slug, created_at'),
    supabase.from('countries').select('code'),
    supabase.from('bans').select('country_code'),
  ])

  const countriesWithBans = new Set((bans ?? []).map((b) => b.country_code))

  return [
    { url: base, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/scope/school`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/scope/government`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/sources`, changeFrequency: 'monthly', priority: 0.4 },
    ...(books ?? []).map((book) => ({
      url: `${base}/books/${book.slug}`,
      lastModified: book.created_at ? new Date(book.created_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...(countries ?? [])
      .filter((c) => countriesWithBans.has(c.code))
      .map((c) => ({
        url: `${base}/countries/${c.code}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
  ]
}
