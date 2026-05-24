// ISR: re-render every hour. Country pages have no per-request mutations
// or auth-gated content, so static caching is safe; the bans/books lists
// change on enrichment or new imports — both lower-frequency than 3600s.
export const revalidate = 3600

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import CitationBlock from '@/components/citation-block'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import FaqSection from '@/components/home/FaqSection'
import { buildCitationMeta } from '@/lib/citation-meta'
import { coverAlt } from '@/lib/cover-alt'
import { reasonPhrase } from '@/lib/reason-phrases'
import { buildCountryFaq, articulateCountryName } from '@/lib/country-faq'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  const upperCode = code.toUpperCase()
  const supabase = adminClient()

  // rows: 1 | fields: [name_en] | reason: page title
  // rows: 1 | fields: [distinct_books] | reason: distinct-book count for description
  // rows: ≤500 | fields: reason slugs | reason: count distinct reasons for description
  const [{ data: country }, { data: countryMv }, { data: reasonSample }] = await Promise.all([
    supabase.from('countries').select('name_en').eq('code', upperCode).single(),
    supabase.from('mv_ban_counts').select('distinct_books').eq('country_code', upperCode).maybeSingle(),
    supabase
      .from('bans')
      .select('ban_reason_links(reasons(slug))')
      .eq('country_code', upperCode)
      .limit(500),
  ])

  if (!country) return {}

  const banCount = (countryMv?.distinct_books as number | undefined) ?? 0
  const reasonSet = new Set<string>()
  for (const b of (reasonSample ?? []) as unknown as {
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]) {
    for (const l of b.ban_reason_links) {
      const s = l.reasons?.slug
      if (s) reasonSet.add(s)
    }
  }
  const reasonVariety = reasonSet.size

  const title = `Books banned in ${country.name_en} – censorship history and examples`

  let description: string
  if (banCount === 0) {
    description = `Books banned or challenged in ${country.name_en} — censorship history, dates, scope, and source citations for every documented entry.`
  } else if (reasonVariety > 1) {
    description = `${banCount} ${banCount === 1 ? 'book' : 'books'} banned or challenged in ${country.name_en}, spanning ${reasonVariety} distinct censorship reasons. Browse the catalogue: dates, scope, and source citations.`
  } else {
    description = `${banCount} ${banCount === 1 ? 'book' : 'books'} banned or challenged in ${country.name_en}. Browse the catalogue with dates, scope, and source citations on every entry.`
  }
  if (description.length > 160) description = description.slice(0, 157) + '…'

  const canonicalUrl = `https://www.banned-books.org/countries/${code.toLowerCase()}`
  return {
    title,
    description,
    alternates: { canonical: `/countries/${code.toLowerCase()}` },
    openGraph: { title, description },
    other: buildCitationMeta({
      entityType: 'country',
      title: `Book censorship in ${country.name_en}`,
      url: canonicalUrl,
    }),
  }
}

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: {
    id: number
    year_started: number | null
    status: string
    scopes: { label_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]
}

function authorName(book: Book): string {
  return book.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', ')
}

function countryFlag(code: string): string {
  if (code === 'SU') return '🚩'
  return [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const upperCode = code.toUpperCase()
  const supabase = adminClient()

  // rows: 1 | fields: [code, name_en, slug, description] | reason: country header + description
  const { data: country, error: ce } = await supabase
    .from('countries').select('code, name_en, slug, description').eq('code', upperCode).single()

  if (ce || !country) notFound()

  // rows: 1 | fields: [distinct_books, total_bans] | reason: header display
  const { data: countryMv } = await supabase
    .from('mv_ban_counts')
    .select('distinct_books, total_bans')
    .eq('country_code', upperCode)
    .maybeSingle()
  const distinctBooks = (countryMv?.distinct_books as number | undefined) ?? 0
  const totalBanEvents = (countryMv?.total_bans as number | undefined) ?? 0

  // rows: ≤100 | fields: book card data | reason: paginated grid; first page only
  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, slug, cover_url, description, first_published_year, genres,
      book_authors(authors(display_name)),
      bans!inner(
        id, year_started, status,
        scopes(label_en),
        ban_reason_links(reasons(slug))
      )
    `)
    .eq('bans.country_code', upperCode)
    .order('title')
    .range(0, 99)

  if (error) throw error
  const books = (data as unknown as Book[]) ?? []
  // Headline metric is distinct books banned. totalBanEvents is the raw ban-record
  // count (PEN America counts per US school district, so it can be much higher
  // than distinctBooks for the United States).
  const totalBanCount = distinctBooks

  // ── Related countries: find countries with most book overlap ──────────────────
  // Step 1: collect all book_ids banned in this country + reason frequencies (one paginated loop)
  let allBookIds: number[] = []
  const reasonIdCounts = new Map<number, number>()
  {
    let offset = 0
    while (true) {
      const { data: idRows } = await supabase
        .from('bans')
        .select('book_id, ban_reason_links(reason_id)')
        .eq('country_code', upperCode)
        .range(offset, offset + 999)
      if (!idRows || idRows.length === 0) break
      for (const row of idRows as unknown as { book_id: number; ban_reason_links: { reason_id: number }[] }[]) {
        allBookIds.push(row.book_id)
        for (const link of row.ban_reason_links ?? []) {
          reasonIdCounts.set(link.reason_id, (reasonIdCounts.get(link.reason_id) ?? 0) + 1)
        }
      }
      if (idRows.length < 1000) break
      offset += 1000
    }
  }

  // ── Top-12 most-banned books IN this country (by ban-row count) ─────────
  // PEN America counts US bans per district, so a single title can have
  // dozens of rows. That same multiplicity is exactly what makes a "Most
  // banned in [country]" ranking meaningful here. For countries with no
  // duplication (everywhere except the US), the count plateau at 1 so we
  // skip the section instead of displaying an arbitrary alphabetical top.
  const bookBanCounts = new Map<number, number>()
  for (const id of allBookIds) bookBanCounts.set(id, (bookBanCounts.get(id) ?? 0) + 1)
  const topBookByCount = [...bookBanCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  const showTopBooks = topBookByCount.length > 0 && topBookByCount[0][1] >= 2

  type TopBookRow = {
    id: number; title: string; slug: string; cover_url: string | null
    book_authors: { authors: { display_name: string } | null }[]
  }
  let topBookCards: Array<{
    id: number; title: string; slug: string; cover_url: string | null
    author: string; context: string
  }> = []
  if (showTopBooks) {
    const { data: topRows } = await supabase
      .from('books')
      .select('id, title, slug, cover_url, book_authors(authors(display_name))')
      .in('id', topBookByCount.map(([id]) => id))
    const rowMap = new Map(((topRows ?? []) as unknown as TopBookRow[]).map(r => [r.id, r]))
    topBookCards = topBookByCount
      .map(([id, count]) => {
        const r = rowMap.get(id)
        if (!r) return null
        return {
          id: r.id,
          title: r.title,
          slug: r.slug,
          cover_url: r.cover_url,
          author: r.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
          context: `${count.toLocaleString('en')} documented ${count === 1 ? 'event' : 'events'}`,
        }
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
  }
  const topBookIdSet = new Set(topBookCards.map(b => b.id))

  // Top 5 reasons in this country (by ban count)
  const top5ReasonIds = [...reasonIdCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  let topReasons: { slug: string; count: number }[] = []
  if (top5ReasonIds.length > 0) {
    const { data: reasonRows } = await supabase
      .from('reasons')
      .select('id, slug')
      .in('id', top5ReasonIds.map(([id]) => id))
    const slugMap = new Map((reasonRows ?? []).map(r => [r.id, r.slug]))
    topReasons = top5ReasonIds
      .map(([id, count]) => ({ slug: slugMap.get(id) ?? '', count }))
      .filter(r => r.slug !== '')
  }

  // Step 2: for those book_ids, find bans in other countries (batched parallel)
  const overlapCounts = new Map<string, number>()
  if (allBookIds.length > 0) {
    const CHUNK = 400
    const chunks: number[][] = []
    for (let i = 0; i < allBookIds.length; i += CHUNK) chunks.push(allBookIds.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map(chunk =>
        supabase.from('bans').select('country_code, book_id').in('book_id', chunk).neq('country_code', upperCode)
      )
    )
    for (const { data: rows } of results) {
      const seen = new Set<string>() // count each country once per book
      for (const row of (rows ?? []) as { country_code: string; book_id: number }[]) {
        const key = `${row.country_code}:${row.book_id}`
        if (!seen.has(key)) {
          seen.add(key)
          overlapCounts.set(row.country_code, (overlapCounts.get(row.country_code) ?? 0) + 1)
        }
      }
    }
  }

  // Step 3: pick top 5 and fetch their names
  const top5Codes = [...overlapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }))

  type RelatedCountry = { code: string; name_en: string; count: number }
  let relatedCountries: RelatedCountry[] = []
  if (top5Codes.length > 0) {
    const { data: names } = await supabase
      .from('countries').select('code, name_en').in('code', top5Codes.map(c => c.code))
    const nameMap = new Map((names ?? []).map(c => [c.code, c.name_en]))
    relatedCountries = top5Codes.map(({ code, count }) => ({
      code, count, name_en: nameMap.get(code) ?? code,
    }))
  }

  // Build timeline: bans by decade (or by year if ≤ 30 distinct years)
  const countryBansForTimeline = books.flatMap(b =>
    b.bans.map(ban => ban.year_started)
  ).filter((y): y is number => !!y)

  const yearCounts = new Map<number, number>()
  for (const y of countryBansForTimeline) yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1)
  const useYears = yearCounts.size <= 35
  const timelineCounts = new Map<number, number>()
  for (const y of countryBansForTimeline) {
    const key = useYears ? y : Math.floor(y / 10) * 10
    timelineCounts.set(key, (timelineCounts.get(key) ?? 0) + 1)
  }
  const timeline = [...timelineCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ key: k, count: v }))
  const maxTimeline = Math.max(...timeline.map(t => t.count), 1)

  // ── Direct-answer lead + FAQ + CollectionPage JSON-LD ────────────────────
  // Same SEO pattern as book detail: short prose answer in the first
  // viewport for AI Overview/Featured Snippet eligibility, plus FAQPage
  // schema for People-Also-Ask. CollectionPage with hasPart=ItemList
  // surfaces the catalogue to crawlers as a structured list rather than a
  // flat <div> of book covers.
  const earliestBanYear = countryBansForTimeline.length > 0
    ? Math.min(...countryBansForTimeline)
    : null
  const latestBanYear = countryBansForTimeline.length > 0
    ? Math.max(...countryBansForTimeline)
    : null
  const topReasonName = topReasons[0] ? reasonPhrase(topReasons[0].slug) : null

  let countryLead: string | null = null
  if (totalBanCount > 0) {
    const head = `${totalBanCount} ${totalBanCount === 1 ? 'book has' : 'books have'} been banned or challenged in ${country.name_en}`
    if (earliestBanYear && topReasonName) {
      countryLead = `${head} since ${earliestBanYear}, most often for ${topReasonName}.`
    } else if (earliestBanYear) {
      countryLead = `${head} since ${earliestBanYear}.`
    } else if (topReasonName) {
      countryLead = `${head}, most often for ${topReasonName}.`
    } else {
      countryLead = `${head}.`
    }
    if (topReasons.length >= 2) {
      const more = topReasons.slice(1, 3).map(r => reasonPhrase(r.slug)).join(' and ')
      if (more) countryLead += ` Documented bans also cite ${more}.`
    }
  }

  const collectionUrl = `https://www.banned-books.org/countries/${upperCode}`
  const collectionJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Books banned in ${country.name_en}`,
    url: collectionUrl,
    mainEntityOfPage: collectionUrl,
    about: {
      '@type': 'Place',
      name: country.name_en,
      identifier: upperCode,
    },
  }
  if (countryLead) collectionJsonLd.description = countryLead
  if (books.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: totalBanCount,
      itemListElement: books.slice(0, 50).map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    }
  }

  // ── Notable books: globally-famous bans that intersect this country ──────
  // The country `books` array is alphabetical (top 100 by title), so picking
  // its first 5 gave a weak "notable" answer — usually the latest
  // school-board removals at the front of the alphabet. Cross-reference
  // with v_top_banned_books (the global most-banned top 100, ordered by
  // worldwide ban count) and pick the country's books that are also
  // globally famous. If fewer than 3 hits, skip the question rather than
  // surface a misleading answer.
  const allBookIdsSet = new Set(allBookIds)
  const { data: globalTopBanned } = await supabase
    .from('v_top_banned_books')
    .select('entity_id, total_bans')
    .limit(100)
  const notableBookIds = ((globalTopBanned ?? []) as { entity_id: number; total_bans: number }[])
    .filter(r => allBookIdsSet.has(Number(r.entity_id)))
    .sort((a, b) => b.total_bans - a.total_bans)
    .slice(0, 5)
    .map(r => Number(r.entity_id))

  let notableBookTitles: string[] = []
  if (notableBookIds.length >= 3) {
    const { data: notableBooksRaw } = await supabase
      .from('books').select('id, title').in('id', notableBookIds)
    const titleMap = new Map(((notableBooksRaw ?? []) as { id: number; title: string }[]).map(b => [b.id, b.title]))
    notableBookTitles = notableBookIds.map(id => titleMap.get(id)).filter((t): t is string => !!t)
  }

  // FAQ: data-only for every country; editorial questions (who decides / can
  // I read / can I buy) added for top-5 countries in COUNTRY_FAQ_FACTS. The
  // FaqAccordion component renders the visible HTML AND emits FAQPage
  // JSON-LD from the same items array, so no separate ld+json block needed.
  const countryFaq = buildCountryFaq({
    countryCode: upperCode,
    countryName: country.name_en,
    totalBanCount,
    earliestBanYear,
    latestBanYear,
    topReasonNames: topReasons.map(r => reasonPhrase(r.slug)),
    notableBookTitles,
  })

  // Hero stats — same shape as /scope/[slug] and /reasons/[slug] for
  // cross-page visual consistency.
  type Stat = { value: string; label: string }
  const heroStats: Stat[] = []
  heroStats.push({ value: totalBanCount.toLocaleString('en'), label: totalBanCount === 1 ? 'Book' : 'Books' })
  if (totalBanEvents > totalBanCount) {
    heroStats.push({ value: totalBanEvents.toLocaleString('en'), label: 'Documented events' })
  }
  if (topReasons.length > 0) {
    heroStats.push({ value: topReasons.length.toLocaleString('en'), label: topReasons.length === 1 ? 'Reason' : 'Reasons' })
  }
  if (earliestBanYear && latestBanYear && latestBanYear > earliestBanYear) {
    heroStats.push({ value: `${earliestBanYear}–${latestBanYear}`, label: 'Span' })
  } else if (earliestBanYear) {
    heroStats.push({ value: String(earliestBanYear), label: 'Earliest record' })
  }

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(collectionJsonLd) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/countries"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All countries
          </Link>

          <Eyebrow>Country · {country.name_en}</Eyebrow>

          <div className="flex items-center gap-4">
            <span className="text-5xl md:text-6xl leading-none" aria-hidden="true">{countryFlag(upperCode)}</span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              Books banned in {country.name_en}.
            </h1>
          </div>

          <div className="max-w-[820px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              {heroStats.map(s => (
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

            {countryLead && (
              <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
                {countryLead}
              </p>
            )}

            {country.description && (
              <p className="mt-5 text-sm md:text-base leading-relaxed text-gray-700">
                {country.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Most banned in this country (top 12, only if rank-signal exists) ── */}
      {topBookCards.length > 0 && (
        <SectionShell tone="cream" eyebrow="Ranked by event count">
          <SectionHeader
            title={`Most banned in ${country.name_en}`}
            subtitle="Titles affected by the largest number of documented events in this jurisdiction."
            accent="oxblood"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {topBookCards.map(b => (
              <BookCardCompact key={b.id} book={b} />
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Why books are banned (reasons) ───────────────────────────── */}
      {topReasons.length > 0 && (
        <SectionShell tone={topBookCards.length > 0 ? 'white' : 'cream'} eyebrow="By reason">
          <SectionHeader
            title={`Why books are banned in ${country.name_en}`}
            subtitle="Most frequently cited reasons across the recorded events."
            accent="black"
          />
          <div className="flex flex-wrap gap-3">
            {topReasons.map(r => (
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
        </SectionShell>
      )}

      {/* ── When bans happen (timeline) ──────────────────────────────── */}
      {timeline.length >= 3 && (
        <SectionShell tone="cream" eyebrow={`By time · ${useYears ? 'by year' : 'by decade'}`}>
          <SectionHeader
            title={`When bans happen in ${country.name_en}`}
            subtitle={useYears ? 'One bar per year across the documented range.' : 'One bar per decade across the documented range.'}
            accent="oxblood"
          />
          <div className="overflow-x-auto pb-2">
            <div className="inline-flex items-end gap-1.5 h-32">
              {timeline.map(t => (
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
        </SectionShell>
      )}

      {/* ── Full catalogue (A–Z, dedup vs the top-12 row) ────────────── */}
      {books.length > 0 && (
        <SectionShell tone="white" eyebrow="Full catalogue · A–Z">
          <SectionHeader
            title={`All books banned in ${country.name_en}`}
            subtitle={
              totalBanCount > 100
                ? `Showing the first 100 of ${totalBanCount.toLocaleString('en')} alphabetically. Use search to find a specific title.`
                : `All ${totalBanCount.toLocaleString('en')} titles, alphabetically.`
            }
            accent="black"
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {books.filter(b => !topBookIdSet.has(b.id)).map((book) => (
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

      {/* ── Citation ────────────────────────────────────────────────── */}
      <SectionShell tone="cream">
        <CitationBlock
          entityType="country"
          entity={{
            title: country.name_en,
            slug: code.toLowerCase(),
            code: upperCode,
          }}
          url={`https://www.banned-books.org/countries/${code.toLowerCase()}`}
        />
      </SectionShell>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      {countryFaq.length > 0 && (
        <FaqSection
          items={countryFaq}
          tone="white"
          eyebrow={`About ${articulateCountryName(country.name_en)}`}
          title="Frequently asked."
        />
      )}

      {/* ── Related countries ────────────────────────────────────────── */}
      {relatedCountries.length > 0 && (
        <SectionShell tone="cream" eyebrow="Compare jurisdictions">
          <SectionHeader
            title="Countries with similar bans"
            subtitle="Other jurisdictions that have banned many of the same titles."
            accent="black"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {relatedCountries.map(rc => (
              <Link
                key={rc.code}
                href={`/countries/${rc.code.toLowerCase()}`}
                className="group flex items-center gap-3 px-4 py-3 bg-white border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
              >
                <span className="text-2xl leading-none" aria-hidden="true">{countryFlag(rc.code)}</span>
                <div className="min-w-0">
                  <p className="font-serif text-base font-medium text-gray-900 group-hover:text-oxblood transition-colors truncate">
                    {rc.name_en}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {rc.count.toLocaleString('en')} {rc.count === 1 ? 'book' : 'books'} in common
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </SectionShell>
      )}
    </main>
  )
}
