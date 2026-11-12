// The catalogue's headline figures, from ONE place.
//
// Before this, every surface ran its own count queries and they drifted:
// "countries" was computed five different ways, "sources" meant ~1.1k source
// records on /about and ~40k citations on /sources, and the register layer
// (src/lib/registers.ts) appeared on some pages and not on others. Pages,
// llms.txt and about.md read these numbers; the dataset builds use the same
// definitions (scripts/build-dataset.ts, scripts/build-zenodo-dataset.ts).
//
// Two layers that are never added together:
//  - books  — books with their own page, sources and detail ("Books documented");
//  - registerTitles — titles on official ban lists that we keep as registers
//    and that have no book page here ("titles on official lists").
//
// Cached for an hour in the data cache (one set of count queries for all
// pages, instead of one per page render) and tagged so an import can bust it.
// A failed query throws, so nothing caches a zero — see require-count.ts.
import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import { requireCount } from '@/lib/require-count'
import { getRegisterTotals, type RegisterTotal } from '@/lib/registers'

export const SITE_TOTALS_TAG = 'site-totals'

export type { RegisterTotal }

export type SiteTotals = {
  /** All catalogued books (includes the "all works" pseudo-books). */
  books: number
  /** Ban records. */
  bans: number
  /** Ban records with status 'active'. */
  activeBans: number
  /** Countries and territories with at least one documented book. */
  countries: number
  /** Distinct sources (ban_sources rows). */
  sources: number
  /** Source citations: links between a ban and a source. */
  citations: number
  /** Sum of furtherTitles over all register lists. */
  registerTitles: number
  registers: RegisterTotal[]
  /** Earliest dated ban in the catalogue, with the book it belongs to. */
  earliest: { year: number; title: string }
}

async function loadSiteTotals(): Promise<SiteTotals> {
  const sb = adminClient()
  const head = { count: 'exact' as const, head: true }
  const [books, bans, activeBans, sources, citations, countriesRes, mvRes, registers, earliestRes] = await Promise.all([
    sb.from('books').select('*', head),
    sb.from('bans').select('*', head),
    sb.from('bans').select('*', head).eq('status', 'active'),
    sb.from('ban_sources').select('*', head),
    sb.from('ban_source_links').select('*', head),
    sb.from('countries').select('code'),
    sb.from('mv_ban_counts').select('country_code').gt('distinct_books', 0),
    getRegisterTotals(),
    sb.from('bans').select('year_started, books(title)').not('year_started', 'is', null).order('year_started', { ascending: true }).limit(1),
  ])
  for (const res of [countriesRes, mvRes, earliestRes]) {
    if (res.error) throw res.error
  }
  if (!mvRes.data?.length) throw new Error('site-totals: mv_ban_counts returned no countries')

  // A country counts when it has a row in `countries` AND a documented book.
  const known = new Set((countriesRes.data ?? []).map((c) => c.code as string))
  const countries = (mvRes.data ?? []).filter((r) => known.has(r.country_code as string)).length

  const first = earliestRes.data?.[0] as unknown as { year_started: number; books: { title: string } | null } | undefined
  if (!first?.books?.title) throw new Error('site-totals: no dated ban found')

  const totals: SiteTotals = {
    books: requireCount(books, 'books'),
    bans: requireCount(bans, 'bans'),
    activeBans: requireCount(activeBans, 'activeBans'),
    countries,
    sources: requireCount(sources, 'sources'),
    citations: requireCount(citations, 'citations'),
    registerTitles: registers.reduce((n, r) => n + r.furtherTitles, 0),
    registers,
    earliest: { year: first.year_started, title: first.books.title },
  }
  if (!totals.books || !totals.countries) {
    throw new Error('site-totals: empty headline figures — refusing to cache zeros')
  }
  return totals
}

export const getSiteTotals = unstable_cache(loadSiteTotals, ['site-totals-v2'], {
  revalidate: 3600,
  tags: [SITE_TOTALS_TAG],
})
