// Static (ISR): all filtering happens client-side in <CountriesBrowser>, so the
// page needs no searchParams and no per-request render. Data is cached 24h —
// counts only change on import/enrichment.
export const revalidate = 86400

import CollectionJsonLd from '@/components/collection-json-ld'
import type { Metadata } from 'next'
import Link from '@/components/link'
import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import CountriesBrowser, { type BanCountRow, type CountryRow } from '@/components/countries-browser'

const DEFUNCT = ['SU', 'CS', 'DD', 'YU']

// Shared by the page body and generateMetadata; counts change only on import/
// enrichment, so a day of staleness is invisible.
const loadCountriesBase = unstable_cache(
  async () => {
    const supabase = adminClient()
    const [{ data: countries }, { data: banCounts }, { data: reasonsData }, { data: reasonRows }] = await Promise.all([
      // rows: ~90 | reason: country names + codes
      supabase.from('countries').select('code, name_en'),
      // rows: ~90 | reason: materialized view — distinct banned books per country.
      // distinct_books is the canonical ranking metric (not total_bans, which is
      // inflated for the US by PEN America's per-district granularity).
      supabase.from('mv_ban_counts').select('country_code, distinct_books, distinct_active_books, distinct_books_historical, distinct_books_contemporary'),
      // rows: ~12 | reason: filter pill options
      supabase.from('reasons').select('slug').order('slug'),
      // rows: ~1k | reason: every (country × reason) count, so the client can filter without a round trip
      supabase.from('mv_country_reason_counts').select('reason_slug, country_code, distinct_books, distinct_active_books, distinct_books_historical, distinct_books_contemporary').range(0, 4999),
    ])
    const reasonCounts: Record<string, BanCountRow[]> = {}
    for (const r of (reasonRows ?? []) as (BanCountRow & { reason_slug: string })[]) {
      const { reason_slug, ...row } = r
      ;(reasonCounts[reason_slug] ??= []).push(row)
    }
    return {
      countries: (countries ?? []) as CountryRow[],
      banCounts: (banCounts ?? []) as BanCountRow[],
      reasonSlugs: (reasonsData ?? []).map(r => r.slug as string),
      reasonCounts,
    }
  },
  ['countries-base-v2'],
  { revalidate: 86400, tags: ['countries'] },
)

export async function generateMetadata(): Promise<Metadata> {
  const { countries, banCounts } = await loadCountriesBase()
  const countMap = new Map(banCounts.map(r => [r.country_code, r.distinct_books]))
  const activeCount = countries
    .filter(c => !DEFUNCT.includes(c.code) && (countMap.get(c.code) ?? 0) > 0)
    .length
  return {
    title: `Books Banned by Country — ${activeCount} Countries`,
    description: `Browse books banned or challenged in ${activeCount} countries, from school challenges in the United States to government bans across Asia, the Middle East, and Latin America.`,
    alternates: { canonical: '/countries' },
  }
}

export default async function CountriesPage() {
  const { countries, banCounts, reasonSlugs, reasonCounts } = await loadCountriesBase()
  const countMap = new Map(banCounts.map(r => [r.country_code, r.distinct_books]))
  const activeBase = countries
    .filter(c => (countMap.get(c.code) ?? 0) > 0 && !DEFUNCT.includes(c.code))
    .sort((a, b) => (countMap.get(b.code) ?? 0) - (countMap.get(a.code) ?? 0))

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <CollectionJsonLd
        path="/countries"
        name="Books Banned by Country"
        description="Countries with documented book bans and challenges, from school challenges in the United States to government bans worldwide."
        items={activeBase.map(c => ({ name: `Books banned in ${c.name_en}`, path: `/countries/${c.code.toLowerCase()}` }))}
      />
      <div className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Catalogue</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Books Banned by Country</h1>
        <p className="text-gray-700 max-w-2xl leading-relaxed text-sm">
          {activeBase.length} countries with documented book bans — from school challenges in the United States to government bans across Asia, the Middle East, and Latin America.
        </p>
      </div>

      {/* Context banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-sm text-amber-900 leading-relaxed">
        <strong>Note on coverage:</strong> The United States appears first because US bans are
        systematically tracked by PEN America and the ALA. Bans in authoritarian states are
        far more common but often undocumented.{' '}
        <Link href="/methodology" className="underline hover:text-amber-700">
          Read more about how this data is collected →
        </Link>
      </div>

      <p className="text-xs text-gray-400 mb-6">
        Looking for the most-banned titles?{' '}
        <Link href="/top-100-banned-books" className="underline hover:text-gray-600 transition-colors">
          See the 100 most banned books →
        </Link>
      </p>

      <CountriesBrowser
        countries={countries}
        banCounts={banCounts}
        reasonCounts={reasonCounts}
        reasons={reasonSlugs}
      />

      <div className="text-sm text-gray-500 border-t border-gray-200 pt-6">
        <p>
          Coverage is uneven: well-documented democracies like the United States appear to have more bans
          because their censorship attempts are systematically recorded. Bans in closed authoritarian states
          often go undocumented. This catalogue is a work in progress.
        </p>
      </div>
    </main>
  )
}
