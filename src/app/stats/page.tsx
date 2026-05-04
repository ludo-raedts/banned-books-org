export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { adminClient } from '@/lib/supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'
import TrendingWidget from '@/components/trending-widget'
import StatsFilters from '@/components/stats-filters'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = adminClient()
  const [{ count: bookCount }, { count: banCount }, { data: countryRows }] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('country_code').range(0, 9999),
  ])
  const countryCount = new Set((countryRows ?? []).map((r) => r.country_code)).size
  return {
    title: 'Censorship by the Numbers — Banned Books',
    description: `Statistics on literary censorship worldwide: over ${(bookCount ?? 0).toLocaleString()} banned books, ${(banCount ?? 0).toLocaleString()} documented bans across ${countryCount} countries.`,
    alternates: { canonical: '/stats' },
  }
}

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

const REASON_COLORS: Record<string, string> = {
  lgbtq:     'bg-pink-500',
  political: 'bg-blue-500',
  religious: 'bg-amber-500',
  sexual:    'bg-red-500',
  violence:  'bg-orange-500',
  racial:    'bg-purple-500',
  drugs:     'bg-green-500',
  obscenity: 'bg-rose-500',
  blasphemy: 'bg-yellow-600',
  moral:     'bg-teal-500',
  language:  'bg-indigo-500',
  other:     'bg-gray-500',
}

const CURRENT_DECADE = Math.floor(new Date().getFullYear() / 10) * 10

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; reason?: string; active?: string }>
}) {
  const filters = await searchParams
  const filterCountry = filters.country ?? ''
  const filterReason = filters.reason ?? ''
  const filterActive = filters.active === '1'

  const supabase = adminClient()

  const [{ count: totalBooks }, { count: totalBans }, { data: countriesRaw }] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('countries').select('code, name_en'),
  ])

  // rows: all bans | reason: used for every section
  type BanRow = { id: number; book_id: number; country_code: string; year_started: number | null; status: string; ban_reason_links: Array<{ reasons: { slug: string } | null }> }
  let bansRaw: BanRow[] = []
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('bans')
        .select('id, book_id, country_code, year_started, status, ban_reason_links(reasons(slug))')
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      bansRaw = bansRaw.concat(data as unknown as BanRow[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  // rows: all book_authors | reason: top-authors leaderboard
  type BARow = { book_id: number; authors: { display_name: string; slug: string | null } | null }
  let bookAuthorsRaw: BARow[] = []
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('book_authors')
        .select('book_id, authors(display_name, slug)')
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      bookAuthorsRaw = bookAuthorsRaw.concat(data as unknown as BARow[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  const countryMap = new Map((countriesRaw ?? []).map(c => [c.code, c.name_en]))

  // ── Top countries (unfiltered) ─────────────────────────────────────
  const countryCounts = new Map<string, number>()
  for (const ban of bansRaw) {
    countryCounts.set(ban.country_code, (countryCounts.get(ban.country_code) ?? 0) + 1)
  }
  const top5Countries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, name: countryMap.get(code) ?? code, count }))
  const maxCountry = top5Countries[0]?.count ?? 1

  // ── Top authors (unfiltered) ───────────────────────────────────────
  const authorSlugMap = new Map<string, string | null>()
  const bookAuthorMap = new Map<number, string[]>()
  for (const ba of bookAuthorsRaw) {
    if (!ba.authors?.display_name) continue
    const list = bookAuthorMap.get(ba.book_id) ?? []
    list.push(ba.authors.display_name)
    bookAuthorMap.set(ba.book_id, list)
    if (!authorSlugMap.has(ba.authors.display_name)) {
      authorSlugMap.set(ba.authors.display_name, ba.authors.slug ?? null)
    }
  }
  const authorCounts = new Map<string, number>()
  for (const ban of bansRaw) {
    for (const author of bookAuthorMap.get(ban.book_id) ?? []) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1)
    }
  }
  const topAuthors = [...authorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, slug: authorSlugMap.get(name) ?? null }))
  const maxAuthor = topAuthors[0]?.count ?? 1

  // ── Top reasons (unfiltered) ───────────────────────────────────────
  const reasonCounts = new Map<string, number>()
  for (const ban of bansRaw) {
    for (const link of ban.ban_reason_links) {
      const slug = link.reasons?.slug
      if (slug) reasonCounts.set(slug, (reasonCounts.get(slug) ?? 0) + 1)
    }
  }
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, count]) => ({ slug, count }))
  const maxReason = topReasons[0]?.count ?? 1

  // ── Active vs historical (unfiltered) ─────────────────────────────
  const activeBans = bansRaw.filter(b => b.status === 'active').length
  const historicalBans = bansRaw.length - activeBans

  // ── Timeline: apply filters, then bucket by decade ─────────────────
  let timelineBans = bansRaw
  if (filterCountry) timelineBans = timelineBans.filter(b => b.country_code === filterCountry)
  if (filterReason)  timelineBans = timelineBans.filter(b => b.ban_reason_links.some(l => l.reasons?.slug === filterReason))
  if (filterActive)  timelineBans = timelineBans.filter(b => b.status === 'active')

  const isFiltered = !!(filterCountry || filterReason || filterActive)

  const decadeCounts = new Map<number, number>()
  for (const ban of timelineBans) {
    if (!ban.year_started || ban.year_started < 1000) continue
    const decade = Math.floor(ban.year_started / 10) * 10
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1)
  }
  const decades = [...decadeCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ decade, count }))
  const maxDecade = Math.max(...decades.map(d => d.count), 1)
  const timelineWithYear = timelineBans.filter(b => b.year_started && b.year_started >= 1000).length
  const timelineWithoutYear = timelineBans.length - timelineWithYear

  // ── Filter options (for the timeline filter UI) ────────────────────
  const filterCountryOptions = [...new Set(bansRaw.map(b => b.country_code))]
    .map(code => ({ code, name: countryMap.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const allReasonSlugs = [...new Set(
    bansRaw.flatMap(b => b.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s))
  )].sort()

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">

      {/* ── 1. Hero ── */}
      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-12 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Data</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Censorship by the numbers</h1>
        <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
          Books have been banned, burned, and suppressed by governments, churches, and school boards for
          as long as they have been written. This catalogue documents{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{(totalBooks ?? 0).toLocaleString()} books</span> and{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{(totalBans ?? 0).toLocaleString()} bans</span> across{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{countryCounts.size} countries</span> — from
          Ancient Rome&apos;s book burnings to today&apos;s school board removals in the American South.
        </p>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {[
          { label: 'Books catalogued',        value: (totalBooks ?? 0).toLocaleString() },
          { label: 'Total bans recorded',     value: (totalBans ?? 0).toLocaleString() },
          { label: 'Countries & territories', value: countryCounts.size.toString() },
          { label: 'Currently banned',        value: activeBans.toLocaleString(), sub: `${historicalBans.toLocaleString()} lifted` },
        ].map(stat => (
          <div key={stat.label} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold tabular-nums text-brand">{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</div>
            {stat.sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── 3. Trending this week ── */}
      <section className="mb-16">
        <TrendingWidget />
      </section>

      {/* ── 4. Where bans are concentrated ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Where bans are concentrated</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Top 5 countries by total ban count.</p>
        <div className="space-y-2">
          {top5Countries.map((c) => (
            <Link key={c.code} href={`/countries/${c.code}`} className="flex items-center gap-3 group">
              <span className="text-base leading-none shrink-0 w-6">{countryFlag(c.code)}</span>
              <span className="w-32 shrink-0 text-sm text-gray-700 dark:text-gray-300 group-hover:underline truncate">{c.name}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className="h-4 rounded bg-brand transition-all shrink-0"
                  style={{ width: `${(c.count / maxCountry * 100).toFixed(1)}%`, minWidth: '4px' }}
                />
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{c.count}</span>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/countries" className="inline-block mt-4 text-sm text-gray-500 dark:text-gray-400 hover:underline">
          See all countries →
        </Link>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          The US dominates this chart because its bans are systematically recorded.{' '}
          <Link href="/methodology" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Why the data looks this way →
          </Link>
        </p>
      </section>

      {/* ── 5. Authors ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">The Authors They Wanted Silenced</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Authors whose work has been repeatedly challenged or banned across institutions and borders.
        </p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {topAuthors.map((a, i) => (
            <div
              key={a.name}
              className="relative group border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-r-sm pointer-events-none bg-brand"
                style={{ width: `${(a.count / maxAuthor * 100).toFixed(1)}%`, opacity: 0.08 }}
              />
              <div className="relative z-10 flex items-center gap-3 py-3 px-4">
                <span className="w-8 text-right text-sm text-gray-400 dark:text-gray-600 tabular-nums shrink-0">{i + 1}</span>
                {a.slug ? (
                  <Link
                    href={`/authors/${a.slug}`}
                    className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 hover:underline flex items-center gap-1"
                  >
                    {a.name}
                    <span className="opacity-0 group-hover:opacity-60 transition-opacity text-xs">→</span>
                  </Link>
                ) : (
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{a.name}</span>
                )}
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-brand text-white text-xs font-medium tabular-nums">
                  {a.count} {a.count === 1 ? 'ban' : 'bans'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Why Books Get Banned ── */}
      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Why Books Get Banned</h2>
          <Link href="/reasons" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">All reasons →</Link>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The stated reasons for banning a book reveal as much about the censor as the censored.
        </p>
        <div className="space-y-3">
          {topReasons.map(r => (
            <Link key={r.slug} href={`/reasons/${r.slug}`} className="flex items-center gap-3 group">
              <span className="text-lg leading-none shrink-0 w-7">{reasonIcon(r.slug)}</span>
              <span className="w-28 shrink-0 text-sm text-gray-700 dark:text-gray-300 group-hover:underline">{reasonLabel(r.slug)}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className={`h-5 rounded shrink-0 ${REASON_COLORS[r.slug] ?? 'bg-gray-400'}`}
                  style={{ width: `${(r.count / maxReason * 100).toFixed(1)}%`, minWidth: '4px' }}
                />
                <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">{r.count}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 7. Bans Through History (timeline) ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Bans Through History</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          From the Catholic Index Librorum Prohibitorum (1559) to today&apos;s school board removals.
          {timelineWithoutYear > 0 && (
            <> {timelineWithoutYear.toLocaleString()} bans with no recorded year are excluded.</>
          )}
        </p>

        {/* Timeline filter */}
        <Suspense>
          <StatsFilters
            countries={filterCountryOptions}
            reasons={allReasonSlugs}
            current={{ country: filterCountry, reason: filterReason, active: filterActive }}
          />
        </Suspense>
        {isFiltered && (
          <p className="text-xs text-brand mb-4">
            Showing {timelineBans.length.toLocaleString()} ban{timelineBans.length !== 1 ? 's' : ''} matching your filters.
          </p>
        )}

        <div className="overflow-x-auto pb-1" dir="rtl">
          <div className="inline-flex items-end gap-1 min-w-max" style={{ height: '9rem' }} dir="ltr">
            {decades.map((d, i) => {
              const isOngoing = d.decade === CURRENT_DECADE
              const barH = Math.max(Math.round(d.count / maxDecade * 112), 4)
              const labelClass = i % 2 === 0
                ? 'text-[10px] text-gray-400 dark:text-gray-500 tabular-nums'
                : 'text-[10px] text-gray-400 dark:text-gray-500 tabular-nums hidden md:block'
              return (
                <div key={d.decade} className="flex flex-col items-center shrink-0" style={{ width: '2.5rem' }}>
                  <div className="flex-1 flex items-end relative w-full justify-center">
                    <div
                      className={`w-8 rounded-t transition-all ${isOngoing ? 'bg-brand' : 'bg-red-500 dark:bg-red-600'}`}
                      style={{ height: `${barH}px` }}
                      title={`${d.decade}s: ${d.count} ban${d.count !== 1 ? 's' : ''}`}
                    />
                    {/* Count label anchored just above the bar */}
                    <span
                      className="absolute text-[9px] tabular-nums leading-none pointer-events-none select-none text-gray-500 dark:text-gray-400"
                      style={{ bottom: `${barH + 3}px` }}
                    >
                      {d.count}
                    </span>
                  </div>
                  <span className={labelClass}>{d.decade}s</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 8. Closing disclaimer ── */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          These statistics represent only what has been documented. The true scale of literary censorship —
          especially in closed societies — will never be fully known.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline">Browse all books →</Link>
          <Link href="/countries" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline">Explore by country →</Link>
          <Link href="/reasons" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline">Explore by reason →</Link>
        </div>
      </div>
    </main>
  )
}
