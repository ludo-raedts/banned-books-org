// ISR: stats page reads materialized views (mv_ban_counts, v_top_*) plus
// raw counts. MV's are refreshed hourly by the refresh-views cron, so a
// 1h revalidate aligns with how often the displayed numbers can change.
// searchParams (country/reason/active filters) make Next bail to dynamic
// rendering per request — that's the expected behaviour for filtered
// views; the no-param /stats page benefits from the cache window.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { adminClient } from '@/lib/supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'
import TrendingWidget from '@/components/trending-widget'
import StatsFilters from '@/components/stats-filters'
import HighlightsStripBlock from '@/components/highlights-strip-block'
import { countryFlag } from '@/lib/country-flag'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = adminClient()
  const [{ count: bookCount }, { count: banCount }, { data: countryRows }] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('country_code').range(0, 9999),
  ])
  const countryCount = new Set((countryRows ?? []).map((r) => r.country_code)).size
  const books = (bookCount ?? 0).toLocaleString('en')
  const bans = (banCount ?? 0).toLocaleString('en')
  return {
    title: 'Global book censorship statistics',
    description: `${books} banned books and ${bans} documented bans across ${countryCount} countries — explore historical trends by decade, the top reasons, and the most-censored authors.`,
    alternates: { canonical: '/stats' },
  }
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

  const [{ count: totalBooks }, { count: totalBanEvents }, { data: countriesRaw }] = await Promise.all([
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
      const { data, error } = await supabase
        .from('bans')
        .select('id, book_id, country_code, year_started, status, ban_reason_links(reasons(slug))')
        // Stable total order is required or .range() pagination skips/dupes
        // rows once the table exceeds the 1000-row page size — which inflates
        // the decade histogram below. Order by the PK.
        .order('id')
        .range(offset, offset + 999)
      // Throw rather than swallow: on a transient DB error this page would
      // otherwise publish wrong/zero stats. Throwing lets ISR keep serving the
      // last good render (stale-while-revalidate) instead.
      if (error) throw error
      if (!data || data.length === 0) break
      bansRaw = bansRaw.concat(data as unknown as BanRow[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  // rows: all book_authors | reason: top-authors leaderboard
  type BARow = { book_id: number; authors: { display_name: string; slug: string | null; is_placeholder: boolean | null } | null }
  let bookAuthorsRaw: BARow[] = []
  {
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('book_authors')
        .select('book_id, authors(display_name, slug, is_placeholder)')
        // Composite PK (book_id, author_id) — order by both for a deterministic
        // total order across pages, else the authors leaderboard mis-counts.
        .order('book_id')
        .order('author_id')
        .range(offset, offset + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      bookAuthorsRaw = bookAuthorsRaw.concat(data as unknown as BARow[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  const countryMap = new Map((countriesRaw ?? []).map(c => [c.code, c.name_en]))

  // All ranking sections count DISTINCT books, not raw ban records — otherwise
  // PEN America's per-district granularity inflates US-leaning numbers (one
  // book × 200 districts = 200 ban records but 1 banned book).

  // ── Top countries (unfiltered) ─────────────────────────────────────
  const countryBooks = new Map<string, Set<number>>()
  for (const ban of bansRaw) {
    let s = countryBooks.get(ban.country_code)
    if (!s) { s = new Set(); countryBooks.set(ban.country_code, s) }
    s.add(ban.book_id)
  }
  const top5Countries = [...countryBooks.entries()]
    .map(([code, books]) => ({ code, name: countryMap.get(code) ?? code, count: books.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const maxCountry = top5Countries[0]?.count ?? 1

  // ── Top authors (unfiltered) ───────────────────────────────────────
  const authorSlugMap = new Map<string, string | null>()
  const bookAuthorMap = new Map<number, string[]>()
  for (const ba of bookAuthorsRaw) {
    if (!ba.authors?.display_name) continue
    if (ba.authors.is_placeholder === true) continue
    const list = bookAuthorMap.get(ba.book_id) ?? []
    list.push(ba.authors.display_name)
    bookAuthorMap.set(ba.book_id, list)
    if (!authorSlugMap.has(ba.authors.display_name)) {
      authorSlugMap.set(ba.authors.display_name, ba.authors.slug ?? null)
    }
  }
  const authorBooks = new Map<string, Set<number>>()
  const bannedBookIds = new Set(bansRaw.map(b => b.book_id))
  for (const bookId of bannedBookIds) {
    for (const author of bookAuthorMap.get(bookId) ?? []) {
      let s = authorBooks.get(author)
      if (!s) { s = new Set(); authorBooks.set(author, s) }
      s.add(bookId)
    }
  }
  const topAuthors = [...authorBooks.entries()]
    .map(([name, books]) => ({ name, count: books.size, slug: authorSlugMap.get(name) ?? null }))
    .filter(a => a.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
  const maxAuthor = topAuthors[0]?.count ?? 1

  // ── Top reasons (unfiltered) ───────────────────────────────────────
  const reasonBooks = new Map<string, Set<number>>()
  for (const ban of bansRaw) {
    for (const link of ban.ban_reason_links) {
      const slug = link.reasons?.slug
      if (!slug) continue
      let s = reasonBooks.get(slug)
      if (!s) { s = new Set(); reasonBooks.set(slug, s) }
      s.add(ban.book_id)
    }
  }
  const topReasons = [...reasonBooks.entries()]
    .map(([slug, books]) => ({ slug, count: books.size }))
    .sort((a, b) => b.count - a.count)
  const maxReason = topReasons[0]?.count ?? 1

  // ── Currently banned vs all-lifted (unfiltered) ───────────────────
  // Count distinct books, not ban records. A book is "currently banned" if
  // it has at least one ban with status='active' anywhere; it's "lifted" if
  // every recorded ban for it has been overturned.
  const activeBookIds = new Set<number>()
  for (const ban of bansRaw) {
    if (ban.status === 'active') activeBookIds.add(ban.book_id)
  }
  const activelyBannedBooks = activeBookIds.size
  const liftedOnlyBooks = bannedBookIds.size - activelyBannedBooks

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

  // Log scale so small historical eras stay visible next to the 2020s peak.
  // log10(count + 1) keeps count=1 at 0 and avoids -Infinity for count=0.
  const TIMELINE_PX = 112
  const logMax = Math.log10(maxDecade + 1)
  const logHeight = (count: number) =>
    Math.max(Math.round((Math.log10(count + 1) / logMax) * TIMELINE_PX), 4)

  // Gridlines at each power of 10 up to (and including) the next one above max.
  const gridTicks: number[] = []
  for (let exp = 0; Math.pow(10, exp) <= maxDecade * 10; exp++) {
    const v = Math.pow(10, exp)
    if (v <= 1 || v > maxDecade * 1.5) continue
    gridTicks.push(v)
  }

  // Color buckets so the log-flattened bars still carry a "much / little" signal.
  const TIMELINE_BUCKETS = [
    { max: 10,     label: '< 10',     bar: 'bg-red-200', swatch: 'bg-red-200' },
    { max: 100,    label: '< 100',    bar: 'bg-red-300', swatch: 'bg-red-300' },
    { max: 500,    label: '< 500',    bar: 'bg-red-400', swatch: 'bg-red-400' },
    { max: 1000,   label: '< 1,000',  bar: 'bg-red-500', swatch: 'bg-red-500' },
    { max: 10000,  label: '< 10,000', bar: 'bg-red-700', swatch: 'bg-red-700' },
    { max: Infinity, label: '≥ 10,000', bar: 'bg-red-900', swatch: 'bg-red-900' },
  ] as const
  const bucketFor = (count: number) => TIMELINE_BUCKETS.find(b => count < b.max) ?? TIMELINE_BUCKETS[TIMELINE_BUCKETS.length - 1]

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
      <div className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 mb-12 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Data</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Censorship by the numbers</h1>
        <p className="text-gray-700 max-w-2xl leading-relaxed text-sm">
          Books have been banned, burned, and suppressed by governments, churches, and school boards for
          as long as they have been written. This catalogue documents{' '}
          <span className="font-semibold text-gray-900">{(totalBooks ?? 0).toLocaleString('en')} books</span> across{' '}
          <span className="font-semibold text-gray-900">{countryBooks.size} countries</span>, with{' '}
          <span className="font-semibold text-gray-900">{(totalBanEvents ?? 0).toLocaleString('en')} documented ban events</span> — from
          Ancient Rome&apos;s book burnings to today&apos;s school board removals in the American South.
        </p>
        <p className="text-gray-600 max-w-2xl leading-relaxed text-xs mt-3">
          Want to run your own analysis? The full catalogue is available as a{' '}
          <Link href="/dataset" className="underline font-medium hover:text-gray-800">
            downloadable dataset
          </Link>
          {' '}(CSV, JSON, SQLite).
        </p>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {[
          { label: 'Books catalogued',        value: (totalBooks ?? 0).toLocaleString('en') },
          { label: 'Ban events documented',   value: (totalBanEvents ?? 0).toLocaleString('en') },
          { label: 'Countries & territories', value: countryBooks.size.toString() },
          { label: 'Currently banned',        value: activelyBannedBooks.toLocaleString('en'), sub: `${liftedOnlyBooks.toLocaleString('en')} fully lifted` },
        ].map(stat => (
          <div key={stat.label} className="border border-gray-200 rounded-xl p-4">
            <div className="text-3xl font-bold tabular-nums text-brand">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            {stat.sub && <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── 3. Trending this week ── */}
      <section className="mb-16">
        <TrendingWidget />
      </section>

      {/* ── 4. Where bans are concentrated ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Where bans are concentrated</h2>
        <p className="text-sm text-gray-500 mb-6">Top 5 countries by number of distinct books banned.</p>
        <div className="space-y-2">
          {top5Countries.map((c) => (
            <Link key={c.code} href={`/countries/${c.code.toLowerCase()}`} className="flex items-center gap-3 group">
              <span className="text-base leading-none shrink-0 w-6">{countryFlag(c.code)}</span>
              <span className="w-32 shrink-0 text-sm text-gray-700 group-hover:underline truncate">{c.name}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className="h-4 rounded bg-brand transition-all shrink-0"
                  style={{ width: `${(c.count / maxCountry * 100).toFixed(1)}%`, minWidth: '4px' }}
                />
                <span className="text-xs tabular-nums text-gray-500">{c.count}</span>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/countries" className="inline-block mt-4 text-sm text-gray-500 hover:underline">
          See all countries →
        </Link>
        <p className="mt-3 text-xs text-gray-400">
          The US dominates this chart because its bans are systematically tracked by PEN America and the ALA.{' '}
          <Link href="/methodology" className="underline hover:text-gray-600">
            Why the data looks this way →
          </Link>
        </p>
      </section>

      {/* ── 5. Authors ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">The Authors They Wanted Silenced</h2>
        <p className="text-sm text-gray-500 mb-6">
          Authors whose work has been repeatedly challenged or banned across institutions and borders.
        </p>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {topAuthors.map((a, i) => (
            <div
              key={a.name}
              className="relative group border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-r-sm pointer-events-none bg-brand"
                style={{ width: `${(a.count / maxAuthor * 100).toFixed(1)}%`, opacity: 0.08 }}
              />
              <div className="relative z-10 flex items-center gap-3 py-3 px-4">
                <span className="w-8 text-right text-sm text-gray-400 tabular-nums shrink-0">{i + 1}</span>
                {a.slug ? (
                  <Link
                    href={`/authors/${a.slug}`}
                    className="flex-1 text-sm font-medium text-gray-800 hover:underline flex items-center gap-1"
                  >
                    {a.name}
                    <span className="opacity-0 group-hover:opacity-60 transition-opacity text-xs">→</span>
                  </Link>
                ) : (
                  <span className="flex-1 text-sm font-medium text-gray-800">{a.name}</span>
                )}
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-brand text-white text-xs font-medium tabular-nums">
                  {a.count} {a.count === 1 ? 'book' : 'books'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Why Books Get Banned ── */}
      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-xl font-semibold text-gray-900">Why Books Get Banned</h2>
          <Link href="/reasons" className="text-sm text-gray-500 hover:underline">All reasons →</Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          The stated reasons for banning a book reveal as much about the censor as the censored.
        </p>
        <div className="space-y-3">
          {topReasons.map(r => (
            <Link key={r.slug} href={`/reasons/${r.slug}`} className="flex items-center gap-3 group">
              <span className="text-lg leading-none shrink-0 w-7">{reasonIcon(r.slug)}</span>
              <span className="w-28 shrink-0 text-sm text-gray-700 group-hover:underline">{reasonLabel(r.slug)}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className={`h-5 rounded shrink-0 ${REASON_COLORS[r.slug] ?? 'bg-gray-400'}`}
                  style={{ width: `${(r.count / maxReason * 100).toFixed(1)}%`, minWidth: '4px' }}
                />
                <span className="text-sm font-medium tabular-nums text-gray-700">{r.count}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 7. Bans Through History (timeline) ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Bans Through History</h2>
        <p className="text-sm text-gray-500 mb-4">
          From the Catholic Index Librorum Prohibitorum (1559) to today&apos;s school board removals.
          Bars use a <span className="font-medium">logarithmic scale</span> — each gridline is a 10× increase, so earlier eras stay visible alongside the 2020s peak.
          {timelineWithoutYear > 0 && (
            <> {timelineWithoutYear.toLocaleString('en')} bans with no recorded year are excluded.</>
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
            Showing {timelineBans.length.toLocaleString('en')} ban{timelineBans.length !== 1 ? 's' : ''} matching your filters.
          </p>
        )}

        <div className="flex items-stretch">
          {/* Y-axis (sticky, outside the horizontal scroll) */}
          <div
            className="relative shrink-0 pr-2 select-none"
            style={{ width: '3rem', height: `${TIMELINE_PX + 32}px` }}
            aria-hidden
          >
            {gridTicks.map(v => {
              const y = (Math.log10(v + 1) / logMax) * TIMELINE_PX
              return (
                <span
                  key={v}
                  className="absolute right-2 text-[10px] tabular-nums text-gray-400 leading-none"
                  style={{ bottom: `${y + 16}px`, transform: 'translateY(50%)' }}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
                </span>
              )
            })}
          </div>

          <div className="flex-1 overflow-x-auto pb-1" dir="rtl">
            <div
              className="relative inline-flex items-end gap-1 min-w-max"
              style={{ height: `${TIMELINE_PX + 32}px` }}
              dir="ltr"
            >
              {/* Gridlines spanning the full chart width */}
              {gridTicks.map(v => {
                const y = (Math.log10(v + 1) / logMax) * TIMELINE_PX
                return (
                  <div
                    key={v}
                    className="absolute inset-x-0 border-t border-dashed border-gray-200 pointer-events-none"
                    style={{ bottom: `${y + 16}px` }}
                  />
                )
              })}

              {decades.map((d, i) => {
                const isOngoing = d.decade === CURRENT_DECADE
                const barH = logHeight(d.count)
                const labelClass = i % 2 === 0
                  ? 'text-[10px] text-gray-400 tabular-nums'
                  : 'text-[10px] text-gray-400 tabular-nums hidden md:block'
                const bucket = bucketFor(d.count)
                return (
                  <div key={d.decade} className="flex flex-col items-center shrink-0 relative z-10" style={{ width: '2.5rem' }}>
                    <div className="flex-1 flex items-end relative w-full justify-center">
                      <div
                        className={`w-8 rounded-t transition-all ${bucket.bar} ${isOngoing ? 'ring-2 ring-brand ring-offset-1 ring-offset-white' : ''}`}
                        style={{ height: `${barH}px` }}
                        title={`${d.decade}s: ${d.count.toLocaleString('en')} ban${d.count !== 1 ? 's' : ''}${isOngoing ? ' (ongoing)' : ''}`}
                      />
                      {/* Count label anchored just above the bar */}
                      <span
                        className="absolute text-[9px] tabular-nums leading-none pointer-events-none select-none text-gray-500"
                        style={{ bottom: `${barH + 3}px` }}
                      >
                        {d.count.toLocaleString('en')}
                      </span>
                    </div>
                    <span className={labelClass}>{d.decade}s</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Color-bucket legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="uppercase tracking-wide text-gray-400">Bans per decade:</span>
          {TIMELINE_BUCKETS.map(b => (
            <span key={b.label} className="inline-flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${b.swatch}`} aria-hidden />
              <span className="tabular-nums">{b.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── 8. Browse by year ── */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Browse by Year</h2>
        <p className="text-sm text-gray-500 mb-4">All documented bans that started in a given year.</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: CURRENT_DECADE + 10 - 2015 + 1 }, (_, i) => 2015 + i)
            .filter(y => y <= new Date().getFullYear())
            .reverse()
            .map(y => (
              <Link
                key={y}
                href={`/banned-books/${y}`}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand transition-colors"
              >
                {y}
              </Link>
            ))
          }
        </div>
      </section>

      {/* ── 9. Dataset CTA ── */}
      <section className="mb-12 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Full dataset</p>
        <h2 className="text-xl font-semibold tracking-tight mb-2">Run your own analysis</h2>
        <p className="text-sm text-gray-700 leading-relaxed mb-5 max-w-3xl">
          These charts only scratch the surface. The complete catalogue — every banned, challenged, and
          restricted book, with country, year, reason, and source citation — is available as a structured
          dataset in CSV, JSON, and SQLite. Use it to answer questions this page does not.
        </p>
        <ul className="text-sm text-gray-700 leading-relaxed flex flex-col gap-2 mb-5">
          <li>📊 <strong>Research &amp; journalism</strong> — quantify trends, find under-reported regions, write data-driven stories.</li>
          <li>🎓 <strong>Academic work</strong> — cite stable, dated snapshots in papers on intellectual freedom or media studies.</li>
          <li>🛠️ <strong>Building tools</strong> — power dashboards, classroom resources, or comparison sites.</li>
        </ul>
        <Link
          href="/dataset"
          className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          See what&rsquo;s in the dataset →
        </Link>
      </section>

      {/* ── 9b. Highlights strip — most-banned / trending / all-time picks ── */}
      <section className="mb-10">
        <HighlightsStripBlock />
      </section>

      {/* ── 10. Closing disclaimer ── */}
      <div className="border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-600 text-sm mb-4">
          These statistics represent only what has been documented. The true scale of literary censorship —
          especially in closed societies — will never be fully known.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="text-sm font-medium text-gray-700 hover:underline">Browse all books →</Link>
          <Link href="/countries" className="text-sm font-medium text-gray-700 hover:underline">Explore by country →</Link>
          <Link href="/reasons" className="text-sm font-medium text-gray-700 hover:underline">Explore by reason →</Link>
        </div>
      </div>
    </main>
  )
}
