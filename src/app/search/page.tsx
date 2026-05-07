export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { searchBooks } from '@/lib/book-search'
import SearchClient from '@/components/search-client'
import type { Book, CountryOption } from '@/components/book-browser'

type SearchParams = {
  q?: string | string[]
  country?: string | string[]
  reason?: string | string[]
  scope?: string | string[]
  active?: string | string[]
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
}

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    title: `Search — ${n.toLocaleString('en')} banned books`,
    description: `Search a catalogue of ${n.toLocaleString('en')} books banned by governments, schools, and libraries. Filter by country, reason, or institution.`,
    alternates: { canonical: '/search' },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const q       = pickFirst(sp.q)?.trim() ?? ''
  const country = pickFirst(sp.country) ?? ''
  const reason  = pickFirst(sp.reason) ?? ''
  const scope   = pickFirst(sp.scope) ?? ''
  const activeOnly = pickFirst(sp.active) === '1'

  const supabase = adminClient()

  const [
    { count: totalBooks },
    { data: banCounts },
    { data: countriesRaw },
    initialResult,
  ] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('mv_ban_counts').select('country_code, total_bans').gt('total_bans', 0),
    supabase.from('countries').select('code, name_en'),
    searchBooks({ q, country, reason, scope, activeOnly, offset: 0, limit: 48 }),
  ])

  const countMap = new Map((banCounts ?? []).map(r => [r.country_code, r.total_bans as number]))
  const countries: CountryOption[] = (countriesRaw ?? [])
    .filter(c => countMap.has(c.code))
    .sort((a, b) => a.name_en.localeCompare(b.name_en))
    .map(c => ({ code: c.code, name: c.name_en, count: countMap.get(c.code) ?? 0 }))

  const totalCount = totalBooks ?? 0
  const initialBooks = (initialResult.books as Book[]) ?? []
  const initialTotal = initialResult.total

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3">
          Search the database of {totalCount.toLocaleString('en')} banned books
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          Find books banned, restricted, or removed by governments, schools, and libraries worldwide.
          Search by title or author, then narrow by country, reason, or institution. Every entry is
          sourced from public records.
        </p>
      </header>

      <aside className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-snug">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Need every book in one file?</span>
          {' '}Download the complete catalogue as CSV, JSON, or SQLite.
        </p>
        <Link
          href="/dataset"
          className="shrink-0 text-sm font-semibold text-brand hover:underline self-start sm:self-auto"
        >
          See the dataset →
        </Link>
      </aside>

      <SearchClient
        initialBooks={initialBooks}
        initialTotal={initialTotal}
        totalCount={totalCount}
        countries={countries}
        initialFilters={{ q, country, reason, scope, activeOnly }}
      />
    </main>
  )
}
