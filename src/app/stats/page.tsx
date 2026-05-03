export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'

export const metadata: Metadata = {
  title: 'Stats — The State of Literary Censorship',
  description: 'Top lists and statistics: most banned countries, most challenged authors, reasons for banning, and a timeline of censorship through history.',
  alternates: { canonical: '/stats' },
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

export default async function StatsPage() {
  const supabase = adminClient()

  const [
    { data: bansRaw },
    { data: bookAuthorsRaw },
    { data: countriesRaw },
    { count: totalBooks },
    { count: totalBans },
  ] = await Promise.all([
    supabase.from('bans').select('id, book_id, country_code, year_started, status, ban_reason_links(reasons(slug))').limit(5000),
    supabase.from('book_authors').select('book_id, authors(display_name, slug)').limit(5000),
    supabase.from('countries').select('code, name_en'),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
  ])

  const bans = (bansRaw ?? []) as unknown as Array<{
    id: number; book_id: number; country_code: string; year_started: number | null; status: string
    ban_reason_links: Array<{ reasons: { slug: string } | null }>
  }>

  const countryMap = new Map((countriesRaw ?? []).map(c => [c.code, c.name_en]))

  // ── Top countries ──────────────────────────────────────────────────
  const countryCounts = new Map<string, number>()
  for (const ban of bans) {
    countryCounts.set(ban.country_code, (countryCounts.get(ban.country_code) ?? 0) + 1)
  }
  const allTopCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, name: countryMap.get(code) ?? code, count }))
  const top5Countries = allTopCountries.slice(0, 5)
  const maxCountry = top5Countries[0]?.count ?? 1

  // ── Top authors ────────────────────────────────────────────────────
  const authorSlugMap = new Map<string, string | null>()
  const bookAuthorMap = new Map<number, string[]>()
  for (const ba of (bookAuthorsRaw ?? []) as unknown as Array<{ book_id: number; authors: { display_name: string; slug: string | null } | null }>) {
    if (!ba.authors?.display_name) continue
    const list = bookAuthorMap.get(ba.book_id) ?? []
    list.push(ba.authors.display_name)
    bookAuthorMap.set(ba.book_id, list)
    if (!authorSlugMap.has(ba.authors.display_name)) {
      authorSlugMap.set(ba.authors.display_name, ba.authors.slug ?? null)
    }
  }
  const authorCounts = new Map<string, number>()
  for (const ban of bans) {
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

  // ── Top reasons ────────────────────────────────────────────────────
  const reasonCounts = new Map<string, number>()
  for (const ban of bans) {
    for (const link of ban.ban_reason_links) {
      const slug = link.reasons?.slug
      if (slug) reasonCounts.set(slug, (reasonCounts.get(slug) ?? 0) + 1)
    }
  }
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, count]) => ({ slug, count }))
  const maxReason = topReasons[0]?.count ?? 1

  // ── Timeline by decade ─────────────────────────────────────────────
  const decadeCounts = new Map<number, number>()
  for (const ban of bans) {
    if (!ban.year_started || ban.year_started < 1000) continue
    const decade = Math.floor(ban.year_started / 10) * 10
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1)
  }
  const decades = [...decadeCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ decade, count }))
  const maxDecade = Math.max(...decades.map(d => d.count), 1)
  const bansWithYear = bans.filter(b => b.year_started && b.year_started >= 1000).length
  const bansWithoutYear = bans.length - bansWithYear

  // ── Active vs historical ───────────────────────────────────────────
  const activeBans = bans.filter(b => b.status === 'active').length
  const historicalBans = bans.length - activeBans

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">

      {/* ── 1. Hero ── */}
      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-12 rounded-r-xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">The State of Literary Censorship</h1>
        <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
          Books have been banned, burned, and suppressed by governments, churches, and school boards for
          as long as they have been written. This catalogue documents{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{(totalBooks ?? 0).toLocaleString()} books</span> and{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{(totalBans ?? 0).toLocaleString()} bans</span> across{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{countryCounts.size} countries</span> — from
          Ancient Rome&apos;s book burnings to today&apos;s school board removals in the American South.
        </p>
      </div>

      {/* ── 1. Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {[
          { label: 'Books catalogued',       value: (totalBooks ?? 0).toLocaleString() },
          { label: 'Total bans recorded',    value: (totalBans ?? 0).toLocaleString() },
          { label: 'Countries & territories',value: countryCounts.size.toString() },
          { label: 'Currently banned',       value: activeBans.toLocaleString(), sub: `${historicalBans.toLocaleString()} lifted` },
        ].map(stat => (
          <div key={stat.label} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold tabular-nums text-brand">{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</div>
            {stat.sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── 2. Where bans are concentrated (compact top 5) ── */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-4">Where bans are concentrated</h2>
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
      </section>

      {/* ── 3. Authors ── */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-1">The Authors They Wanted Silenced</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-5">
          Authors whose work has been repeatedly challenged or banned across institutions and borders.
        </p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {topAuthors.map((a, i) => (
            <div
              key={a.name}
              className="relative group border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              {/* Background data bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-r-sm pointer-events-none bg-brand"
                style={{ width: `${(a.count / maxAuthor * 100).toFixed(1)}%`, opacity: 0.08 }}
              />
              {/* Row content */}
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

      {/* ── 4. Why Books Get Banned ── */}
      <section className="mb-14">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold">Why Books Get Banned</h2>
          <Link href="/reasons" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">All reasons →</Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-2xl leading-relaxed">
          The stated reasons for banning a book reveal as much about the censor as the censored.
          Sexual content and obscenity charges have been used to suppress everything from D.H. Lawrence
          to Lady Chatterley&apos;s Lover. Political bans have targeted anyone from Soviet dissidents to
          American students writing about civil rights.
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

      {/* ── 5. Bans Through History (timeline) ── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-5">Bans Through History</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-2xl leading-relaxed">
          Literary censorship is not a recent phenomenon. The Catholic Church&apos;s Index Librorum Prohibitorum
          ran from 1559 to 1966. The 20th century saw surges under fascism, communism, and McCarthyism.
          The 2020s spike reflects a wave of school board book removals in the United States, with the ALA
          reporting record numbers of book challenges in 2021, 2022, and 2023.
          {bansWithoutYear > 0 && (
            <> ({bansWithoutYear.toLocaleString()} bans in this catalogue have no recorded year and are excluded from this chart.)</>
          )}
        </p>
        <div className="overflow-x-auto pb-1" dir="rtl">
          <div className="inline-flex items-end gap-1 min-w-max" style={{ height: '9rem' }} dir="ltr">
            {decades.map((d, i) => {
              const isOngoing = d.decade === CURRENT_DECADE
              const barH = Math.max(Math.round(d.count / maxDecade * 112), 4)
              // On mobile show every other label; use CSS classes
              const labelClass = i % 2 === 0
                ? 'text-[10px] text-gray-400 dark:text-gray-500 tabular-nums'
                : 'text-[10px] text-gray-400 dark:text-gray-500 tabular-nums hidden md:block'
              return (
                <div key={d.decade} className="flex flex-col items-center shrink-0" style={{ width: '2.5rem' }}>
                  {isOngoing && (
                    <span className="text-[9px] text-brand font-medium mb-0.5 leading-none">now</span>
                  )}
                  <div className="flex-1 flex items-end">
                    <div
                      className={`w-8 rounded-t transition-all ${isOngoing ? 'bg-brand' : 'bg-red-500 dark:bg-red-600'}`}
                      style={{ height: `${barH}px` }}
                      title={`${d.decade}s: ${d.count} ban${d.count !== 1 ? 's' : ''}`}
                    />
                  </div>
                  <span className={labelClass}>{d.decade}s</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 6. Closing disclaimer ── */}
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
