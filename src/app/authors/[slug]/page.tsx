export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { headers } from 'next/headers'
import { trackPageview } from '@/lib/trackPageview'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

type Author = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  photo_url: string | null
}

type Ban = {
  id: number
  status: string
  country_code: string
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

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

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

  const title = `${author.display_name} — Banned Books | banned-books.org`
  const description = `${author.display_name}'s books have been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}. See the full list.`
  return {
    title,
    description,
    alternates: { canonical: `/authors/${slug}` },
    openGraph: { title, description },
    twitter: { card: 'summary' },
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data: author } = await supabase
    .from('authors')
    .select('id, display_name, slug, bio, birth_year, death_year, birth_country, photo_url')
    .eq('slug', slug)
    .single()

  if (!author) notFound()
  const a = author as unknown as Author

  void trackPageview('author', author.id, new Request('https://x', { headers: await headers() }))

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
        bans(id, status, country_code, countries(name_en), ban_reason_links(reasons(slug)))
      `)
      .in('id', bookIds)
      .order('title')
    books = (data as unknown as Book[]) ?? []
  }

  const totalBans = books.reduce((sum, b) => sum + b.bans.length, 0)
  const countryCount = [...new Set(books.flatMap(b => b.bans.map(bn => bn.country_code)))].length
  const activeBanCount = books.reduce((sum, b) => sum + b.bans.filter(bn => bn.status === 'active').length, 0)

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
          .select('id, display_name, slug')
          .in('id', top5Ids.map(x => x.id))
          .not('slug', 'is', null)
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

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
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

      {/* Find books */}
      {(() => {
        const authorQuery = encodeURIComponent(a.display_name)
        return (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3">Find books by {a.display_name}</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`https://bookshop.org/search?keywords=${authorQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Bookshop.org
                </a>
                <a
                  href={`https://www.kobo.com/search?query=${authorQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Kobo
                </a>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                <Link href="/why-not-amazon" className="hover:underline">
                  Why we don&apos;t link to Amazon
                </Link>
              </p>
            </div>
          </section>
        )
      })()}

      {books.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No books recorded for this author yet.</p>
      ) : (
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
                      alt={`Cover of ${book.title}`}
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
