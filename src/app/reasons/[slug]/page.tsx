// ISR: re-render every hour. Same migration rationale as country detail:
// no per-request mutations, content changes on enrichment cycles.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { searchBooks } from '@/lib/book-search'
import { reasonPhrase } from '@/lib/reason-phrases'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'
import ReasonCatalogueBrowser, { type ApiBook } from '@/components/reason-catalogue-browser'
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
  first_published_year: number | null; genres: string[]
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

// Prebuild all 11 reason hubs at build time. These are high-authority landing
// pages (linked from every book sidebar, the reasons index, and essay intros),
// so a warm cache on the first crawler hit matters — an empty array left them
// to render on-demand (cold ISR miss + a DB sweep) on the first request.
// The old build-timeout concern is stale: the page was since slimmed to a
// light ban_reason_links sweep (no full-catalogue hydration), and /books/[slug]
// already prebuilds the full ~15.8k catalogue under the same build, so 11 more
// pages are well within the concurrency budget (staticGenerationRetryCount +
// staticGenerationMaxConcurrency in next.config.ts). Slugs come from the local
// REASON_INTROS registry so this stays DB-free.
export async function generateStaticParams() {
  return Object.keys(REASON_INTROS).map((slug) => ({ slug }))
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

  const title = `Books banned for ${reasonPhrase(slug)} – examples and censorship patterns`

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
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const label = reasonLabel(slug)
  if (!label || label === slug) notFound()

  const supabase = adminClient()

  const { data: reason } = await supabase.from('reasons').select('id, slug').eq('slug', slug).single()
  if (!reason) notFound()

  // ── Light sweep over this reason's ban links ─────────────────────────────────
  // One pass yields every aggregate the page needs (distinct books, per-book
  // event counts, countries, years, active/total counts) WITHOUT hydrating
  // thousands of full book rows. The full catalogue is served client-side by
  // <ReasonCatalogueBrowser> via /api/books, so the page stays light + cacheable
  // (previously this fetched all ~5.8k books server-side and forced dynamic
  // rendering via searchParams).
  const bookCountById = new Map<number, number>()   // book_id → events citing this reason
  const countryBanCounts = new Map<string, number>()
  const yearSet = new Set<number>()
  let totalBans = 0
  let activeBans = 0
  {
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('ban_reason_links')
        .select('bans(book_id, country_code, year_started, status)')
        .eq('reason_id', reason.id)
        // Stable order (ban_id unique for a fixed reason_id) or .range() skips past 1000.
        .order('ban_id')
        .range(offset, offset + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const bl of data) {
        const ban = bl.bans as unknown as { book_id?: number; country_code?: string; year_started?: number | null; status?: string } | null
        if (!ban) continue
        totalBans++
        if (ban.status === 'active') activeBans++
        if (ban.book_id) bookCountById.set(ban.book_id, (bookCountById.get(ban.book_id) ?? 0) + 1)
        if (ban.country_code) countryBanCounts.set(ban.country_code, (countryBanCounts.get(ban.country_code) ?? 0) + 1)
        if (ban.year_started != null) yearSet.add(ban.year_started)
      }
      if (data.length < 1000) break
      offset += 1000
    }
  }

  const bookCount = bookCountById.size
  const countries = countryBanCounts.size
  const availableYears = [...yearSet].sort((a, b) => b - a)
  const earliestBanYear = yearSet.size > 0 ? Math.min(...yearSet) : null

  // Country names for the "top countries" section + the browser's dropdown
  // (≤ ~200 distinct codes, well under the URL cap).
  const allCodes = [...countryBanCounts.keys()]
  const countryNameMap = new Map<string, string>()
  if (allCodes.length > 0) {
    const { data: names } = await supabase.from('countries').select('code, name_en').in('code', allCodes)
    for (const c of (names ?? []) as { code: string; name_en: string }[]) countryNameMap.set(c.code, c.name_en)
  }
  const countryOptions = allCodes
    .map(code => ({ code, name: countryNameMap.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const topCountries = [...countryBanCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, name_en: countryNameMap.get(code) ?? code, count }))

  // Hydrate the top books by reason-scoped event count: top 12 for the "Most
  // banned" cards, top 50 for the JSON-LD ItemList. One .in() (≤50 ids).
  const rankedIds = [...bookCountById.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const topIds = rankedIds.slice(0, 50)
  let topBooks: Book[] = []
  if (topIds.length > 0) {
    const { data } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, first_published_year, genres,
        book_authors(authors(display_name)),
        bans(id, status, country_code, year_started, countries(name_en), ban_reason_links(reasons(slug)))
      `)
      .in('id', topIds)
    const byId = new Map(((data ?? []) as unknown as Book[]).map(b => [b.id, b]))
    topBooks = topIds.map(id => byId.get(id)).filter(Boolean) as Book[]
  }

  // BookCardCompact shape — slim view-model so the homepage rail chrome wraps
  // every card on the page.
  const topBookCards = topBooks.slice(0, 12).map(book => {
    const count = bookCountById.get(book.id) ?? 0
    return {
      id: book.id,
      title: book.title,
      slug: book.slug,
      cover_url: book.cover_url,
      author: authorName(book),
      context: `${count.toLocaleString('en')} documented ${count === 1 ? 'event' : 'events'}`,
    }
  })

  // Initial (unfiltered, most-banned) catalogue page — server-fetched for SSR
  // and SEO; <ReasonCatalogueBrowser> takes over filtering/pagination client-side.
  const initial = await searchBooks({ reason: slug, sort: 'bans', limit: 48 })
  const initialBooks = initial.books as unknown as ApiBook[]
  const initialTotal = initial.total

  // ── Editorial copy ───────────────────────────────────────────────────────────
  const intro = REASON_INTROS[slug]
  const phrase = reasonPhrase(slug)
  const sentencePhrase = phrase.charAt(0).toUpperCase() + phrase.slice(1)

  let reasonLead: string | null = null
  if (bookCount > 0) {
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
  heroStats.push({ value: bookCount.toLocaleString('en'), label: bookCount === 1 ? 'Book' : 'Books' })
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
  if (topBooks.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: bookCount,
      itemListElement: topBooks.map((b, idx) => ({
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
    a: `${bookCount.toLocaleString('en')} ${bookCount === 1 ? 'book is' : 'books are'} documented as banned or challenged for ${phrase} in this catalogue.${
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
  if (topBooks.length >= 3) {
    faqItems.push({
      q: `What books have been banned for ${phrase}?`,
      a: `Notable examples include ${topBooks.slice(0, 5).map(b => b.title).join(', ')}.`,
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
              Books banned for {phrase}.
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

            {reasonLead && bookCount > 0 && (
              <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
                {/* Same content as `reasonLead` string (kept for JSON-LD)
                    but with inline Links on top-country names — matches the
                    /countries/[code] and /books/[slug] internal-linking
                    pattern (2026-07-06). */}
                {bookCount} {bookCount === 1 ? 'book has' : 'books have'} been banned or challenged for {phrase} worldwide
                {earliestBanYear && <> since {earliestBanYear}</>}
                .
                {topCountries.length >= 2 && (
                  <>
                    {' '}{sentencePhrase} bans are most frequently documented in{' '}
                    {topCountries.slice(0, 3).map((c, i, arr) => (
                      <span key={c.code}>
                        <Link
                          href={`/countries/${c.code.toLowerCase()}`}
                          className="underline underline-offset-4 decoration-2 decoration-oxblood/40 hover:decoration-oxblood"
                        >
                          {c.name_en}
                        </Link>
                        {i < arr.length - 1 && (i === arr.length - 2 ? ', and ' : ', ')}
                      </span>
                    ))}
                    .
                  </>
                )}
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

      {/* ── Full catalogue (client-side filtered via /api/books) ─────────── */}
      <SectionShell tone="cream" eyebrow="Full catalogue">
        <SectionHeader
          title="Browse the full catalogue"
          subtitle={`All ${bookCount.toLocaleString('en')} titles. Filter by country, year, or status.`}
          accent="black"
        />
        <ReasonCatalogueBrowser
          reason={slug}
          initialBooks={initialBooks}
          initialTotal={initialTotal}
          countryOptions={countryOptions}
          years={availableYears}
        />
      </SectionShell>

      {/* ── Bookshop.org reading list (compact, below catalogue) ────────── */}
      {(() => {
        const bookshopSlug = getBookshopListForReason(slug)
        if (!bookshopSlug) return null
        return (
          <section className="bg-white px-6 md:px-9 py-8 md:py-10 border-t border-neutral-200">
            <div className="max-w-5xl mx-auto">
              <h3 className="font-serif text-lg md:text-xl font-semibold text-gray-900">
                Want to read some of these?
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                A short, curated list on Bookshop.org — every purchase supports independent bookstores.{' '}
                <a
                  href={bookshopListUrl(bookshopSlug)}
                  target="_blank"
                  rel="noopener"
                  className="text-oxblood hover:underline whitespace-nowrap"
                >
                  Open the full list ↗
                </a>
              </p>
              <div className="mt-5">
                <BookshopListEmbed slug={bookshopSlug} />
              </div>
            </div>
          </section>
        )
      })()}

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
