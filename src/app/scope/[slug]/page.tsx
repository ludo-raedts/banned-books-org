// ISR: same migration rationale as country/reason detail. No per-request
// mutations on this page; bans/books lists change on enrichment cycles
// or new imports — both lower-frequency than 3600s.
export const revalidate = 3600

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import CitationBlock from '@/components/citation-block'
import FaqSection from '@/components/home/FaqSection'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import { buildCitationMeta } from '@/lib/citation-meta'
import { coverAlt } from '@/lib/cover-alt'
import {
  SCOPE_INTROS,
  PSEUDO_REGIONS,
  buildScopeLead,
  buildScopeFaq,
  scopeFaqTitle,
} from '@/lib/scope-meta'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const dbSlug = slug.replace(/-/g, '_')
  const supabase = adminClient()

  const { data: scope } = await supabase
    .from('scopes')
    .select('id, label_en, slug')
    .eq('slug', dbSlug)
    .single()

  if (!scope) return {}

  // Headline distinct-book count for the description. One paginated sweep
  // because there's no MV per scope; cheap-ish (rows are ≤ ~11k for school).
  let page = 0
  const bookIds = new Set<number>()
  while (true) {
    const { data } = await supabase
      .from('bans')
      .select('book_id')
      .eq('scope_id', scope.id)
      .order('id')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    for (const r of data as { book_id: number }[]) bookIds.add(r.book_id)
    if (data.length < 1000) break
    page++
  }
  const distinctBooks = bookIds.size

  const titlePhrase = scopeFaqTitle(scope.slug, scope.label_en)
  const title = scope.slug === 'school'
    ? `Books banned in U.S. schools – every documented case`
    : `Books banned: ${titlePhrase}`

  let description = scope.slug === 'school'
    ? `${distinctBooks.toLocaleString('en')} books removed, restricted, or challenged in U.S. schools — by district, state, reason, and year.`
    : `${distinctBooks.toLocaleString('en')} ${distinctBooks === 1 ? 'book' : 'books'} documented as banned, restricted, or challenged via ${titlePhrase}.`
  if (description.length > 160) description = description.slice(0, 157) + '…'

  const canonicalUrl = `https://www.banned-books.org/scope/${slug}`
  return {
    title,
    description,
    alternates: { canonical: `/scope/${slug}` },
    openGraph: { title, description },
    other: buildCitationMeta({
      entityType: 'scope',
      title: `Book bans in ${scope.label_en.toLowerCase()} settings`,
      url: canonicalUrl,
    }),
  }
}

type BookCard = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans?: {
    id: number
    year_started: number | null
    status: string
    country_code: string
    region: string | null
    institution: string | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]
}

function authorName(book: BookCard): string {
  return book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')
}

export default async function ScopePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dbSlug = slug.replace(/-/g, '_')
  const supabase = adminClient()

  const { data: scope, error: scopeError } = await supabase
    .from('scopes')
    .select('id, slug, label_en')
    .eq('slug', dbSlug)
    .single()

  if (scopeError || !scope) notFound()

  // ── Single sweep over all bans for this scope ────────────────────────────
  // Collects everything needed downstream: per-book counts (for "most-banned
  // in this scope"), per-reason counts, year distribution for the timeline,
  // action_type breakdown, region/institution distributions, country mix.
  type BanRow = {
    book_id: number
    year_started: number | null
    action_type: string
    status: string
    country_code: string
    region: string | null
    institution: string | null
    ban_reason_links: { reason_id: number }[]
  }

  const reasonCounts = new Map<number, number>()
  const yearCounts = new Map<number, number>()
  const actionCounts = new Map<string, number>()
  const regionCounts = new Map<string, number>()        // "US:Florida" -> n
  const institutionCounts = new Map<string, { count: number; region: string | null; country: string }>()
  const countryCounts = new Map<string, number>()
  // Book-level ranking is fetched from mv_book_scope_counts below — it splits
  // bans into district / state / aggregate dimensions so PEN per-district data
  // doesn't drown out books whose only ban-row is a Wikipedia/ALA aggregate
  // (Catcher in the Rye, Maus, etc.). The sweep still counts rows for
  // totalBans (= "X documented events" copy) and for the region/institution
  // panels, which already filter NULLs correctly.
  let totalBans = 0
  let activeBans = 0
  let historicalBans = 0
  let earliestYear: number | null = null
  let latestYear: number | null = null

  {
    let page = 0
    while (true) {
      const { data, error } = await supabase
        .from('bans')
        .select('book_id, year_started, action_type, status, country_code, region, institution, ban_reason_links(reason_id)')
        .eq('scope_id', scope.id)
        .order('id')
        .range(page * 1000, page * 1000 + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const r of data as unknown as BanRow[]) {
        totalBans++
        if (r.status === 'active') activeBans++
        else if (r.status === 'historical') historicalBans++
        actionCounts.set(r.action_type, (actionCounts.get(r.action_type) ?? 0) + 1)
        countryCounts.set(r.country_code, (countryCounts.get(r.country_code) ?? 0) + 1)
        if (r.year_started) {
          yearCounts.set(r.year_started, (yearCounts.get(r.year_started) ?? 0) + 1)
          if (earliestYear === null || r.year_started < earliestYear) earliestYear = r.year_started
          if (latestYear === null || r.year_started > latestYear) latestYear = r.year_started
        }
        if (r.region) {
          const key = `${r.country_code}:${r.region}`
          regionCounts.set(key, (regionCounts.get(key) ?? 0) + 1)
        }
        if (r.institution) {
          const entry = institutionCounts.get(r.institution) ?? { count: 0, region: r.region, country: r.country_code }
          entry.count++
          institutionCounts.set(r.institution, entry)
        }
        for (const link of r.ban_reason_links ?? []) {
          reasonCounts.set(link.reason_id, (reasonCounts.get(link.reason_id) ?? 0) + 1)
        }
      }
      if (data.length < 1000) break
      page++
    }
  }

  // distinct books AND top-N ranking both come from the MV.
  // Ranking key: granular events (district + state) win over aggregate-only
  // rows. Aggregate counts are kept as final tiebreaker so the 232 books
  // whose only school-scope row is an aggregate (classic banned-book canon)
  // still have a stable order rather than getting shuffled by id.
  // Split into two requests so we don't pull all ~3.9k school-scope rows
  // just to slice the top 12.
  type ScopeCountRow = { book_id: number; district_events: number; state_events: number; aggregate_events: number }
  const [{ count: distinctBooksCount }, { data: topRows }] = await Promise.all([
    supabase
      .from('mv_book_scope_counts')
      .select('book_id', { count: 'exact', head: true })
      .eq('scope_id', scope.id),
    supabase
      .from('mv_book_scope_counts')
      .select('book_id, district_events, state_events, aggregate_events')
      .eq('scope_id', scope.id)
      .order('district_events', { ascending: false })
      .order('state_events', { ascending: false })
      .order('aggregate_events', { ascending: false })
      .limit(12),
  ])

  const scopeCounts = (topRows ?? []) as ScopeCountRow[]
  const distinctBooks = distinctBooksCount ?? 0

  // ── Resolve top reason slugs ─────────────────────────────────────────────
  const topReasonIdRows = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
  let topReasons: { slug: string; count: number }[] = []
  if (topReasonIdRows.length > 0) {
    const { data: reasonRows } = await supabase
      .from('reasons')
      .select('id, slug')
      .in('id', topReasonIdRows.map(([id]) => id))
    const slugMap = new Map(((reasonRows ?? []) as { id: number; slug: string }[]).map((r) => [r.id, r.slug]))
    topReasons = topReasonIdRows
      .map(([id, count]) => ({ slug: slugMap.get(id) ?? '', count }))
      .filter((r) => r.slug !== '')
  }

  // ── Top "most banned in this scope" books — ranked + labelled by the MV ──
  // The badge shows the granular-event count (district + state). For the rare
  // book whose only ban-row in this scope is an aggregate (Wikipedia/ALA),
  // we show "documented" instead — same rank stability, honest label.
  const topScopeCounts = scopeCounts.slice(0, 12)
  let topBooks: (BookCard & { banCount: number; granular: number; aggregateOnly: boolean })[] = []
  if (topScopeCounts.length > 0) {
    const { data: topBookRows } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, description, first_published_year, genres,
        book_authors(authors(display_name))
      `)
      .in('id', topScopeCounts.map(r => r.book_id))
    const map = new Map(((topBookRows ?? []) as unknown as BookCard[]).map((b) => [b.id, b]))
    topBooks = topScopeCounts
      .map(r => {
        const b = map.get(r.book_id)
        if (!b) return null
        const granular = r.district_events + r.state_events
        return {
          ...b,
          banCount: granular > 0 ? granular : r.aggregate_events,
          granular,
          aggregateOnly: granular === 0,
        }
      })
      .filter((b): b is BookCard & { banCount: number; granular: number; aggregateOnly: boolean } => b !== null)
  }
  const topBookIdSet = new Set(topBooks.map((b) => b.id))

  // ── A–Z grid, first 100 (paginated to avoid the 3.9k-row payload bug) ───
  // bans!inner is still needed to filter to books that actually have a ban
  // in this scope, but we don't render any per-ban detail in the compact
  // index grid — so only `id` comes back, not the full reason/region payload.
  const { data: alphaBooksRaw } = await supabase
    .from('books')
    .select(`
      id, title, slug, cover_url, first_published_year,
      book_authors(authors(display_name)),
      bans!inner(id)
    `)
    .eq('bans.scope_id', scope.id)
    .order('title')
    .range(0, 99)
  const alphaBooks = (alphaBooksRaw as unknown as BookCard[]) ?? []

  // ── Top US states (filter pseudo-region "Nation") ────────────────────────
  const topStates = [...regionCounts.entries()]
    .filter(([k]) => k.startsWith('US:'))
    .map(([k, count]) => ({ state: k.slice(3), count }))
    .filter((s) => !PSEUDO_REGIONS.has(s.state))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ── Top institutions (districts) ────────────────────────────────────────
  const topInstitutions = [...institutionCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, meta]) => ({ name, count: meta.count, region: meta.region, country: meta.country }))

  // ── Top countries (for non-school scopes; school is US-dominated) ───────
  const topCountryCodeCounts = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  let countryNameMap = new Map<string, string>()
  if (topCountryCodeCounts.length > 0) {
    const { data: cRows } = await supabase
      .from('countries')
      .select('code, name_en')
      .in('code', topCountryCodeCounts.map(([c]) => c))
    countryNameMap = new Map(((cRows ?? []) as { code: string; name_en: string }[]).map((c) => [c.code, c.name_en]))
  }
  const topCountryNames = topCountryCodeCounts.map(([c]) => countryNameMap.get(c) ?? c)

  // ── Timeline buckets ────────────────────────────────────────────────────
  // Two-phase decision:
  //  1. Filter year buckets to "dense" years (≥0.5% of the peak year). For
  //     school that collapses the long pre-2020 tail of one-off events.
  //  2. If the dense range plus ~5 years of historical context fits in
  //     ≤30 bars, render per-year (filling in zero-count years inside the
  //     window so the spike reads as a spike, not a single bar). Otherwise
  //     fall back to per-decade — for scopes whose data really is spread
  //     across centuries (government, church) decades make more sense.
  const yearMax = Math.max(...yearCounts.values(), 1)
  const minYearShare = 0.005
  const minYearCount = Math.max(2, Math.ceil(yearMax * minYearShare))
  const denseYearKeys = [...yearCounts.entries()]
    .filter(([, count]) => count >= minYearCount)
    .map(([y]) => y)

  type TimelineBucket = { key: number; count: number }
  let timeline: TimelineBucket[] = []
  let droppedBucketCount = 0
  let useYears = false

  if (denseYearKeys.length >= 1) {
    const minDense = Math.min(...denseYearKeys)
    const maxDense = Math.max(...denseYearKeys)
    // Show up to 5 years before the first dense year as historical context.
    const earliestObserved = Math.min(...yearCounts.keys())
    const contextStart = Math.max(minDense - 5, earliestObserved)
    const windowWidth = maxDense - contextStart + 1
    if (windowWidth <= 30) {
      const filled: TimelineBucket[] = []
      for (let y = contextStart; y <= maxDense; y++) {
        filled.push({ key: y, count: yearCounts.get(y) ?? 0 })
      }
      timeline = filled
      useYears = true
      droppedBucketCount = [...yearCounts.entries()].filter(([y]) => y < contextStart).length
    }
  }

  if (!useYears) {
    // Decade fallback, threshold-filtered to suppress sparse outliers.
    const decadeCounts = new Map<number, number>()
    for (const [y, count] of yearCounts.entries()) {
      const key = Math.floor(y / 10) * 10
      decadeCounts.set(key, (decadeCounts.get(key) ?? 0) + count)
    }
    const decadeMax = Math.max(...decadeCounts.values(), 1)
    const minDecadeCount = Math.max(2, Math.ceil(decadeMax * minYearShare))
    timeline = [...decadeCounts.entries()]
      .filter(([, count]) => count >= minDecadeCount)
      .sort((a, b) => a[0] - b[0])
      .map(([k, count]) => ({ key: k, count }))
    droppedBucketCount = decadeCounts.size - timeline.length
  }
  const maxTimeline = Math.max(...timeline.map((t) => t.count), 1)

  // ── Editorial copy ───────────────────────────────────────────────────────
  const intro = SCOPE_INTROS[scope.slug] ?? null
  const lead = buildScopeLead({
    scopeSlug: scope.slug,
    scopeLabel: scope.label_en,
    distinctBooks,
    totalBans,
    earliestYear,
    latestYear,
    topReasonSlugs: topReasons.map((r) => r.slug),
    topStateNames: topStates.slice(0, 3).map((s) => s.state),
    topCountryNames,
  })

  const faqItems = buildScopeFaq({
    scopeSlug: scope.slug,
    scopeLabel: scope.label_en,
    distinctBooks,
    totalBans,
    earliestYear,
    latestYear,
    topReasonSlugs: topReasons.map((r) => r.slug),
    topStateNames: topStates.slice(0, 5).map((s) => s.state),
    topBookTitles: topBooks.slice(0, 5).map((b) => b.title),
    activeBans,
    historicalBans,
  })

  // ── CollectionPage JSON-LD ──────────────────────────────────────────────
  const collectionUrl = `https://www.banned-books.org/scope/${slug}`
  const collectionJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Books banned: ${scope.label_en}`,
    url: collectionUrl,
    mainEntityOfPage: collectionUrl,
  }
  if (lead) collectionJsonLd.description = lead
  if (topBooks.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: distinctBooks,
      itemListElement: topBooks.slice(0, 12).map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    }
  }
  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  // Action-type breakdown — kept inline rather than a component because
  // it's a one-liner stat row, not a chart.
  const banned = actionCounts.get('banned') ?? 0
  const restricted = actionCounts.get('restricted') ?? 0
  const challenged = actionCounts.get('challenged') ?? 0
  const removed = actionCounts.get('removed') ?? 0
  const blocked = actionCounts.get('blocked') ?? 0

  // Top-12 book rows shaped for BookCardCompact (homepage white-card pattern).
  // We collapse our richer BookCard into the leaner TopListBook shape so the
  // scope page inherits the same card chrome (serif title, oxblood hover,
  // 2:3 aspect ratio) as the homepage rails.
  const topBookCards = topBooks.map((b) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    cover_url: b.cover_url,
    author: authorName(b),
    // For books whose only ban in this scope is an aggregate-source row
    // (Wikipedia/ALA — no district or state info), show "documented" rather
    // than an inflated "1 event" that competes with PEN per-district counts.
    context: b.aggregateOnly
      ? 'historically documented'
      : `${b.banCount.toLocaleString('en')} documented ${b.banCount === 1 ? 'event' : 'events'}`,
  }))

  // Hero stat row — mirrors HeroSection's stat tile pattern from the
  // homepage. distinctBooks is the headline, totalBans is the volume
  // signal, and we add geography / time / reason variety so each tile
  // earns its place rather than restating the same datum.
  const stateCount = topStates.length > 0
    ? [...regionCounts.entries()].filter(([k, c]) => k.startsWith('US:') && !PSEUDO_REGIONS.has(k.slice(3)) && c > 0).length
    : 0
  const reasonVariety = topReasons.length
  const districtCount = institutionCounts.size

  type Stat = { value: string; label: string }
  const heroStats: Stat[] = []
  heroStats.push({ value: distinctBooks.toLocaleString('en'), label: distinctBooks === 1 ? 'Book' : 'Books' })
  heroStats.push({ value: totalBans.toLocaleString('en'), label: 'Documented events' })
  if (stateCount > 0) heroStats.push({ value: stateCount.toLocaleString('en'), label: stateCount === 1 ? 'U.S. state' : 'U.S. states' })
  else if (countryCounts.size > 0) heroStats.push({ value: countryCounts.size.toLocaleString('en'), label: countryCounts.size === 1 ? 'Country' : 'Countries' })
  if (districtCount > 0) heroStats.push({ value: districtCount.toLocaleString('en'), label: districtCount === 1 ? 'District' : 'Districts' })
  if (reasonVariety > 0) heroStats.push({ value: reasonVariety.toLocaleString('en'), label: reasonVariety === 1 ? 'Reason' : 'Reasons' })

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(collectionJsonLd) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>
            {scope.slug === 'school'
              ? 'Scope · U.S. K–12 schools'
              : `Scope · ${scope.label_en}`}
          </Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            {scope.slug === 'school'
              ? 'Books banned in U.S. schools.'
              : `${scope.label_en} bans.`}
          </h1>

          <div className="max-w-[820px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {lead && (
              <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
                {lead}
              </p>
            )}

            {intro && (
              <p className="mt-5 text-sm md:text-base leading-relaxed text-gray-700">
                {intro}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Most banned in this scope (top 12) ──────────────────────────── */}
      {topBookCards.length > 0 && (
        <SectionShell tone="cream" eyebrow="Ranked by event count">
          <SectionHeader
            title={
              scope.slug === 'school'
                ? 'Most banned in U.S. schools'
                : `Most banned via ${scopeFaqTitle(scope.slug, scope.label_en)}`
            }
            subtitle="Titles affected by the largest number of documented events."
            accent="oxblood"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {topBookCards.map((b) => (
              <BookCardCompact key={b.id} book={b} />
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Where bans happen — states + districts side-by-side ─────────── */}
      {(topStates.length >= 3 || topInstitutions.length >= 3) && (
        <SectionShell tone="white" eyebrow="By location">
          <SectionHeader
            title={
              scope.slug === 'school'
                ? 'Where school bans happen'
                : 'Where bans happen'
            }
            subtitle="Concentrations by U.S. state and by individual district."
            accent="black"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
            {topStates.length >= 3 && (
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-3">
                  Top U.S. states
                </p>
                <ol className="divide-y divide-neutral-200">
                  {topStates.map((s) => (
                    <li key={s.state} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="font-serif text-base text-gray-900">{s.state}</span>
                      <span className="text-xs tabular-nums text-neutral-500">{s.count.toLocaleString('en')}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {topInstitutions.length >= 3 && (
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-3">
                  Most active districts
                </p>
                <ol className="divide-y divide-neutral-200">
                  {topInstitutions.map((d) => (
                    <li key={d.name} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 font-serif text-base text-gray-900 truncate">
                        {d.name}
                        {d.region && (
                          <span className="text-neutral-500 font-sans text-sm not-italic"> · {d.region}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">{d.count.toLocaleString('en')}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[11px] text-neutral-500">
                  Based on {[...institutionCounts.values()].reduce((s, e) => s + e.count, 0).toLocaleString('en')} events with district information.
                </p>
              </div>
            )}
          </div>
        </SectionShell>
      )}

      {/* ── When bans happen (timeline) ─────────────────────────────────── */}
      {timeline.length >= 3 && (
        <SectionShell tone="cream" eyebrow={`By time · ${useYears ? `${timeline[0].key}–${timeline[timeline.length-1].key}` : 'by decade'}`}>
          <SectionHeader
            title={
              scope.slug === 'school'
                ? 'When school book bans happen'
                : 'When bans happen'
            }
            subtitle={useYears ? 'One bar per year, drawn from the dense range of the dataset.' : 'One bar per decade across the dataset.'}
            accent="oxblood"
          />
          {/* Left-aligned; the chronological reading direction matches the
              x-axis labels. When the bar count exceeds the viewport, the
              user scrolls right to reach the recent years — no `dir=rtl`
              flip is needed because for narrow ranges (≤30 bars) the whole
              timeline fits on screen and rtl wastes space on the left. */}
          <div className="overflow-x-auto pb-2">
            <div className="inline-flex items-end gap-1.5 h-32">
              {timeline.map((t) => (
                <div
                  key={t.key}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  style={{ minWidth: useYears ? '2.25rem' : '3rem' }}
                >
                  <div
                    className="w-full rounded-t bg-oxblood"
                    style={{
                      height: `${((t.count / maxTimeline) * 104).toFixed(0)}px`,
                      minHeight: '2px',
                    }}
                    title={`${t.key}${useYears ? '' : 's'}: ${t.count.toLocaleString('en')}`}
                  />
                  <span className="text-[10px] text-neutral-600 tabular-nums">
                    {useYears ? t.key : `${t.key}s`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {droppedBucketCount > 0 && (
            <p className="text-[11px] text-neutral-500 mt-2">
              {droppedBucketCount} earlier {useYears ? (droppedBucketCount === 1 ? 'year' : 'years') : (droppedBucketCount === 1 ? 'decade' : 'decades')} with sparse data hidden for legibility.
            </p>
          )}
        </SectionShell>
      )}

      {/* ── Why books are banned (reasons + action types) ───────────────── */}
      {topReasons.length > 0 && (
        <SectionShell tone="white" eyebrow="By reason">
          <SectionHeader
            title={
              scope.slug === 'school'
                ? 'Why books are banned in schools'
                : 'Why books are banned'
            }
            subtitle="Reasons cited across the recorded events, with the action-type breakdown."
            accent="black"
          />
          <div className="flex flex-wrap gap-3 mb-8">
            {topReasons.map((r) => (
              <Link
                key={r.slug}
                href={`/reasons/${r.slug}`}
                className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <ReasonBadge slug={r.slug} />
                <span className="text-xs text-neutral-500 tabular-nums">{r.count.toLocaleString('en')}</span>
              </Link>
            ))}
          </div>

          {totalBans > 0 && (
            <div className="flex flex-wrap gap-x-10 gap-y-4 pt-6 border-t border-neutral-200">
              {[
                { v: banned, label: 'banned' },
                { v: restricted, label: 'restricted' },
                { v: challenged, label: 'challenged' },
                { v: removed, label: 'removed' },
                { v: blocked, label: 'blocked' },
              ]
                .filter((s) => s.v > 0)
                .map((s) => (
                  <div key={s.label}>
                    <div className="font-serif text-2xl md:text-3xl font-semibold text-gray-900 tabular-nums">
                      {s.v.toLocaleString('en')}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                      {s.label}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionShell>
      )}

      {/* ── Full catalogue (A–Z index) ──────────────────────────────────── */}
      {alphaBooks.length > 0 && (
        <SectionShell tone="cream" eyebrow="Full catalogue · A–Z">
          <SectionHeader
            title="All documented titles"
            subtitle={
              distinctBooks > 100
                ? `Showing the first 100 of ${distinctBooks.toLocaleString('en')} alphabetically. Use search to find a specific title.`
                : `All ${distinctBooks.toLocaleString('en')} titles, alphabetically.`
            }
            accent="black"
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {alphaBooks.filter((b) => !topBookIdSet.has(b.id)).map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.slug}`}
                className="group flex flex-col"
              >
                <div className="relative w-full aspect-[2/3] overflow-hidden rounded-sm bg-white border border-neutral-200">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={coverAlt(book.title, authorName(book), book.first_published_year)}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 130px, (min-width: 768px) 16vw, 30vw"
                    />
                  ) : (
                    <BookCoverPlaceholder
                      title={book.title}
                      author={authorName(book)}
                      slug={book.slug}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                </div>
                <h3 className="mt-2 font-serif text-xs font-medium leading-snug text-gray-900 group-hover:text-oxblood line-clamp-2 transition-colors">
                  {book.title}
                </h3>
              </Link>
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Citation ────────────────────────────────────────────────────── */}
      <SectionShell tone="white">
        <CitationBlock
          entityType="scope"
          entity={{ title: scope.label_en, slug }}
          url={`https://www.banned-books.org/scope/${slug}`}
        />
      </SectionShell>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <FaqSection
        items={faqItems}
        tone="cream"
        eyebrow={
          scope.slug === 'school'
            ? 'About U.S. school book bans'
            : `About ${scopeFaqTitle(scope.slug, scope.label_en)}`
        }
        title="Frequently asked."
      />
    </main>
  )
}
