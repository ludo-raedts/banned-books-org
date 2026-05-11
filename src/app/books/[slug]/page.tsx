export const dynamic = 'force-dynamic'

import React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { headers } from 'next/headers'
import { trackPageview } from '@/lib/trackPageview'
import ReasonBadge, { reasonLabel } from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'
import ShareButtons from '@/components/share-buttons'
import BanTimeline, { type TimelineRow } from '@/components/ban-timeline'
import { countryFlag } from '@/lib/country-flag'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL } from '@/lib/bookshop'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import CitationBlock from '@/components/citation-block'
import { buildCitationMeta } from '@/lib/citation-meta'

const BOOK_REASON_PHRASE: Record<string, string> = {
  lgbtq: 'LGBTQ+ content',
  political: 'political content',
  religious: 'religious content',
  sexual: 'sexual content',
  violence: 'violent content',
  racial: 'racial content',
  drugs: 'drug references',
  obscenity: 'obscenity',
  blasphemy: 'blasphemy',
  moral: 'moral grounds',
  language: 'language reasons',
  other: 'other reasons',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await adminClient()
    .from('books')
    .select(`
      title, cover_url, first_published_year,
      book_authors(authors(display_name)),
      bans(country_code, countries(name_en), ban_reason_links(reasons(slug)))
    `)
    .eq('slug', slug)
    .single()

  if (!data) return {}

  type MetaBan = {
    country_code: string
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }
  const bans = (data.bans as unknown as MetaBan[]) ?? []
  const authorList = (data.book_authors as unknown as { authors: { display_name: string } | null }[])
    .map((ba) => ba.authors?.display_name).filter((s): s is string => !!s)
  const author = authorList.join(', ')
  const baseTitle = `${data.title}${author ? ` by ${author}` : ''}`

  const countryByCode = new Map<string, string>()
  for (const b of bans) {
    if (!countryByCode.has(b.country_code)) {
      countryByCode.set(b.country_code, b.countries?.name_en ?? b.country_code)
    }
  }
  const uniqueCountries = [...countryByCode.values()]

  const reasonCounts = new Map<string, number>()
  for (const b of bans) {
    for (const l of b.ban_reason_links) {
      const s = l.reasons?.slug
      if (s) reasonCounts.set(s, (reasonCounts.get(s) ?? 0) + 1)
    }
  }
  const topReasonSlug = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topReasonPhrase = topReasonSlug ? BOOK_REASON_PHRASE[topReasonSlug] : null

  const candidateA = uniqueCountries.length === 1 && topReasonPhrase
    ? `${baseTitle} – Banned in ${uniqueCountries[0]} for ${topReasonPhrase}`
    : null
  const candidateB = `${baseTitle} – Why it was banned`
  const candidateC = baseTitle

  let title: string
  if (candidateA && candidateA.length <= 60) title = candidateA
  else if (candidateB.length <= 60) title = candidateB
  else title = candidateC
  if (title.length > 70) title = title.slice(0, 67) + '…'

  let description: string
  if (bans.length === 0) {
    description = `${baseTitle} on Banned Books — censorship history, country-by-country entries, and source citations on this page.`
  } else if (uniqueCountries.length === 1 && topReasonPhrase) {
    description = `${baseTitle} was banned in ${uniqueCountries[0]} for ${topReasonPhrase}. See the year, the scope, and the full source citations on this page.`
  } else if (uniqueCountries.length === 1) {
    description = `${baseTitle} was banned in ${uniqueCountries[0]}. See the year, the scope, and the full source citations behind every entry on this page.`
  } else if (topReasonPhrase) {
    description = `${baseTitle} has been banned in ${uniqueCountries.length} countries, often for ${topReasonPhrase}. See where, when, why — and the full source citations on this page.`
  } else {
    description = `${baseTitle} has been banned or challenged in ${uniqueCountries.length} countries. See where, when, why — and the full source citations behind every entry.`
  }
  if (description.length > 160) description = description.slice(0, 157) + '…'

  const canonicalUrl = `https://www.banned-books.org/books/${slug}`
  const citationOther = buildCitationMeta({
    entityType: 'book',
    title: data.title,
    authors: authorList,
    url: canonicalUrl,
    onlineDate: data.first_published_year ? String(data.first_published_year) : undefined,
  })

  return {
    title,
    description,
    alternates: { canonical: `/books/${slug}` },
    openGraph: {
      title,
      description,
      ...(data.cover_url ? { images: [{ url: data.cover_url }] } : {}),
    },
    twitter: {
      card: data.cover_url ? 'summary_large_image' : 'summary',
    },
    other: citationOther,
  }
}

type Ban = {
  id: number
  year_started: number | null
  year_ended: number | null
  action_type: string
  status: string
  country_code: string
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { id: number; slug: string } | null }[]
  ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
}

type WarningLevel = 'none' | 'context' | 'extended'

type BookDetail = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  description_book: string | null
  description_ban: string | null
  censorship_context: string | null
  first_published_year: number | null
  genres: string[]
  gutenberg_id: number | null
  isbn13: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bookshop_isbn13: string | null
  warning_level: WarningLevel | null
  inclusion_rationale: string | null
  extended_context: string | null
  original_language: string | null
  book_authors: { authors: { display_name: string; slug: string | null } | null }[]
  bans: Ban[]
}

function authorName(book: BookDetail): string {
  return book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, slug, cover_url, description, description_book, description_ban,
      censorship_context, first_published_year, genres, gutenberg_id, isbn13,
      bookshop_status, bookshop_isbn13, warning_level, inclusion_rationale, extended_context,
      original_language,
      book_authors(authors(display_name, slug)),
      bans(
        id, year_started, year_ended, action_type, status, country_code, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(id, slug)),
        ban_source_links(ban_sources(source_name, source_url))
      )
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) notFound()

  const book = data as unknown as BookDetail
  const author = authorName(book)

  void trackPageview('book', book.id, new Request('https://x', { headers: await headers() }))

  const sortedBans = [...book.bans].sort((a, b) =>
    (a.year_started ?? 9999) - (b.year_started ?? 9999)
  )

  // ── Timeline rows: one per country, sorted by earliest ban year ─────────────
  const timelineRows: TimelineRow[] = (() => {
    const byCountry = new Map<string, { name: string; bans: Ban[] }>()
    for (const ban of book.bans) {
      if (ban.year_started == null) continue
      const existing = byCountry.get(ban.country_code)
      const name = ban.countries?.name_en ?? ban.country_code
      if (existing) existing.bans.push(ban)
      else byCountry.set(ban.country_code, { name, bans: [ban] })
    }
    return [...byCountry.entries()]
      .map(([code, { name, bans }]) => ({
        key: code,
        label: name,
        sublabel: code,
        flag: countryFlag(code),
        href: `/countries/${code.toLowerCase()}`,
        bans: bans.map((b) => ({
          id: b.id,
          year_started: b.year_started!,
          year_ended: b.year_ended,
          status: b.status,
          action_type: b.action_type,
        })),
        earliest: Math.min(...bans.map((b) => b.year_started!)),
      }))
      .sort((a, b) => a.earliest - b.earliest)
      .map(({ earliest: _, ...row }) => row)
  })()

  // ── Pick primary country & reason for contextual link sections ───────────────
  const countryFreqInBook = new Map<string, { count: number; name: string }>()
  for (const b of book.bans) {
    const existing = countryFreqInBook.get(b.country_code)
    countryFreqInBook.set(b.country_code, {
      count: (existing?.count ?? 0) + 1,
      name: b.countries?.name_en ?? b.country_code,
    })
  }
  const primaryCountry = [...countryFreqInBook.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, v]) => ({ code, name: v.name }))[0] ?? null

  const reasonFreqInBook = new Map<number, { count: number; slug: string }>()
  for (const b of book.bans) {
    for (const link of b.ban_reason_links) {
      const r = link.reasons
      if (!r) continue
      const existing = reasonFreqInBook.get(r.id)
      reasonFreqInBook.set(r.id, { count: (existing?.count ?? 0) + 1, slug: r.slug })
    }
  }
  const primaryReason = [...reasonFreqInBook.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, v]) => ({ id, slug: v.slug }))[0] ?? null

  const bookReasonIds = [...reasonFreqInBook.keys()]
  const safeTitle = book.title.replace(/'/g, "''")

  // ── Run all relation lookups in parallel ─────────────────────────────────────
  const [similarMatchesRes, newsRes, countryBansRes, reasonLinksRes] = await Promise.all([
    bookReasonIds.length >= 1
      ? supabase
          .from('ban_reason_links')
          .select('reason_id, bans!inner(book_id)')
          .in('reason_id', bookReasonIds)
      : Promise.resolve({ data: null }),
    book.title.length >= 4
      ? supabase
          .from('news_items')
          .select('id, title, source_url, source_name, published_at, summary')
          .eq('status', 'published')
          .or(`title.ilike.%${safeTitle}%,summary.ilike.%${safeTitle}%`)
          .order('published_at', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: null }),
    primaryCountry
      ? supabase
          .from('bans')
          .select('book_id, year_started, ban_reason_links(reasons(slug))')
          .eq('country_code', primaryCountry.code)
          .neq('book_id', book.id)
          .limit(50)
      : Promise.resolve({ data: null }),
    primaryReason
      ? supabase
          .from('ban_reason_links')
          .select('bans!inner(book_id, year_started, country_code, countries(name_en))')
          .eq('reason_id', primaryReason.id)
          .limit(100)
      : Promise.resolve({ data: null }),
  ])

  // ── Process similar books (≥2 reason overlap) ────────────────────────────────
  let similarTopIds: number[] = []
  if (similarMatchesRes.data) {
    const bookReasonCounts = new Map<number, Set<number>>()
    for (const m of similarMatchesRes.data as unknown as { reason_id: number; bans: { book_id: number } }[]) {
      const bookId = m.bans.book_id
      if (bookId === book.id) continue
      if (!bookReasonCounts.has(bookId)) bookReasonCounts.set(bookId, new Set())
      bookReasonCounts.get(bookId)!.add(m.reason_id)
    }
    similarTopIds = [...bookReasonCounts.entries()]
      .filter(([, reasons]) => reasons.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 4)
      .map(([id]) => id)
  }

  // ── Process country related books ────────────────────────────────────────────
  const countryBookInfo = new Map<number, { year: number | null; reasons: string[] }>()
  for (const r of (countryBansRes.data ?? []) as unknown as {
    book_id: number; year_started: number | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]) {
    const reasons = r.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s)
    const existing = countryBookInfo.get(r.book_id)
    if (!existing) {
      countryBookInfo.set(r.book_id, { year: r.year_started, reasons: [...new Set(reasons)] })
    } else {
      const merged = [...new Set([...existing.reasons, ...reasons])]
      const earliest = (r.year_started != null && (existing.year == null || r.year_started < existing.year))
        ? r.year_started : existing.year
      countryBookInfo.set(r.book_id, { year: earliest, reasons: merged })
    }
  }
  const countryRelatedIds = [...countryBookInfo.keys()].slice(0, 5)

  // ── Process reason related books ─────────────────────────────────────────────
  const reasonBookInfo = new Map<number, { year: number | null; countryCode: string; countryName: string }>()
  for (const r of (reasonLinksRes.data ?? []) as unknown as {
    bans: { book_id: number; year_started: number | null; country_code: string; countries: { name_en: string } | null } | null
  }[]) {
    const ban = r.bans
    if (!ban) continue
    const bookId = ban.book_id
    if (bookId === book.id) continue
    const existing = reasonBookInfo.get(bookId)
    if (!existing || (ban.year_started != null && (existing.year == null || ban.year_started < existing.year))) {
      reasonBookInfo.set(bookId, {
        year: ban.year_started,
        countryCode: ban.country_code,
        countryName: ban.countries?.name_en ?? ban.country_code,
      })
    }
  }
  const reasonRelatedIds = [...reasonBookInfo.keys()].slice(0, 5)

  // ── Single consolidated fetch for all related book details ───────────────────
  const allRelatedIds = [...new Set([...similarTopIds, ...countryRelatedIds, ...reasonRelatedIds])]
  type RelatedBookDetail = { id: number; slug: string; title: string; cover_url: string | null; authorName: string }
  const bookDetailMap = new Map<number, RelatedBookDetail>()
  if (allRelatedIds.length > 0) {
    const { data: details } = await supabase
      .from('books')
      .select('id, slug, title, cover_url, book_authors(authors(display_name))')
      .in('id', allRelatedIds)
    for (const d of (details ?? []) as unknown as {
      id: number; slug: string; title: string; cover_url: string | null
      book_authors: { authors: { display_name: string } | null }[]
    }[]) {
      bookDetailMap.set(d.id, {
        id: d.id, slug: d.slug, title: d.title, cover_url: d.cover_url,
        authorName: d.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
      })
    }
  }

  const similarBooks = similarTopIds
    .map(id => bookDetailMap.get(id))
    .filter((b): b is RelatedBookDetail => !!b)

  const booksInCountry = countryRelatedIds
    .map(id => {
      const detail = bookDetailMap.get(id)
      if (!detail) return null
      const meta = countryBookInfo.get(id)!
      return { ...detail, year: meta.year, reasons: meta.reasons }
    })
    .filter((b): b is RelatedBookDetail & { year: number | null; reasons: string[] } => !!b)

  const booksForReason = reasonRelatedIds
    .map(id => {
      const detail = bookDetailMap.get(id)
      if (!detail) return null
      const meta = reasonBookInfo.get(id)!
      return { ...detail, year: meta.year, countryCode: meta.countryCode, countryName: meta.countryName }
    })
    .filter((b): b is RelatedBookDetail & { year: number | null; countryCode: string; countryName: string } => !!b)

  const recentNews = (newsRes.data ?? []) as {
    id: number; title: string; source_name: string; source_url: string
    published_at: string | null; summary: string
  }[]

  // ── Deduplicated metadata for Related section ────────────────────────────────
  const uniqueCountries = [...new Map(
    book.bans
      .filter(b => b.countries)
      .map(b => [b.country_code, { code: b.country_code, name: b.countries!.name_en }])
  ).values()]

  const uniqueReasonSlugs = [...new Set(
    book.bans.flatMap(b => b.ban_reason_links.map(l => l.reasons?.slug).filter(Boolean) as string[])
  )]

  const primaryAuthor = book.book_authors[0]?.authors

  const titleQuery = encodeURIComponent(book.title)
  const bookshopHref = getBookshopUrl({ isbn13: book.isbn13, bookshopIsbn13: book.bookshop_isbn13, bookshopStatus: book.bookshop_status })

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
        ← All books
      </Link>

      {/* Hero */}
      <div className="flex flex-row gap-4 sm:gap-8 mb-8 sm:mb-10 items-start">
        <div className="shrink-0">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              width={240}
              height={360}
              className="rounded-lg shadow-md object-cover w-[110px] sm:w-[200px] h-auto"
              priority
              sizes="(max-width: 640px) 110px, 200px"
            />
          ) : (
            <BookCoverPlaceholder
              title={book.title}
              author={authorName(book)}
              slug={book.slug}
              className="w-[110px] sm:w-[200px]"
            />
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <h1
            className="text-2xl font-bold leading-snug"
            lang={book.original_language && book.original_language !== 'en' ? book.original_language : undefined}
          >
            {book.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {book.book_authors.map((ba, i) => {
              if (!ba.authors) return null
              const { display_name, slug: authorSlug } = ba.authors
              return (
                <span key={i}>
                  {i > 0 && ', '}
                  {authorSlug ? (
                    <Link href={`/authors/${authorSlug}`} className="hover:underline">
                      {display_name}
                    </Link>
                  ) : (
                    display_name
                  )}
                </span>
              )
            })}
            {book.first_published_year && (
              <span className="text-gray-400 dark:text-gray-500"> · {book.first_published_year}</span>
            )}
          </p>
          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.genres.map((slug) => (
                <GenreBadge key={slug} slug={slug} />
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-red-500 dark:text-red-400">
            Banned in {book.bans.length}{' '}
            {book.bans.length === 1 ? 'country' : 'countries'}
          </p>
          <ShareButtons
            url={`https://www.banned-books.org/books/${book.slug}`}
            title={book.title}
            banCount={book.bans.length}
          />
        </div>
      </div>

      {/* About the book */}
      {(book.description_book ?? book.description) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">About this book</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {book.description_book ?? book.description}
          </p>
        </section>
      )}

      {/* Why it was banned */}
      {book.description_ban && (
        <section className="mb-8 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-5 py-4">
          <h2 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Why it was banned</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{book.description_ban}</p>
        </section>
      )}

      {/* Censorship history (AI-generated context) */}
      {book.censorship_context && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Censorship history</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{book.censorship_context}</p>
        </section>
      )}

      {/* Bans table */}
      {sortedBans.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Bans</h2>
          <BanTimeline
            rows={timelineRows}
            firstPublishedYear={book.first_published_year}
            firstPublishedLabel="Published"
            caption={`${book.title}: ${book.bans.length} bans across ${timelineRows.length} ${timelineRows.length === 1 ? 'country' : 'countries'}.`}
          />
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Country</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Year</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">Where</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Reasons</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedBans.map((ban) => {
                    const source = ban.ban_source_links[0]?.ban_sources
                    return (
                      <React.Fragment key={ban.id}>
                        <tr className="align-top">
                          <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap text-xs sm:text-sm">
                            <Link
                              href={`/countries/${ban.country_code}`}
                              className="hover:underline"
                            >
                              {ban.countries?.name_en ?? ban.country_code}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs sm:text-sm">
                            {ban.year_started ?? '—'}
                            {ban.status === 'historical' && (
                              <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                lifted
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                            {ban.scopes?.label_en ?? '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {ban.ban_reason_links.map((l) =>
                                l.reasons ? (
                                  <ReasonBadge key={l.reasons.slug} slug={l.reasons.slug} />
                                ) : null
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {source ? (
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap text-xs"
                              >
                                {source.source_name}
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                        {ban.description && (
                          <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                            <td colSpan={5} className="px-3 pb-2.5 pt-0 text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                              {ban.description}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Editorial note — context/extended tier only; placed after bans so the
          factual record comes first and editorial framing follows.
          inclusion_rationale is INTERNAL (admin only) and is intentionally not
          rendered here. extended_context is the public essay slot. */}
      {book.warning_level && book.warning_level !== 'none' && (
        <section className="mb-10 border-t border-gray-200 dark:border-gray-800 pt-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Editorial note
          </h2>
          {book.warning_level === 'extended' && book.extended_context && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 mb-2 whitespace-pre-line">
              {book.extended_context}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
            On why we include works like this — see{' '}
            <Link href="/essays/what-we-document" className="underline hover:no-underline">
              What we document — and why that is a choice
            </Link>{' '}
            and{' '}
            <Link href="/essays/forbidden-knowledge-iceberg" className="underline hover:no-underline">
              Why &ldquo;forbidden knowledge&rdquo; iceberg lists collapse important distinctions
            </Link>
            .
          </p>
        </section>
      )}

      {/* Find this book */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-amber-600 dark:text-amber-400">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Find this book
        </h2>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-5 flex flex-col gap-3">
          {book.gutenberg_id && (
            <a
              href={`https://www.gutenberg.org/ebooks/${book.gutenberg_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-sm font-semibold text-emerald-800 dark:text-emerald-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Read free on Project Gutenberg
            </a>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <TrackedOutboundLink
              eventName="Bookshop Click"
              eventProperties={{ source: 'book', bookSlug: slug, isbn13: book.isbn13 ?? null, linkType: getBookshopLinkType(bookshopHref) }}
              href={bookshopHref}
              target="_blank"
              rel={BOOKSHOP_REL}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              Find on Bookshop.org
            </TrackedOutboundLink>
            <TrackedOutboundLink
              eventName="Kobo Click"
              eventProperties={{ source: 'book', bookSlug: slug, isbn13: book.isbn13 ?? null }}
              href={`https://www.kobo.com/search?query=${titleQuery}`}
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

      <CitationBlock
        entityType="book"
        entity={{
          title: book.title,
          authors: book.book_authors.map(ba => ba.authors?.display_name).filter((s): s is string => !!s),
          slug: book.slug,
        }}
        url={`https://www.banned-books.org/books/${book.slug}`}
      />

      {/* Related */}
      {(primaryAuthor?.slug || uniqueCountries.length > 0 || uniqueReasonSlugs.length > 0 || similarBooks.length > 0 || booksInCountry.length > 0 || booksForReason.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Related</h2>
          <div className="flex flex-col gap-5">

            {/* Author + countries + reasons chips */}
            <div className="flex flex-wrap gap-2">
              {primaryAuthor?.slug && (
                <Link
                  href={`/authors/${primaryAuthor.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  ✍️ More books by {primaryAuthor.display_name}
                </Link>
              )}
              {uniqueCountries.map(c => (
                <Link
                  key={c.code}
                  href={`/countries/${c.code}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  🌍 Books banned in {c.name}
                </Link>
              ))}
              {uniqueReasonSlugs.map(rSlug => (
                <Link
                  key={rSlug}
                  href={`/reasons/${rSlug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  More {reasonLabel(rSlug)} bans
                </Link>
              ))}
            </div>

            {/* Similar books */}
            {similarBooks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Books banned for similar reasons
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {similarBooks.map(sim => (
                    <Link
                      key={sim.slug}
                      href={`/books/${sim.slug}`}
                      className="group flex flex-col gap-2"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {sim.cover_url ? (
                          <Image
                            src={sim.cover_url}
                            alt={`Cover of ${sim.title}`}
                            width={160}
                            height={240}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <BookCoverPlaceholder title={sim.title} slug={sim.slug} className="h-full" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 group-hover:underline">
                        {sim.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Two-up: more books banned in [Country] / for [Reason] */}
            {((primaryCountry && booksInCountry.length > 0) || (primaryReason && booksForReason.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                {primaryCountry && booksInCountry.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
                      More books banned in{' '}
                      <Link
                        href={`/countries/${primaryCountry.code.toLowerCase()}`}
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        {primaryCountry.name}
                      </Link>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {booksInCountry.map(b => (
                        <Link
                          key={b.id}
                          href={`/books/${b.slug}`}
                          className="group flex gap-3 items-start"
                        >
                          <div className="shrink-0 w-12 h-[72px] relative overflow-hidden rounded shadow-sm">
                            {b.cover_url ? (
                              <Image
                                src={b.cover_url}
                                alt={`Cover of ${b.title}`}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : (
                              <BookCoverPlaceholder title={b.title} author={b.authorName} slug={b.slug} className="absolute inset-0 w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug group-hover:underline line-clamp-2">
                              {b.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                              {b.authorName}
                              {b.year != null && (
                                <span className="text-gray-400 dark:text-gray-500"> · banned {b.year}</span>
                              )}
                            </p>
                            {b.reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {b.reasons.slice(0, 3).map(r => <ReasonBadge key={r} slug={r} />)}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {primaryReason && booksForReason.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
                      More books banned for{' '}
                      <Link
                        href={`/reasons/${primaryReason.slug}`}
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        {reasonLabel(primaryReason.slug)}
                      </Link>{' '}
                      content
                    </h3>
                    <div className="flex flex-col gap-3">
                      {booksForReason.map(b => (
                        <Link
                          key={b.id}
                          href={`/books/${b.slug}`}
                          className="group flex gap-3 items-start"
                        >
                          <div className="shrink-0 w-12 h-[72px] relative overflow-hidden rounded shadow-sm">
                            {b.cover_url ? (
                              <Image
                                src={b.cover_url}
                                alt={`Cover of ${b.title}`}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : (
                              <BookCoverPlaceholder title={b.title} author={b.authorName} slug={b.slug} className="absolute inset-0 w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug group-hover:underline line-clamp-2">
                              {b.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                              {b.authorName}
                              {b.year != null && (
                                <span className="text-gray-400 dark:text-gray-500"> · banned {b.year}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Banned in {b.countryName}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent news */}
      {recentNews.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent news</h2>
            <Link href="/news" className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              All news →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentNews.map((item) => (
              <a
                key={item.id}
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:underline leading-snug mb-1">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-1.5">
                  {item.summary}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {item.source_name}
                  {item.published_at && (
                    <> · {new Date(item.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            url: `https://www.banned-books.org/books/${book.slug}`,
            ...(author ? { author: { '@type': 'Person', name: author } } : {}),
            ...(book.first_published_year ? { datePublished: book.first_published_year.toString() } : {}),
            ...(book.description_book ?? book.description ? { description: book.description_book ?? book.description } : {}),
            ...(book.cover_url ? { image: book.cover_url } : {}),
            ...(book.isbn13 ? { isbn: book.isbn13 } : {}),
            ...(book.original_language ? { inLanguage: book.original_language } : {}),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.banned-books.org' },
              { '@type': 'ListItem', position: 2, name: 'Books', item: 'https://www.banned-books.org' },
              { '@type': 'ListItem', position: 3, name: book.title, item: `https://www.banned-books.org/books/${book.slug}` },
            ],
          }),
        }}
      />
    </main>
  )
}
