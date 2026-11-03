import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound } from 'next/navigation'
import PageviewTracker from '@/components/pageview-tracker'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import YearBookRow from '@/components/year-book-row'
import YearMoreBooks from '@/components/year-more-books'
import { adminClient } from '@/lib/supabase'
import { countryFlag, getYearBooks, YEAR_LIST_CAP as LIST_CAP } from '@/lib/year-books'

export const revalidate = 86400

const CURRENT_YEAR = new Date().getFullYear()
const FIRST_YEAR = 2000
// Rendered rows cap (YEAR_LIST_CAP, lib/year-books.ts). Each row is ~3.5 KB of
// HTML+RSC (cover image markup) and the ISR fallback body must stay under
// Vercel's 20 MB: 2025 reached 6,600 books (23.9 MB) after the Texas 2025–26
// import. 250 keeps the page near the ~300 KB of the other hubs; the rest loads
// on demand via <YearMoreBooks> → /api/banned-books/[year]. Counts, lead and FAQ
// use the full set.

export async function generateStaticParams() {
  const years = []
  for (let y = 2015; y <= CURRENT_YEAR; y++) {
    years.push({ year: String(y) })
  }
  return years
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>
}): Promise<Metadata> {
  const { year } = await params
  const yearNum = parseInt(year, 10)
  // Distinct books with a ban starting this year, for the snippet. Paged
  // book_id-only sweep: a single capped read (the old .limit(5000), itself cut
  // to 1000 by PostgREST) reported 891 titles for 2025 instead of 6,608.
  let n = 0
  if (Number.isFinite(yearNum)) {
    const ids = new Set<number>()
    for (let offset = 0; ; offset += 1000) {
      const { data } = await adminClient().from('bans').select('book_id').eq('year_started', yearNum)
        .order('id', { ascending: true }).range(offset, offset + 999)
      for (const r of (data ?? []) as { book_id: number }[]) ids.add(r.book_id)
      if (!data || data.length < 1000) break
    }
    n = ids.size
  }
  const isCurrent = yearNum === CURRENT_YEAR
  const title = isCurrent
    ? `Banned Books ${year}: the list so far`
    : n > LIST_CAP ? `Books banned in ${year} – the most-banned titles` : `Books banned in ${year} – the full list`
  const description = n > 0
    ? `Which books were banned in ${year}? ${n.toLocaleString('en')} ${n === 1 ? 'title' : 'titles'} with a documented ban starting in ${year}${isCurrent ? ' (updated weekly)' : ''} — by country and reason, each with its source.`
    : `Every book with a documented ban that began in ${year}, grouped by country — with the censorship reason, scope, and the full source citations behind each entry.`
  return {
    title,
    description,
    alternates: { canonical: `/banned-books/${year}` },
  }
}

export default async function BannedBooksYearPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const yearNum = parseInt(year, 10)

  if (Number.isNaN(yearNum) || yearNum < 1000 || yearNum > CURRENT_YEAR + 1) notFound()

  const { books, banCount, countryTotals } = await getYearBooks(yearNum)
  const shownBooks = books.slice(0, LIST_CAP)
  const topCountries = countryTotals.slice(0, 10)

  // Prev / next year nav (only if within range)
  const prevYear = yearNum - 1 >= FIRST_YEAR ? yearNum - 1 : null
  const nextYear = yearNum + 1 <= CURRENT_YEAR ? yearNum + 1 : null

  // ── Direct-answer lead + CollectionPage + FAQPage JSON-LD ────────────────
  // Same SEO pattern as book/author/country/reason: prose-lead in viewport
  // + FAQ schema for People-Also-Ask. Year-specific queries
  // ("books banned in 2024", "what books were banned in 2017") hit this
  // route directly.
  const collectionUrl = `https://www.banned-books.org/banned-books/${year}`
  const topCountryNames = topCountries.slice(0, 3).map(([, v]) => v.name)
  let yearLead: string | null = null
  if (books.length > 0) {
    const head = `${books.length} ${books.length === 1 ? 'book had a documented ban' : 'books had documented bans'} starting in ${year}, across ${countryTotals.length} ${countryTotals.length === 1 ? 'country' : 'countries'} and totalling ${banCount} ${banCount === 1 ? 'ban' : 'bans'}`
    yearLead = topCountryNames.length >= 2
      ? `${head}. The countries with the most documented bans were ${topCountryNames.join(', ')}.`
      : `${head}.`
  }

  const collectionJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Books Banned in ${year}`,
    url: collectionUrl,
    mainEntityOfPage: collectionUrl,
  }
  if (yearLead) collectionJsonLd.description = yearLead
  if (books.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: books.length,
      itemListElement: books.slice(0, 50).map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    }
  }

  const yearFaq: { q: string; a: string }[] = []
  if (books.length > 0) {
    yearFaq.push({
      q: `How many books were banned in ${year}?`,
      a: `${books.length} ${books.length === 1 ? 'book' : 'books'} in this catalogue had a documented ban starting in ${year}, with ${banCount} total ${banCount === 1 ? 'ban' : 'bans'} across ${countryTotals.length} ${countryTotals.length === 1 ? 'country' : 'countries'}.`,
    })
  }
  if (topCountryNames.length >= 2) {
    yearFaq.push({
      q: `Which countries banned the most books in ${year}?`,
      a: `The countries with the most documented bans starting in ${year} were ${topCountries.slice(0, 5).map(([, v]) => `${v.name} (${v.count})`).join(', ')}.`,
    })
  }
  if (books.length >= 3) {
    yearFaq.push({
      q: `What books were banned in ${year}?`,
      a: `Examples of books banned in ${year} include ${books.slice(0, 5).map(b => b.title).join(', ')}.`,
    })
  }
  const faqJsonLd = yearFaq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: yearFaq.map(it => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  } : null

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  if (books.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/stats" className="text-sm text-gray-500 hover:text-gray-900 mb-8 inline-block transition-colors">
          ← Stats
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Books Banned in {year}</h1>
        <p className="text-gray-500">No bans with a recorded start year of {year} in our catalogue.</p>
        <div className="flex gap-4 mt-6 text-sm">
          {prevYear && <Link href={`/banned-books/${prevYear}`} className="text-brand hover:underline">← {prevYear}</Link>}
          {nextYear && <Link href={`/banned-books/${nextYear}`} className="text-brand hover:underline">{nextYear} →</Link>}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <BreadcrumbJsonLd items={[{ label: 'Home', href: '/' }, { label: 'Banned books by year', href: '/banned-books' }, { label: String(yearNum) }]} />
      <PageviewTracker entityType="page" path={`/banned-books/${yearNum}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(collectionJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(faqJsonLd) }}
        />
      )}
      <Link href="/stats" className="text-sm text-gray-500 hover:text-gray-900 mb-8 inline-block transition-colors">
        ← Stats
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap pb-6 border-b border-neutral-200">
        <div>
          <p className="text-sm uppercase tracking-[0.12em] font-semibold text-oxblood mb-3.5">By year · {year}</p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 mb-2">
            Books banned in {year}.
          </h1>
          <p className="text-neutral-600 text-sm">
            {books.length} {books.length === 1 ? 'book' : 'books'}, {banCount} {banCount === 1 ? 'ban' : 'bans'} documented
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0 mt-1">
          {prevYear && (
            <Link href={`/banned-books/${prevYear}`} className="text-neutral-500 hover:text-oxblood transition-colors">
              ← {prevYear}
            </Link>
          )}
          {nextYear && (
            <Link href={`/banned-books/${nextYear}`} className="text-neutral-500 hover:text-oxblood transition-colors">
              {nextYear} →
            </Link>
          )}
        </div>
      </div>

      {/* Direct-answer lead — AI-Overview eligible TL;DR above the book list. */}
      {yearLead && (
        <p className="mb-6 text-base text-gray-800 leading-relaxed border-l-4 border-red-300 pl-4">
          {yearLead}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Book list */}
        <div className="flex-1 min-w-0 divide-y divide-gray-100">
          {shownBooks.map((book, i) => (
            <YearBookRow key={book.id} book={book} rank={i + 1} />
          ))}
          {books.length > shownBooks.length && (
            <YearMoreBooks year={yearNum} shown={shownBooks.length} total={books.length} />
          )}
        </div>

        {/* Country sidebar */}
        {topCountries.length > 0 && (
          <aside className="lg:w-52 shrink-0">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              By country
            </h2>
            <div className="space-y-1.5">
              {topCountries.map(([code, { name, count }]) => (
                <Link
                  key={code}
                  href={`/countries/${code.toLowerCase()}`}
                  className="flex items-center justify-between gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors group"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{countryFlag(code)}</span>
                    <span className="truncate group-hover:underline">{name}</span>
                  </span>
                  <span className="text-xs tabular-nums text-gray-400 shrink-0">{count}</span>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}
