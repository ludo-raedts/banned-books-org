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
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  const { data } = await adminClient()
    .from('countries')
    .select('name_en, description')
    .eq('code', code.toUpperCase())
    .single()

  if (!data) return {}

  const title = `Books Banned in ${data.name_en}`
  const description = data.description
    ? data.description.slice(0, 155) + (data.description.length > 155 ? '…' : '')
    : `Browse books banned in ${data.name_en} and learn about the history of censorship there.`

  return { title, description, openGraph: { title, description } }
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

function getReasons(book: Book): string[] {
  return [...new Set(book.bans.flatMap((ban) =>
    ban.ban_reason_links.map((l) => l.reasons?.slug).filter((s): s is string => !!s)
  ))]
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

  // Load country + all countries (for ranking)
  const [{ data: country, error: ce }, { data: allCountries }] = await Promise.all([
    supabase.from('countries').select('code, name_en, slug, description').eq('code', upperCode).single(),
    supabase.from('countries').select('code'),
  ])

  if (ce || !country) notFound()

  // Count bans per country for ranking
  const { data: allBans } = await supabase.from('bans').select('country_code')
  const banCounts: Record<string, number> = {}
  allBans!.forEach((b) => { banCounts[b.country_code] = (banCounts[b.country_code] ?? 0) + 1 })

  const ranked = Object.entries(banCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([cc], i) => ({ code: cc, rank: i + 1 }))

  const totalCountries = (allCountries ?? []).filter((c) => (banCounts[c.code] ?? 0) > 0).length
  const rankEntry = ranked.find((r) => r.code === upperCode)
  const rank = rankEntry?.rank ?? null
  const banCount = banCounts[upperCode] ?? 0

  // Load books banned in this country
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

  if (error) throw error
  const books = (data as unknown as Book[]) ?? []

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        ← All books
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <span className="text-5xl leading-none" aria-hidden="true">{countryFlag(upperCode)}</span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{country.name_en}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500">
            <span className="font-medium text-red-600">{banCount} banned {banCount === 1 ? 'book' : 'books'}</span>
            {rank && (
              <>
                <span className="text-gray-300">·</span>
                <span>
                  Ranked <span className="font-semibold text-gray-700">#{rank}</span> of {totalCountries} countries
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {country.description && (
        <p className="text-gray-700 leading-relaxed mb-10 max-w-2xl">{country.description}</p>
      )}

      {/* Book grid */}
      {books.length === 0 ? (
        <p className="text-gray-500">No banned books recorded for this country yet.</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-4">Banned books</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {books.map((book) => {
              const ban = book.bans[0]
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
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-3">
                        {book.title}
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug group-hover:underline">{book.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{authorName(book)}</p>
                  {book.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{book.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {book.genres.map((g) => <GenreBadge key={g} slug={g} />)}
                    {getReasons(book).map((r) => <ReasonBadge key={r} slug={r} />)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {ban?.scopes?.label_en ?? 'Ban'}
                    {ban?.year_started ? ` · ${ban.year_started}` : ''}
                    {ban?.status === 'historical' ? ' · lifted' : ''}
                  </p>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
