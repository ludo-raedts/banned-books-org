export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
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
  const upperCode = code.toUpperCase()
  const supabase = adminClient()

  // rows: 1 | fields: [name_en] | reason: page title
  // rows: 1 (count only) | reason: ban count for title/description
  const [{ data: country }, { count: N }] = await Promise.all([
    supabase.from('countries').select('name_en').eq('code', upperCode).single(),
    supabase.from('bans').select('*', { count: 'exact', head: true }).eq('country_code', upperCode),
  ])

  if (!country) return {}

  const banCount = N ?? 0
  const title = `Books Banned in ${country.name_en} — ${banCount} ${banCount === 1 ? 'ban' : 'bans'} | Banned Books`
  const description = `Browse all ${banCount} books banned or challenged in ${country.name_en}.`

  return { title, description, alternates: { canonical: `/countries/${code.toLowerCase()}` }, openGraph: { title, description } }
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

  // rows: 1 | fields: [code, name_en, slug, description] | reason: country header + description
  const { data: country, error: ce } = await supabase
    .from('countries').select('code, name_en, slug, description').eq('code', upperCode).single()

  if (ce || !country) notFound()

  // rows: 1 (count only) | reason: ban count display
  const { count: banCount } = await supabase
    .from('bans').select('*', { count: 'exact', head: true }).eq('country_code', upperCode)

  // rows: ≤100 | fields: book card data | reason: paginated grid; first page only
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
    .range(0, 99)

  if (error) throw error
  const books = (data as unknown as Book[]) ?? []
  const totalBanCount = banCount ?? 0

  // ── Related countries: find countries with most book overlap ──────────────────
  // Step 1: collect all book_ids banned in this country (paginated, lightweight)
  let allBookIds: number[] = []
  {
    let offset = 0
    while (true) {
      const { data: idRows } = await supabase
        .from('bans').select('book_id').eq('country_code', upperCode).range(offset, offset + 999)
      if (!idRows || idRows.length === 0) break
      allBookIds = allBookIds.concat(idRows.map(r => r.book_id as number))
      if (idRows.length < 1000) break
      offset += 1000
    }
  }

  // Step 2: for those book_ids, find bans in other countries (batched parallel)
  const overlapCounts = new Map<string, number>()
  if (allBookIds.length > 0) {
    const CHUNK = 400
    const chunks: number[][] = []
    for (let i = 0; i < allBookIds.length; i += CHUNK) chunks.push(allBookIds.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map(chunk =>
        supabase.from('bans').select('country_code, book_id').in('book_id', chunk).neq('country_code', upperCode)
      )
    )
    for (const { data: rows } of results) {
      const seen = new Set<string>() // count each country once per book
      for (const row of (rows ?? []) as { country_code: string; book_id: number }[]) {
        const key = `${row.country_code}:${row.book_id}`
        if (!seen.has(key)) {
          seen.add(key)
          overlapCounts.set(row.country_code, (overlapCounts.get(row.country_code) ?? 0) + 1)
        }
      }
    }
  }

  // Step 3: pick top 5 and fetch their names
  const top5Codes = [...overlapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }))

  type RelatedCountry = { code: string; name_en: string; count: number }
  let relatedCountries: RelatedCountry[] = []
  if (top5Codes.length > 0) {
    const { data: names } = await supabase
      .from('countries').select('code, name_en').in('code', top5Codes.map(c => c.code))
    const nameMap = new Map((names ?? []).map(c => [c.code, c.name_en]))
    relatedCountries = top5Codes.map(({ code, count }) => ({
      code, count, name_en: nameMap.get(code) ?? code,
    }))
  }

  // Build timeline: bans by decade (or by year if ≤ 30 distinct years)
  const countryBansForTimeline = books.flatMap(b =>
    b.bans.map(ban => ban.year_started)
  ).filter((y): y is number => !!y)

  const yearCounts = new Map<number, number>()
  for (const y of countryBansForTimeline) yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1)
  const useYears = yearCounts.size <= 35
  const timelineCounts = new Map<number, number>()
  for (const y of countryBansForTimeline) {
    const key = useYears ? y : Math.floor(y / 10) * 10
    timelineCounts.set(key, (timelineCounts.get(key) ?? 0) + 1)
  }
  const timeline = [...timelineCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ key: k, count: v }))
  const maxTimeline = Math.max(...timeline.map(t => t.count), 1)

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/countries" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
        ← All countries
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <span className="text-5xl leading-none" aria-hidden="true">{countryFlag(upperCode)}</span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{country.name_en}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-red-500 dark:text-red-400">{totalBanCount} banned {totalBanCount === 1 ? 'book' : 'books'}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {country.description && (
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-10 max-w-2xl">{country.description}</p>
      )}

      {/* Timeline */}
      {timeline.length >= 3 && (
        <div className="mb-10">
          <h2 className="text-base font-semibold mb-4 text-gray-700 dark:text-gray-300">
            Bans {useYears ? 'by year' : 'by decade'}
          </h2>
          {/* dir=rtl on outer starts scroll at right (newest); dir=ltr on inner keeps order */}
          <div className="overflow-x-auto pb-1" dir="rtl">
            <div className="inline-flex items-end gap-1 h-20" dir="ltr">
              {timeline.map(t => (
                <div key={t.key} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: useYears ? '1.5rem' : '2.5rem' }}>
                  <div
                    className="rounded-t bg-red-500 dark:bg-red-600"
                    style={{
                      width: useYears ? '1rem' : '2rem',
                      height: `${(t.count / maxTimeline * 64).toFixed(0)}px`,
                      minHeight: '2px',
                    }}
                    title={`${t.key}${useYears ? '' : 's'}: ${t.count}`}
                  />
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">
                    {useYears ? t.key : `${t.key}s`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Book grid */}
      {books.length === 0 ? (
        <p className="text-gray-500">No banned books recorded for this country yet.</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-4">
            Banned books
            {totalBanCount > 100 && (
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                (showing first 100 of {totalBanCount})
              </span>
            )}
          </h2>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
            {books.map((book) => {
              const ban = book.bans[0]
              return (
                <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-row gap-3 items-start sm:flex-col sm:gap-0">
                  {/* Cover */}
                  <div className="shrink-0 w-[60px] h-[90px] sm:w-full sm:h-auto sm:mb-2 relative overflow-hidden rounded shadow-sm">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 60px, 160px"
                      />
                    ) : (
                      <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} className="absolute inset-0 w-full h-full" />
                    )}
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{authorName(book)}</p>
                    {book.description && (
                      <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{book.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {book.genres.slice(0, 2).map((g) => <GenreBadge key={g} slug={g} />)}
                      {getReasons(book).slice(0, 2).map((r) => <ReasonBadge key={r} slug={r} />)}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {ban?.scopes?.label_en ?? 'Ban'}
                      {ban?.year_started ? ` · ${ban.year_started}` : ''}
                      {ban?.status === 'historical' ? ' · lifted' : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
      {/* Related countries */}
      {relatedCountries.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Countries with similar bans
          </h2>
          <div className="flex flex-wrap gap-3">
            {relatedCountries.map(rc => (
              <Link
                key={rc.code}
                href={`/countries/${rc.code.toLowerCase()}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors group"
              >
                <span className="text-xl leading-none">{countryFlag(rc.code)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:underline leading-snug">
                    {rc.name_en}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {rc.count} {rc.count === 1 ? 'book' : 'books'} in common
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
