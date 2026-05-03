export const dynamic = 'force-dynamic'

import React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge, { reasonLabel } from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await adminClient()
    .from('books')
    .select('title, description, description_book, cover_url, book_authors(authors(display_name)), bans(id)')
    .eq('slug', slug)
    .single()

  if (!data) return {}

  const author = (data.book_authors as unknown as { authors: { display_name: string } | null }[])
    .map((ba) => ba.authors?.display_name).filter(Boolean).join(', ')

  const N = (data.bans as unknown as { id: number }[]).length
  const rawTitle = `${data.title}${author ? ` by ${author}` : ''} — Banned in ${N} ${N === 1 ? 'country' : 'countries'} | Banned Books`
  const title = rawTitle.length > 155 ? rawTitle.slice(0, 152) + '…' : rawTitle
  const rawDesc = `${data.title} has been banned or challenged in ${N} ${N === 1 ? 'country' : 'countries'}. Learn where, when, and why this book was censored.`
  const description = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '…' : rawDesc

  return {
    title,
    description,
    alternates: { canonical: `/books/${slug}` },
    openGraph: {
      title,
      description,
      ...(data.cover_url ? { images: [{ url: data.cover_url }] } : {}),
    },
  }
}

type Ban = {
  id: number
  year_started: number | null
  status: string
  country_code: string
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { id: number; slug: string } | null }[]
  ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
}

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
      book_authors(authors(display_name, slug)),
      bans(
        id, year_started, status, country_code, description,
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

  const sortedBans = [...book.bans].sort((a, b) =>
    (a.year_started ?? 9999) - (b.year_started ?? 9999)
  )

  // ── Similar books ────────────────────────────────────────────────────────────
  const bookReasonIds = [...new Set(
    book.bans.flatMap(b =>
      b.ban_reason_links.map(l => l.reasons?.id).filter((id): id is number => id != null)
    )
  )]

  let similarBooks: { slug: string; title: string; cover_url: string | null }[] = []

  if (bookReasonIds.length >= 1) {
    const { data: matches } = await supabase
      .from('ban_reason_links')
      .select('reason_id, bans!inner(book_id)')
      .in('reason_id', bookReasonIds)

    const bookReasonCounts = new Map<number, Set<number>>()
    for (const m of (matches ?? []) as unknown as { reason_id: number; bans: { book_id: number } }[]) {
      const bookId = m.bans.book_id
      if (bookId === book.id) continue
      if (!bookReasonCounts.has(bookId)) bookReasonCounts.set(bookId, new Set())
      bookReasonCounts.get(bookId)!.add(m.reason_id)
    }

    const topIds = [...bookReasonCounts.entries()]
      .filter(([, reasons]) => reasons.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 4)
      .map(([id]) => id)

    if (topIds.length > 0) {
      const { data: simBooks } = await supabase
        .from('books')
        .select('slug, title, cover_url')
        .in('id', topIds)
      similarBooks = (simBooks ?? []) as typeof similarBooks
    }
  }

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

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
        ← All books
      </Link>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-10">
        <div className="shrink-0 flex justify-center sm:block">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              width={240}
              height={360}
              className="rounded-lg shadow-md object-cover"
              priority
              sizes="240px"
            />
          ) : (
            <BookCoverPlaceholder
              title={book.title}
              author={authorName(book)}
              slug={book.slug}
              className="w-[240px]"
            />
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <h1 className="text-2xl font-bold leading-snug">{book.title}</h1>
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
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap">Country</th>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap">Year</th>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">Where</th>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap">Reasons</th>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedBans.map((ban) => {
                    const source = ban.ban_source_links[0]?.ban_sources
                    return (
                      <React.Fragment key={ban.id}>
                        <tr className="align-top">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            <Link
                              href={`/countries/${ban.country_code}`}
                              className="hover:underline"
                            >
                              {ban.countries?.name_en ?? ban.country_code}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {ban.year_started ?? '—'}
                            {ban.status === 'historical' && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                lifted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                            {ban.scopes?.label_en ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {ban.ban_reason_links.map((l) =>
                                l.reasons ? (
                                  <ReasonBadge key={l.reasons.slug} slug={l.reasons.slug} />
                                ) : null
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {source ? (
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
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
                            <td colSpan={5} className="px-4 pb-3 pt-0 text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
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

      {/* Related */}
      {(primaryAuthor?.slug || uniqueCountries.length > 0 || uniqueReasonSlugs.length > 0 || similarBooks.length > 0) && (
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
          </div>
        </section>
      )}

      {/* Find this book */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Find this book</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-3">
          {book.gutenberg_id && (
            <a
              href={`https://www.gutenberg.org/ebooks/${book.gutenberg_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-sm font-semibold text-emerald-800 dark:text-emerald-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Read free on Project Gutenberg
            </a>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://bookshop.org/search?keywords=${titleQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              Bookshop.org
            </a>
            <a
              href={`https://www.kobo.com/search?query=${titleQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              Kobo
            </a>
          </div>
        </div>
      </section>

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
