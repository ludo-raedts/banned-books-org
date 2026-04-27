export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

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
  const { data: author } = await adminClient().from('authors').select('display_name').eq('slug', slug).single()
  if (!author) return {}
  return {
    title: `${author.display_name} — Banned Books`,
    description: `Books by ${author.display_name} that have been banned or challenged worldwide.`,
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data: author } = await supabase
    .from('authors')
    .select('id, display_name, slug')
    .eq('slug', slug)
    .single()

  if (!author) notFound()

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

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/stats"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors"
      >
        ← Stats
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3">{author.display_name}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-red-500 dark:text-red-400">
            {books.length} {books.length === 1 ? 'book' : 'books'} banned
          </span>
          <span>{totalBans} bans across {countryCount} {countryCount === 1 ? 'country' : 'countries'}</span>
          {activeBanCount > 0 && <span>{activeBanCount} currently active</span>}
        </div>
      </div>

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
                    <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center p-3">
                      {book.title}
                    </div>
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
    </main>
  )
}
