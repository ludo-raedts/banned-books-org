import { adminClient } from '@/lib/supabase'
import { SITEMAP_BASE_URL } from '@/lib/sitemap-xml'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'

async function fetchAllSlugs(table: 'books' | 'authors'): Promise<string[]> {
  const supabase = adminClient()
  const slugs: string[] = []
  let offset = 0
  while (true) {
    let query = supabase
      .from(table)
      .select('slug')
      .not('slug', 'is', null)
    // Bucket B (gated) books are excluded from IndexNow / canonical-URL pings.
    if (table === 'books') query = query.eq('is_gated', false)
    const { data } = await query
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (row.slug) slugs.push(row.slug)
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return slugs
}

export async function getAllCanonicalUrls(): Promise<string[]> {
  const supabase = adminClient()

  const [bookSlugs, authorSlugs, countriesRes, bansRes, reasonsRes, staticEntries] = await Promise.all([
    fetchAllSlugs('books'),
    fetchAllSlugs('authors'),
    supabase.from('countries').select('code'),
    supabase.from('bans').select('country_code'),
    supabase.from('reasons').select('slug'),
    getSitemapStaticEntries(),
  ])

  const countriesWithBans = new Set((bansRes.data ?? []).map((b) => b.country_code))
  const countryUrls = (countriesRes.data ?? [])
    .filter((c) => countriesWithBans.has(c.code))
    .map((c) => `${SITEMAP_BASE_URL}/countries/${c.code.toLowerCase()}`)

  const reasonUrls = (reasonsRes.data ?? [])
    .filter((r): r is { slug: string } => Boolean(r.slug))
    .map((r) => `${SITEMAP_BASE_URL}/reasons/${r.slug}`)

  return [
    ...staticEntries.map((e) => e.loc),
    ...bookSlugs.map((slug) => `${SITEMAP_BASE_URL}/books/${slug}`),
    ...authorSlugs.map((slug) => `${SITEMAP_BASE_URL}/authors/${slug}`),
    ...countryUrls,
    ...reasonUrls,
  ]
}
