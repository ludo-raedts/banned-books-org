export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await adminClient()
    .from('books')
    .select('title, description, cover_url, book_authors(authors(display_name))')
    .eq('slug', slug)
    .single()

  if (!data) return {}

  const author = (data.book_authors as unknown as { authors: { display_name: string } | null }[])
    .map((ba) => ba.authors?.display_name).filter(Boolean).join(', ')

  const title = `${data.title}${author ? ` by ${author}` : ''}`
  const description = data.description
    ? data.description.slice(0, 155) + (data.description.length > 155 ? '…' : '')
    : `${data.title}${author ? ` by ${author}` : ''} is among the most banned books in the world.`

  return {
    title,
    description,
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
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
  ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
}

type BookDetail = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
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
      id, title, slug, cover_url, description, first_published_year, genres,
      book_authors(authors(display_name)),
      bans(
        id, year_started, status, country_code,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug)),
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

  const titleQuery = encodeURIComponent(book.title)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        ← All books
      </Link>

      {/* Hero */}
      <div className="flex gap-8 mb-10">
        <div className="shrink-0">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              width={160}
              height={240}
              className="rounded-lg shadow-md object-cover"
            />
          ) : (
            <div className="w-[160px] h-[240px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm text-center p-4">
              No cover
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <h1 className="text-2xl font-bold leading-snug">{book.title}</h1>
          <p className="text-gray-600">
            {author}
            {book.first_published_year && (
              <span className="text-gray-400"> · {book.first_published_year}</span>
            )}
          </p>
          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.genres.map((slug) => (
                <GenreBadge key={slug} slug={slug} />
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-red-600">
            Banned in {book.bans.length}{' '}
            {book.bans.length === 1 ? 'country' : 'countries'}
          </p>
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <p className="text-gray-700 leading-relaxed mb-10">{book.description}</p>
      )}

      {/* Bans table */}
      {sortedBans.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Bans</h2>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">Country</th>
                  <th className="text-left px-4 py-2.5">Year</th>
                  <th className="text-left px-4 py-2.5">Where</th>
                  <th className="text-left px-4 py-2.5">Reasons</th>
                  <th className="text-left px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedBans.map((ban) => {
                  const source = ban.ban_source_links[0]?.ban_sources
                  return (
                    <tr key={ban.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/countries/${ban.country_code}`}
                          className="hover:underline"
                        >
                          {ban.countries?.name_en ?? ban.country_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {ban.year_started ?? '—'}
                        {ban.status === 'historical' && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            lifted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
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
                      <td className="px-4 py-3">
                        {source ? (
                          <a
                            href={source.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {source.source_name}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Find this book */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Find this book</h2>
        <div className="border rounded-xl p-5 flex flex-col sm:flex-row gap-3">
          <a
            href={`https://bookshop.org/search?keywords=${titleQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-400 text-sm font-medium text-gray-700 transition-colors"
          >
            Bookshop.org
          </a>
          <a
            href={`https://www.kobo.com/search?query=${titleQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-400 text-sm font-medium text-gray-700 transition-colors"
          >
            Kobo
          </a>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            author: author
              ? { '@type': 'Person', name: author }
              : undefined,
            datePublished: book.first_published_year?.toString(),
            description: book.description ?? undefined,
            image: book.cover_url ?? undefined,
          }),
        }}
      />
    </main>
  )
}
