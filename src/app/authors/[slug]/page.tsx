// ISR: regenerate author detail pages every hour. Pageview-tracking
// moved client-side (see <PageviewTracker> below) so the page itself can
// cache. Same migration as book/country/reason detail pages.
export const revalidate = 3600

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import PageviewTracker from '@/components/pageview-tracker'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'
import { getBookshopAuthorUrl, BOOKSHOP_REL } from '@/lib/bookshop'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import BanTimeline, { type TimelineRow } from '@/components/ban-timeline'
import { countryFlag as countryFlagShared } from '@/lib/country-flag'
import CitationBlock from '@/components/citation-block'
import { buildCitationMeta } from '@/lib/citation-meta'
import { coverAlt } from '@/lib/cover-alt'
import { reasonPhrase } from '@/lib/reason-phrases'

type Author = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  photo_url: string | null
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
  original_language: string | null
  updated_at: string | null
  is_placeholder: boolean | null
}

type Ban = {
  id: number
  status: string
  country_code: string
  year_started: number | null
  year_ended: number | null
  action_type: string
  countries: { name_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  bans: Ban[]
}

const countryFlag = countryFlagShared

function getReasons(bans: Ban[]): string[] {
  return [...new Set(bans.flatMap(b =>
    b.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s)
  ))]
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = adminClient()
  const { data: author } = await supabase.from('authors').select('id, display_name').eq('slug', slug).single()
  if (!author) return {}

  const { data: bookLinks } = await supabase
    .from('book_authors')
    .select('book_id')
    .eq('author_id', (author as unknown as { id: number }).id)

  const bookIds = (bookLinks ?? []).map((bl: { book_id: number }) => bl.book_id)
  let countryCount = 0
  if (bookIds.length > 0) {
    const { data: bans } = await supabase
      .from('bans')
      .select('country_code')
      .in('book_id', bookIds)
    countryCount = new Set((bans ?? []).map((b) => b.country_code)).size
  }

  const title = author.display_name
  const description = `${author.display_name}'s books have been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}. See the full list.`
  const canonicalUrl = `https://www.banned-books.org/authors/${slug}`
  return {
    title,
    description,
    alternates: { canonical: `/authors/${slug}` },
    openGraph: { title, description },
    twitter: { card: 'summary' },
    other: buildCitationMeta({
      entityType: 'author',
      title: author.display_name,
      authors: [author.display_name],
      url: canonicalUrl,
    }),
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data: author } = await supabase
    .from('authors')
    .select('id, display_name, slug, bio, birth_year, death_year, birth_country, photo_url, name_native, name_transliterated, name_english, original_language, updated_at, is_placeholder')
    .eq('slug', slug)
    .single()

  if (!author) notFound()
  const a = author as unknown as Author

  const { data: bookLinks } = await supabase
    .from('book_authors')
    .select('book_id')
    .eq('author_id', author.id)

  const bookIds = (bookLinks ?? []).map((bl: any) => bl.book_id).filter(Boolean)

  let books: Book[] = []
  if (bookIds.length > 0) {
    const { data } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, description, first_published_year, genres,
        bans(id, status, country_code, year_started, year_ended, action_type, countries(name_en), ban_reason_links(reasons(slug)))
      `)
      .in('id', bookIds)
      .order('title')
    books = (data as unknown as Book[]) ?? []
  }

  const totalBans = books.reduce((sum, b) => sum + b.bans.length, 0)
  const countryCount = [...new Set(books.flatMap(b => b.bans.map(bn => bn.country_code)))].length
  const activeBanCount = books.reduce((sum, b) => sum + b.bans.filter(bn => bn.status === 'active').length, 0)

  // ── Timeline rows: one per book that has dated bans, sorted by earliest ban year ──
  const authorTimelineRows: TimelineRow[] = books
    .map((b) => {
      const datedBans = b.bans.filter((ban) => ban.year_started != null)
      if (datedBans.length === 0) return null
      const earliest = Math.min(...datedBans.map((ban) => ban.year_started!))
      const countries = [...new Set(datedBans.map((bn) => bn.country_code))]
      const flag = countries.length === 1 ? countryFlag(countries[0]) : '🌍'
      return {
        key: b.slug,
        label: b.title,
        flag,
        sublabel:
          datedBans.length === 1
            ? `1 ban`
            : `${datedBans.length} bans · ${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
        href: `/books/${b.slug}`,
        bans: datedBans.map((ban) => ({
          id: ban.id,
          year_started: ban.year_started!,
          year_ended: ban.year_ended,
          status: ban.status,
          action_type: ban.action_type,
        })),
        earliest,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.earliest - b.earliest)
    .map(({ earliest: _e, ...row }) => row)

  const earliestBookYear = books
    .map((b) => b.first_published_year)
    .filter((y): y is number => y != null)
    .reduce<number | null>((acc, y) => (acc == null || y < acc ? y : acc), null)

  const lifespan = a.birth_year
    ? `${a.birth_year}${a.birth_country ? `, ${a.birth_country}` : ''} — ${a.death_year ?? 'present'}`
    : null

  // ── Other frequently banned authors (top 5 by ban count, excluding this one) ──
  type RelatedAuthor = { id: number; display_name: string; slug: string; banCount: number }
  let relatedAuthors: RelatedAuthor[] = []
  try {
    // Fetch top authors by ban count from mv_ban_counts is not available; use a join approach.
    // Get all book_author links + their ban counts from our already-loaded books data for context,
    // but we need the global top — so query directly.
    const { data: topLinks } = await supabase
      .from('book_authors')
      .select('author_id, books(bans(id))')
      .neq('author_id', author.id)
      .limit(2000)

    if (topLinks) {
      const authorBanMap = new Map<number, number>()
      for (const link of topLinks as unknown as { author_id: number; books: { bans: { id: number }[] } | null }[]) {
        const count = link.books?.bans?.length ?? 0
        authorBanMap.set(link.author_id, (authorBanMap.get(link.author_id) ?? 0) + count)
      }
      const top5Ids = [...authorBanMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, count }))

      if (top5Ids.length > 0) {
        const { data: authorDetails } = await supabase
          .from('authors')
          .select('id, display_name, slug, is_placeholder')
          .in('id', top5Ids.map(x => x.id))
          .not('slug', 'is', null)
          .eq('is_placeholder', false)
        const nameMap = new Map((authorDetails ?? []).map(a => [a.id, a]))
        relatedAuthors = top5Ids
          .map(({ id, count }) => {
            const det = nameMap.get(id)
            if (!det?.slug) return null
            return { id, display_name: det.display_name, slug: det.slug, banCount: count }
          })
          .filter((x): x is RelatedAuthor => x !== null)
      }
    }
  } catch {
    // Non-fatal
  }

  // Placeholder authors ("Anonymous", "Unknown", "Various") aggregate
  // unrelated books. They are real catalogue navigation points but NOT
  // entities — emitting Person JSON-LD or a "23 of Anonymous's books..."
  // lead would misrepresent the data and undermine SEO trust on /
  // authors/anonymous. Switch the whole SEO surface to a no-promotion
  // mode for these records.
  const isPlaceholder = a.is_placeholder === true

  // ── Schema.org Person + BreadcrumbList JSON-LD ──────────────────────────────
  // Sits alongside the citation_* meta tags built in generateMetadata above.
  // The Person type lets Google build entity-graph relations between this
  // author and the Book JSON-LD on each book detail page (where author.url
  // points back here).
  const canonicalUrlLd = `https://www.banned-books.org/authors/${a.slug}`
  const personAlternateNames = [a.name_native, a.name_english, a.name_transliterated]
    .filter((n): n is string => !!n && n.trim() !== '' && n.trim().toLowerCase() !== a.display_name.trim().toLowerCase())
  const personJsonLd: Record<string, unknown> | null = isPlaceholder ? null : {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: a.display_name,
    url: canonicalUrlLd,
    mainEntityOfPage: canonicalUrlLd,
  }
  if (personJsonLd && personAlternateNames.length > 0) {
    personJsonLd.alternateName = personAlternateNames.length === 1 ? personAlternateNames[0] : personAlternateNames
  }
  if (personJsonLd) {
    if (a.photo_url)      personJsonLd.image = a.photo_url
    if (a.bio)            personJsonLd.description = a.bio
    if (a.birth_year)     personJsonLd.birthDate = String(a.birth_year)
    if (a.death_year)     personJsonLd.deathDate = String(a.death_year)
    if (a.birth_country)  personJsonLd.birthPlace = a.birth_country
    if (a.original_language) personJsonLd.knowsLanguage = a.original_language
    if (books.length > 0) {
      personJsonLd.workExample = books.slice(0, 50).map(b => ({
        '@type': 'Book',
        name: b.title,
        url: `https://www.banned-books.org/books/${b.slug}`,
        ...(b.first_published_year ? { datePublished: String(b.first_published_year) } : {}),
      }))
    }
    // dateModified — trigger-bumped freshness signal, parallel to the
    // Book.dateModified emitted on book detail pages.
    if (a.updated_at) personJsonLd.dateModified = a.updated_at
  }

  // ── Direct-answer lead + FAQPage JSON-LD ──────────────────────────────────
  // Same SEO surface as book/country/reason: a prose summary in the first
  // viewport plus 3-4 query-shaped Q&As targeting "is [author] banned?",
  // "how many of [author]'s books are banned?", "why are [author]'s books
  // banned?". Computed from already-loaded books + bans data.
  type AuthorBan = Author['display_name'] extends never ? never : Book['bans'][number]
  let authorLead: string | null = null
  let authorFaqJsonLd: object | null = null
  // Placeholder authors get a special editorial lead instead of the
  // counts-driven one — see below — and no FAQ schema (no real entity
  // to answer questions about).
  if (!isPlaceholder && books.length > 0 && totalBans > 0) {
    const reasonSlugCounts = new Map<string, number>()
    for (const b of books) {
      for (const ban of b.bans) {
        for (const link of ban.ban_reason_links) {
          const slug = link.reasons?.slug
          if (slug) reasonSlugCounts.set(slug, (reasonSlugCounts.get(slug) ?? 0) + 1)
        }
      }
    }
    const topReasonSlug = [...reasonSlugCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
    const topReasonPhrase = topReasonSlug ? reasonPhrase(topReasonSlug) : null

    const datedBans = books.flatMap(b => b.bans.filter((ban: AuthorBan) => ban.year_started != null))
    const earliestYear = datedBans.length > 0 ? Math.min(...datedBans.map((b: AuthorBan) => b.year_started!)) : null

    const bannedBookCount = books.filter(b => b.bans.length > 0).length

    let head = `${a.display_name} has ${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} that ${bannedBookCount === 1 ? 'has' : 'have'} been banned or challenged in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`
    if (earliestYear) head += ` since ${earliestYear}`
    if (topReasonPhrase) head += `, most often for ${topReasonPhrase}`
    authorLead = head + '.'
    if (activeBanCount > 0 && totalBans > activeBanCount) {
      authorLead += ` ${activeBanCount} of the ${totalBans} bans ${activeBanCount === 1 ? 'remains' : 'remain'} active today.`
    } else if (activeBanCount === totalBans && totalBans > 1) {
      authorLead += ` All ${totalBans} bans remain active.`
    }

    const items: { q: string; a: string }[] = []
    items.push({
      q: `How many of ${a.display_name}'s books have been banned?`,
      a: `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${a.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned or challenged, with ${totalBans} documented ${totalBans === 1 ? 'ban' : 'bans'} across ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}.`,
    })
    if (topReasonPhrase) {
      items.push({
        q: `Why have ${a.display_name}'s books been banned?`,
        a: `The most frequently cited reason for banning ${a.display_name}'s work is ${topReasonPhrase}, with ${reasonSlugCounts.get(topReasonSlug!)} ${reasonSlugCounts.get(topReasonSlug!) === 1 ? 'documented ban' : 'documented bans'} citing this reason.`,
      })
    }
    if (earliestYear) {
      const firstBookBan = books
        .map(b => ({ title: b.title, slug: b.slug, earliest: Math.min(...b.bans.filter(bn => bn.year_started != null).map(bn => bn.year_started!), Infinity) }))
        .filter(x => Number.isFinite(x.earliest))
        .sort((x, y) => x.earliest - y.earliest)[0]
      if (firstBookBan && firstBookBan.earliest === earliestYear) {
        items.push({
          q: `When was the first ban of a ${a.display_name} book?`,
          a: `${firstBookBan.title} by ${a.display_name} was first banned in ${earliestYear} — the earliest documented ban of any of ${a.display_name}'s works in this catalogue.`,
        })
      } else {
        items.push({
          q: `When was the first ban of a ${a.display_name} book?`,
          a: `The earliest documented ban of a book by ${a.display_name} dates to ${earliestYear}.`,
        })
      }
    }
    if (books.length >= 3) {
      const titles = books.slice(0, 5).map(b => b.title).join(', ')
      items.push({
        q: `Which books by ${a.display_name} have been banned?`,
        a: `Banned or challenged books by ${a.display_name} include ${titles}.`,
      })
    }
    authorFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(it => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
    }
  }

  // Placeholder lead — single sentence noting this is a catalogue bucket
  // for anonymously-authored books rather than a person's oeuvre.
  if (isPlaceholder && books.length > 0) {
    authorLead = `This page collects ${books.length} ${books.length === 1 ? 'book' : 'books'} in our catalogue without an attributed author. These are separate works by different (unknown or anonymous) writers, grouped here for catalogue navigation only.`
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: 'https://www.banned-books.org/' },
      { '@type': 'ListItem', position: 2, name: 'Authors', item: 'https://www.banned-books.org/authors' },
      { '@type': 'ListItem', position: 3, name: a.display_name, item: canonicalUrlLd },
    ],
  }

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {personJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(personJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(breadcrumbJsonLd) }}
      />
      {authorFaqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(authorFaqJsonLd) }}
        />
      )}
      <PageviewTracker entityType="author" entityId={a.id} />
      <Link
        href="/stats"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors"
      >
        ← Stats
      </Link>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-10">
        {a.photo_url && (
          <div className="shrink-0 flex justify-center sm:block">
            <Image
              src={a.photo_url}
              alt={a.display_name}
              width={160}
              height={200}
              className="rounded-lg shadow-md object-cover object-top w-[120px] h-[150px] sm:w-[160px] sm:h-[200px]"
              sizes="160px"
            />
          </div>
        )}
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{a.display_name}</h1>
          {/* Secondary name: native-script form (for authors whose original
              writing language is non-English) OR a known English pen name
              when it differs from the canonical display_name. Suppressed
              when the alt-name equals display_name to avoid duplicating
              the H1. */}
          {(() => {
            const norm = (s: string) => s.trim().toLowerCase()
            const canonical = norm(a.display_name)
            const native =
              a.name_native && norm(a.name_native) !== canonical
                ? a.name_native
                : null
            const english =
              !native && a.name_english && norm(a.name_english) !== canonical
                ? a.name_english
                : null
            const subtitle = native ?? english
            if (!subtitle) return null
            return (
              <h2
                className="text-xl font-medium text-gray-700 dark:text-gray-300 leading-snug"
                lang={native ? a.original_language ?? undefined : 'en'}
              >
                {subtitle}
              </h2>
            )
          })()}
          {/* Transliteration annotation — small italic line, only when it
              adds information (distinct from both H1 and the H2 subtitle
              above). Pronunciation aid for non-Latin authors where the
              canonical display_name is one transliteration scheme and we
              have a more standard BGN/PCGN form. */}
          {a.name_transliterated &&
            a.name_transliterated.trim().toLowerCase() !== a.display_name.trim().toLowerCase() &&
            (!a.name_native ||
              a.name_transliterated.trim().toLowerCase() !==
                a.name_native.trim().toLowerCase()) && (
              <p className="text-sm italic text-gray-500 dark:text-gray-400">
                {a.name_transliterated}
              </p>
            )}
          {lifespan && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{lifespan}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-medium text-red-500 dark:text-red-400">
              {books.length} {books.length === 1 ? 'book' : 'books'} banned
            </span>
            <span>{totalBans} bans across {countryCount} {countryCount === 1 ? 'country' : 'countries'}</span>
            {activeBanCount > 0 && <span>{activeBanCount} currently active</span>}
          </div>
          {a.bio && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1 max-w-2xl">{a.bio}</p>
          )}
        </div>
      </div>

      {/* Direct-answer lead — AI-Overview/Featured-Snippet-eligible TL;DR.
          Bio above is editorial about the person; this lead is data-driven
          about the bans, the angle that drives author-name searches. */}
      {authorLead && (
        <p className="mb-8 text-base text-gray-800 dark:text-gray-200 leading-relaxed border-l-4 border-red-300 dark:border-red-900 pl-4">
          {authorLead}
        </p>
      )}

      {/* Find books */}
      {(() => {
        const authorQuery = encodeURIComponent(a.display_name)
        return (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-amber-600 dark:text-amber-400">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Find books by {a.display_name}
            </h2>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <TrackedOutboundLink
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'author', authorSlug: a.slug, linkType: 'storefront' }}
                  href={getBookshopAuthorUrl()}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-sm font-semibold text-white transition-colors shadow-sm"
                >
                  Find on Bookshop.org
                </TrackedOutboundLink>
                <TrackedOutboundLink
                  eventName="Kobo Click"
                  eventProperties={{ source: 'author', authorSlug: a.slug }}
                  href={`https://www.kobo.com/search?query=${authorQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-900/50 hover:border-amber-500 dark:hover:border-amber-700 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Find on Kobo
                </TrackedOutboundLink>
              </div>
              <p className="text-xs text-amber-800/70 dark:text-amber-300/60 text-center leading-relaxed">
                Bookshop.org link is an affiliate link — it supports independent bookstores and this project at no extra cost to you.{' '}
                <Link href="/why-not-amazon" className="underline hover:no-underline">
                  Why we don&apos;t link to Amazon
                </Link>
              </p>
            </div>
          </section>
        )
      })()}

      {/* Ban timeline — one row per book, only when this author's record has 3+ dated bans across multiple books */}
      {authorTimelineRows.length >= 2 && authorTimelineRows.reduce((s, r) => s + r.bans.length, 0) >= 3 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Ban timeline</h2>
          <BanTimeline
            rows={authorTimelineRows}
            firstPublishedYear={earliestBookYear}
            firstPublishedLabel="First book published"
            caption={`${a.display_name}'s books — ${totalBans} bans across ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}.`}
          />
        </section>
      )}

      {books.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No books recorded for this author yet.</p>
      ) : (
        <>
        <h2 className="text-lg font-semibold mb-4">
          Banned books by {a.display_name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {books.map(book => {
            const reasons = getReasons(book.bans)
            const activeBans = book.bans.filter(b => b.status === 'active')
            const displayBans = activeBans.length > 0 ? activeBans : book.bans.slice(0, 4)
            return (
              <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
                <div className="mb-2">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={coverAlt(book.title, a.display_name, book.first_published_year)}
                      width={160}
                      height={240}
                      className="rounded shadow-sm object-cover w-full"
                      sizes="160px"
                    />
                  ) : (
                    <BookCoverPlaceholder title={book.title} author={a.display_name} slug={book.slug} />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                {book.first_published_year && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{book.first_published_year}</p>
                )}
                <div className="flex flex-wrap gap-0.5 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {displayBans.slice(0, 4).map(b => (
                    <span key={b.id} title={b.countries?.name_en ?? b.country_code}>
                      {countryFlag(b.country_code)}
                    </span>
                  ))}
                  {book.bans.length > 4 && <span>+{book.bans.length - 4}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {book.genres.slice(0, 2).map(g => <GenreBadge key={g} slug={g} />)}
                  {reasons.slice(0, 2).map(s => <ReasonBadge key={s} slug={s} />)}
                </div>
              </Link>
            )
          })}
        </div>
        </>
      )}

      <CitationBlock
        entityType="author"
        entity={{
          title: a.display_name,
          slug: a.slug,
        }}
        url={`https://www.banned-books.org/authors/${a.slug}`}
      />

      {/* Last verified — feeds Person.dateModified above. */}
      {a.updated_at && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          Last verified:{' '}
          <time dateTime={a.updated_at}>
            {new Date(a.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        </p>
      )}

      {/* Other frequently banned authors */}
      {relatedAuthors.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Other frequently banned authors
          </h2>
          <div className="flex flex-wrap gap-3">
            {relatedAuthors.map(ra => (
              <Link
                key={ra.id}
                href={`/authors/${ra.slug}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:underline leading-snug">
                    {ra.display_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ra.banCount} {ra.banCount === 1 ? 'ban' : 'bans'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
