// ISR: re-render every hour. Same migration rationale as country detail:
// no per-request mutations, content changes on enrichment cycles.
export const revalidate = 3600

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { adminClient } from '@/lib/supabase'
import { coverAlt } from '@/lib/cover-alt'
import { reasonPhrase } from '@/lib/reason-phrases'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'
import ReasonControls from '@/components/reason-controls'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import FaqSection from '@/components/home/FaqSection'
import CitationBlock from '@/components/citation-block'
import type { FaqItem } from '@/components/faq-accordion'
import { BookshopListEmbed } from '@/components/bookshop-list-embed'
import { getBookshopListForReason, bookshopListUrl } from '@/lib/bookshop-lists'
import { getReadingClubThemeForReason } from '@/lib/reading-club-data'

// Long-form editorial intros per reason — anchored on the reason page so
// the prose surfaces in both the visible <p> below the hero and the
// CollectionPage JSON-LD description. Slugs match the `reasons` table.
const REASON_INTROS: Record<string, string> = {
  lgbtq: 'LGBTQ+ content has become the primary driver of book challenges in American schools since 2020, with the American Library Association reporting it as the most cited reason in its annual challenged books survey. Titles featuring same-sex relationships, transgender characters, or frank depictions of queer identity have been removed from school libraries at record rates. Internationally, the picture is darker still: in dozens of countries, books with LGBTQ+ themes are subject to outright government bans under laws criminalizing "homosexual propaganda" or "immoral content."',
  political: 'Political censorship predates the printing press: Socrates was executed in 399 BCE for his ideas. Books that challenge state authority, document government atrocities, or advocate for dissident ideologies have been burned, banned, and confiscated by governments of every stripe — Communist, Fascist, theocratic, and democratic. The titles in this category include some of the most important works of the 20th century, silenced precisely because they told the truth.',
  religious: 'The Catholic Church\'s Index Librorum Prohibitorum, maintained from 1559 to 1966, included Galileo, Copernicus, Descartes, Locke, Voltaire, and Hume — essentially the entire intellectual foundation of the modern world. Religious censorship remains active: blasphemy laws are still enforceable in over 70 countries, and the 1989 fatwa against Salman Rushdie demonstrated that a religious edict could make an author a global fugitive. Books in this category threatened not just faith, but the institutional power structures that depended on it.',
  sexual: 'Sexual content was the dominant censorship pretext of the 19th and 20th centuries. Flaubert was tried in France for Madame Bovary (1856); Lawrence was prosecuted in Britain for Lady Chatterley\'s Lover (1928); Miller\'s Tropic of Cancer was banned in the US until 1961; Nabokov\'s Lolita circulated in a grey zone for years. Many of the most celebrated works of world literature were first encountered by their audiences as contraband. The books listed here were prosecuted — and are now in print everywhere.',
  violence: 'Depictions of violence have been used as a pretext for banning books by school boards wary of disturbing content, and by authoritarian governments seeking to suppress accounts of their own atrocities. The same passage that gets a young adult novel challenged at a Texas school board might, in a different context, be the reason a dissident writer\'s memoir is confiscated at an airport.',
  racial: 'Books that deal honestly with race — using historical slurs, depicting racism, or centering the experience of marginalized communities — face challenges from multiple directions. Huckleberry Finn has been challenged for its language by communities who object to the slur it uses; works by Black authors have been removed for making white students uncomfortable. The US school ban wave of the 2020s has a pronounced racial dimension, with books by and about people of color disproportionately targeted.',
  drugs: 'Drug use as a topic has been used to ban books both as a moral objection (particularly in books aimed at young readers) and as a pretext to suppress politically inconvenient authors. William S. Burroughs\'s Naked Lunch — depicting heroin addiction — was prosecuted in multiple countries. Today, the category primarily appears in US school challenges targeting young adult fiction that deals honestly with addiction.',
  obscenity: 'Obscenity as a legal standard has been notoriously difficult to define — the US Supreme Court\'s "I know it when I see it" formulation captures the problem. The Obscene Publications Act (UK, 1857) and the Comstock Act (US, 1873) gave authorities sweeping powers that were used not just against pornography but against serious literary works. The landmark 1960 Lady Chatterley trial in Britain, in which the jury acquitted Penguin Books, effectively ended literary obscenity prosecutions in the English-speaking world.',
  moral: 'Broad moral grounds — "indecent," "corrupting to youth," "contrary to public morals" — have historically served as catch-all categories for banning books that challenged prevailing social norms. Ireland\'s Censorship Board, operating under the 1929 Censorship of Publications Act, banned thousands of books on these grounds, including works by the country\'s most celebrated authors.',
  language: 'Language bans target books written in suppressed minority languages as instruments of cultural oppression. The Russian Empire banned Ukrainian-language publications in 1863 and again in 1876. Stalin\'s USSR suppressed dozens of Soviet minority languages. Spain\'s Franco regime restricted Catalan, Basque, and Galician publishing. To ban a language is to attempt to erase a culture.',
  other: 'Some censorship acts resist categorization. Books have been banned for defaming a head of state, revealing state secrets, causing public disorder, or simply because the author was inconvenient. The "other" category documents the creative range of pretexts authorities have used when the standard justifications didn\'t apply.',
}

type Book = {
  id: number; title: string; slug: string; cover_url: string | null
  description: string | null; first_published_year: number | null; genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: { id: number; status: string; country_code: string; year_started: number | null; countries: { name_en: string } | null; ban_reason_links: { reasons: { slug: string } | null }[] }[]
}

function authorName(book: Book) {
  return book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
}

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const label = reasonLabel(slug)
  if (!label || label === slug) return {}

  const supabase = adminClient()
  const { data: reason } = await supabase.from('reasons').select('id').eq('slug', slug).single()

  let bookCount = 0
  let topCountryNames: string[] = []
  if (reason) {
    const { data: links } = await supabase
      .from('ban_reason_links')
      .select('bans(country_code, book_id)')
      .eq('reason_id', reason.id)
      .limit(2000)

    const bookIds = new Set<number>()
    const countryCounts = new Map<string, number>()
    for (const l of (links ?? []) as unknown as { bans: { country_code: string; book_id: number } | null }[]) {
      const ban = l.bans
      if (!ban) continue
      bookIds.add(ban.book_id)
      countryCounts.set(ban.country_code, (countryCounts.get(ban.country_code) ?? 0) + 1)
    }
    bookCount = bookIds.size

    const topCodes = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c)
    if (topCodes.length > 0) {
      const { data: names } = await supabase.from('countries').select('code, name_en').in('code', topCodes)
      const nameMap = new Map((names ?? []).map((c) => [c.code, c.name_en]))
      topCountryNames = topCodes.map((c) => nameMap.get(c) ?? c)
    }
  }

  const title = `Books banned for ${label} – examples and censorship patterns`

  const labelLower = label === 'LGBTQ+' ? 'LGBTQ+' : label.toLowerCase()
  const countryList =
    topCountryNames.length >= 3
      ? `${topCountryNames[0]}, ${topCountryNames[1]}, and ${topCountryNames[2]}`
      : topCountryNames.length === 2
        ? `${topCountryNames[0]} and ${topCountryNames[1]}`
        : topCountryNames[0] ?? ''

  let description: string
  if (bookCount === 0) {
    description = `Books banned for ${labelLower} content — examples, dates, scope, and source citations for every documented censorship entry.`
  } else if (countryList) {
    description = `${bookCount} ${bookCount === 1 ? 'book' : 'books'} banned for ${labelLower} content, recorded in countries including ${countryList}. Examples, dates, and source citations.`
  } else {
    description = `${bookCount} ${bookCount === 1 ? 'book' : 'books'} banned for ${labelLower} content. Examples, dates, scope, and source citations for every documented entry.`
  }
  if (description.length > 160) description = description.slice(0, 157) + '…'

  return { title, description, alternates: { canonical: `/reasons/${slug}` } }
}

export default async function ReasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ country?: string; year?: string; active?: string; sort?: string }>
}) {
  const { slug } = await params
  const { country: filterCountry = '', year: filterYear = '', active: filterActiveStr, sort: filterSort = 'bans' } = await searchParams
  const filterActive = filterActiveStr === '1'
  const filterYearNum = filterYear ? parseInt(filterYear, 10) : null
  const label = reasonLabel(slug)
  if (!label || label === slug) notFound()

  const supabase = adminClient()

  const { data: reason } = await supabase.from('reasons').select('id, slug').eq('slug', slug).single()
  if (!reason) notFound()

  // Paginate ban_reason_links — popular reasons (lgbtq, political) can exceed 1000 rows
  // rows: all links for this reason | fields: [book_id, country_code via bans] | reason: collect book ID set + country frequency
  const bookIdSet = new Set<number>()
  const countryBanCounts = new Map<string, number>()
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('ban_reason_links')
        .select('bans(book_id, country_code)')
        .eq('reason_id', reason.id)
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      for (const bl of data) {
        const ban = bl.bans as unknown as { book_id?: number; country_code?: string } | null
        if (!ban) continue
        if (ban.book_id) bookIdSet.add(ban.book_id)
        if (ban.country_code) {
          countryBanCounts.set(ban.country_code, (countryBanCounts.get(ban.country_code) ?? 0) + 1)
        }
      }
      if (data.length < 1000) break
      offset += 1000
    }
  }

  const bookIds = [...bookIdSet]

  // Top 5 countries where this reason appears most (by ban count)
  const top5CountryCounts = [...countryBanCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  let topCountries: { code: string; name_en: string; count: number }[] = []
  if (top5CountryCounts.length > 0) {
    const { data: names } = await supabase
      .from('countries')
      .select('code, name_en')
      .in('code', top5CountryCounts.map(([code]) => code))
    const nameMap = new Map((names ?? []).map(c => [c.code, c.name_en]))
    topCountries = top5CountryCounts.map(([code, count]) => ({
      code, name_en: nameMap.get(code) ?? code, count,
    }))
  }

  // Paginate books — .in() with 1000+ IDs needs range pagination
  // rows: all books for this reason | fields: card + ban data | reason: reason detail grid
  let books: Book[] = []
  if (bookIds.length > 0) {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('books')
        .select(`
          id, title, slug, cover_url, description, first_published_year, genres,
          book_authors(authors(display_name)),
          bans(id, status, country_code, year_started, countries(name_en), ban_reason_links(reasons(slug)))
        `)
        .in('id', bookIds)
        .order('title')
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      books = books.concat(data as unknown as Book[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  // ── Build filter option lists from full unfiltered set ───────────────────────
  const countryMap = new Map<string, string>()
  for (const book of books) {
    for (const ban of book.bans) {
      if (!countryMap.has(ban.country_code)) {
        countryMap.set(ban.country_code, ban.countries?.name_en ?? ban.country_code)
      }
    }
  }
  const countryOptions = [...countryMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({ code, name }))

  const availableYears = [...new Set(
    books.flatMap(b => b.bans.map(bn => bn.year_started).filter((y): y is number => y != null))
  )].sort((a, b) => b - a)

  // A book on /reasons/lgbtq can also have non-LGBTQ+ bans (Index Librorum
  // 1559, sedition 1933, etc.). Filter every per-reason aggregate to only
  // the bans that actually carry THIS reason — otherwise the lead claims
  // censorship started in 1559 because some LGBTQ+-tagged book also has
  // an Index Librorum entry. matchesReason() is shared by totals, country
  // counts, ranking, and the earliest-year calculation below.
  const matchesReason = (ban: Book['bans'][number]) =>
    ban.ban_reason_links.some(l => l.reasons?.slug === slug)

  // ── Apply filters (affects the A–Z catalogue section only) ───────────────────
  const filtered = books.filter(book => {
    let bans = book.bans
    if (filterCountry) bans = bans.filter(b => b.country_code === filterCountry)
    if (filterYearNum) bans = bans.filter(b => b.year_started === filterYearNum)
    if (filterActive) bans = bans.filter(b => b.status === 'active')
    return bans.length > 0
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filterSort === 'title') return a.title.localeCompare(b.title)
    if (filterSort === 'year') {
      const aYear = Math.min(...a.bans.map(bn => bn.year_started ?? 9999))
      const bYear = Math.min(...b.bans.map(bn => bn.year_started ?? 9999))
      return aYear - bYear
    }
    // Default: sort by reason-scoped ban count (descending)
    return b.bans.filter(matchesReason).length - a.bans.filter(matchesReason).length
  })

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalBans = books.reduce(
    (sum, b) => sum + b.bans.filter(matchesReason).length,
    0,
  )
  const activeBans = books.reduce(
    (sum, b) => sum + b.bans.filter(bn => matchesReason(bn) && bn.status === 'active').length,
    0,
  )
  const countries = [...new Set(
    books.flatMap(b => b.bans.filter(matchesReason).map(bn => bn.country_code)),
  )].length

  // Top-12 most banned for THIS reason (ranked, unfiltered) — anchored
  // showcase row, parallel to /scope/[slug]'s "Most banned in U.S. schools".
  const topBookRanking = [...books]
    .map(b => ({ book: b, count: b.bans.filter(matchesReason).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // BookCardCompact shape — slim view-model so the homepage rail chrome
  // (serif title, oxblood hover, 2:3 cover) wraps every card on the page.
  const topBookCards = topBookRanking.map(({ book, count }) => ({
    id: book.id,
    title: book.title,
    slug: book.slug,
    cover_url: book.cover_url,
    author: authorName(book),
    context: `${count.toLocaleString('en')} documented ${count === 1 ? 'event' : 'events'}`,
  }))
  const topBookIdSet = new Set(topBookCards.map(b => b.id))

  // ── Editorial copy ───────────────────────────────────────────────────────────
  const intro = REASON_INTROS[slug]
  const phrase = reasonPhrase(slug)
  const sentencePhrase = phrase.charAt(0).toUpperCase() + phrase.slice(1)
  const allBanYears = books.flatMap(b =>
    b.bans.filter(matchesReason).map(bn => bn.year_started).filter((y): y is number => y != null),
  )
  const earliestBanYear = allBanYears.length > 0 ? Math.min(...allBanYears) : null

  let reasonLead: string | null = null
  if (bookIds.length > 0) {
    const bookCount = bookIds.length
    const head = `${bookCount} ${bookCount === 1 ? 'book has' : 'books have'} been banned or challenged for ${phrase} worldwide`
    const tail = earliestBanYear ? ` since ${earliestBanYear}` : ''
    reasonLead = `${head}${tail}.`
    if (topCountries.length >= 2) {
      const names = topCountries.slice(0, 3).map(c => c.name_en).join(', ')
      reasonLead += ` ${sentencePhrase} bans are most frequently documented in ${names}.`
    }
  }

  // Hero stats — same shape as /scope/[slug] for cross-page consistency.
  type Stat = { value: string; label: string }
  const heroStats: Stat[] = []
  heroStats.push({ value: bookIds.length.toLocaleString('en'), label: bookIds.length === 1 ? 'Book' : 'Books' })
  heroStats.push({ value: totalBans.toLocaleString('en'), label: totalBans === 1 ? 'Documented event' : 'Documented events' })
  if (countries > 0) heroStats.push({ value: countries.toLocaleString('en'), label: countries === 1 ? 'Country' : 'Countries' })
  if (activeBans > 0) heroStats.push({ value: activeBans.toLocaleString('en'), label: 'Currently active' })
  if (earliestBanYear) heroStats.push({ value: String(earliestBanYear), label: 'Earliest record' })

  // ── JSON-LD ──────────────────────────────────────────────────────────────────
  const collectionUrl = `https://www.banned-books.org/reasons/${slug}`
  const collectionJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Books banned for ${phrase}`,
    url: collectionUrl,
    mainEntityOfPage: collectionUrl,
  }
  if (reasonLead) collectionJsonLd.description = reasonLead
  if (books.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: bookIds.length,
      itemListElement: books.slice(0, 50).map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    }
  }

  // FAQ — visible AND structured (the FaqSection emits FAQPage JSON-LD
  // inline, so the page no longer needs a separate <script> for it).
  const faqItems: FaqItem[] = []
  faqItems.push({
    q: `How many books have been banned for ${phrase}?`,
    a: `${bookIds.length.toLocaleString('en')} ${bookIds.length === 1 ? 'book is' : 'books are'} documented as banned or challenged for ${phrase} in this catalogue.${
      topCountries.length >= 1 ? ` ${topCountries[0].name_en} has the most documented cases.` : ''
    }`,
  })
  if (topCountries.length >= 2) {
    faqItems.push({
      q: `Where are ${phrase}-related book bans most common?`,
      a: `The countries with the most documented ${phrase} bans are ${topCountries.slice(0, 5).map(c => c.name_en).join(', ')}. See [the countries index](/countries) for the full geographic breakdown.`,
    })
  }
  if (earliestBanYear) {
    faqItems.push({
      q: `When did ${phrase}-based book censorship begin?`,
      a: `The earliest documented ${phrase} ban in this catalogue dates to ${earliestBanYear}.`,
    })
  }
  if (books.length >= 3) {
    faqItems.push({
      q: `What books have been banned for ${phrase}?`,
      a: `Notable examples include ${topBookRanking.slice(0, 5).map(({ book }) => book.title).join(', ')}.`,
    })
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
            href="/reasons"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All reasons
          </Link>

          <Eyebrow>Reason · Banned for {label}</Eyebrow>

          <div className="flex items-center gap-4">
            <span className="text-4xl md:text-5xl leading-none" aria-hidden="true">{reasonIcon(slug)}</span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              {sentencePhrase}.
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

            {reasonLead && (
              <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
                {reasonLead}
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

      {/* ── Most banned for this reason (top 12) ───────────────────────── */}
      {topBookCards.length > 0 && (
        <SectionShell tone="cream" eyebrow="Ranked by event count">
          <SectionHeader
            title={`Most banned for ${phrase}`}
            subtitle="Titles affected by the largest number of documented events with this reason cited."
            accent="oxblood"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {topBookCards.map(b => (
              <BookCardCompact key={b.id} book={b} />
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Where this reason appears most (top countries) ─────────────── */}
      {topCountries.length > 0 && (
        <SectionShell tone="white" eyebrow="By geography">
          <SectionHeader
            title={`Where ${phrase} bans are documented most`}
            subtitle="Countries with the highest number of bans citing this reason."
            accent="black"
          />
          <ol className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {topCountries.map(c => (
              <li key={c.code}>
                <Link
                  href={`/countries/${c.code.toLowerCase()}`}
                  className="group flex items-baseline justify-between gap-3 py-3 border-b border-neutral-200 hover:border-oxblood transition-colors"
                >
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xl leading-none shrink-0" aria-hidden="true">{countryFlag(c.code)}</span>
                    <span className="font-serif text-base text-gray-900 group-hover:text-oxblood transition-colors truncate">{c.name_en}</span>
                  </span>
                  <span className="text-xs tabular-nums text-neutral-500 shrink-0">{c.count.toLocaleString('en')}</span>
                </Link>
              </li>
            ))}
          </ol>
        </SectionShell>
      )}

      {/* ── Curated reading list on Bookshop.org ────────────────────────── */}
      {(() => {
        const bookshopSlug = getBookshopListForReason(slug)
        if (!bookshopSlug) return null
        return (
          <SectionShell tone="cream" eyebrow="Read these · Buy from a local bookstore">
            <SectionHeader
              title="On the shelf at Bookshop.org"
              subtitle="Our curated list of the most-banned titles in this category. Every purchase supports independent bookstores."
              accent="oxblood"
              viewAllHref={bookshopListUrl(bookshopSlug)}
              viewAllLabel="Open the full list"
              viewAllExternal
            />
            <BookshopListEmbed slug={bookshopSlug} />
          </SectionShell>
        )
      })()}

      {/* ── Reading-Club theme deeplink ─────────────────────────────────── */}
      {(() => {
        const theme = getReadingClubThemeForReason(slug)
        if (!theme) return null
        return (
          <section className="bg-white px-6 md:px-9 py-6 border-t border-neutral-200">
            <div className="max-w-3xl mx-auto">
              <Link
                href={`/reading-club/by-theme/${theme.slug}`}
                className="group flex items-start gap-3 text-sm text-gray-800 hover:text-oxblood transition-colors"
              >
                <span aria-hidden="true" className="text-oxblood text-base leading-none mt-0.5">★</span>
                <span>
                  <span className="font-semibold">Read together:</span>{' '}
                  discussion packs on {theme.inSentence} in our Reading Club
                  <span aria-hidden="true" className="opacity-70 group-hover:opacity-100"> →</span>
                </span>
              </Link>
            </div>
          </section>
        )
      })()}

      {/* ── Filter + Full catalogue (A–Z, gated to non-top-12) ─────────── */}
      <SectionShell tone="cream" eyebrow="Full catalogue · A–Z">
        <SectionHeader
          title="Browse the full catalogue"
          subtitle={
            sorted.length === books.length
              ? `All ${books.length.toLocaleString('en')} titles. Filter by country, year, or status.`
              : `Showing ${sorted.length.toLocaleString('en')} of ${books.length.toLocaleString('en')} titles after filtering.`
          }
          accent="black"
        />
        <Suspense>
          <ReasonControls
            current={{ country: filterCountry, year: filterYear, active: filterActive, sort: filterSort }}
            countries={countryOptions}
            years={availableYears}
            totalBooks={books.length}
            filteredBooks={sorted.length}
          />
        </Suspense>

        {sorted.length === 0 ? (
          <p className="text-neutral-500 text-sm">No books match the current filters.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {sorted
              .filter(b => !topBookIdSet.has(b.id))
              .slice(0, 100)
              .map(book => (
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
        )}
        {sorted.length > 100 + topBookIdSet.size && (
          <p className="mt-4 text-[11px] text-neutral-500">
            Showing the first 100 of {(sorted.length - topBookIdSet.size).toLocaleString('en')} remaining titles. Use the filters above to narrow down, or [search the full catalogue](/search).
          </p>
        )}
      </SectionShell>

      {/* ── Citation ────────────────────────────────────────────────────── */}
      <SectionShell tone="white">
        <CitationBlock
          entityType="essay"
          entity={{ title: `Books banned for ${phrase}`, slug }}
          url={`https://www.banned-books.org/reasons/${slug}`}
        />
      </SectionShell>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <FaqSection
        items={faqItems}
        tone="cream"
        eyebrow={`About ${phrase} bans`}
        title="Frequently asked."
      />
    </main>
  )
}
