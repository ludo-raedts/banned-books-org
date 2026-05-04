import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'

export const revalidate = 86400

const CURRENT_YEAR = new Date().getFullYear()
const FIRST_YEAR = 2000

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

export async function generateStaticParams() {
  const years = []
  for (let y = 2015; y <= CURRENT_YEAR; y++) {
    years.push({ year: String(y) })
  }
  return years
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>
}): Promise<Metadata> {
  const { year } = await params
  return {
    title: `Books Banned in ${year}`,
    description: `All books with documented bans that started in ${year}, grouped by country.`,
    alternates: { canonical: `/banned-books/${year}` },
  }
}

type BanRow = {
  book_id: number
  country_code: string
  countries: { name_en: string } | null
  books: {
    id: number
    title: string
    slug: string
    cover_url: string | null
    book_authors: { authors: { display_name: string } | null }[]
  } | null
}

type BookEntry = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  author: string
  bans: { countryCode: string; countryName: string }[]
}

export default async function BannedBooksYearPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const yearNum = parseInt(year, 10)

  if (isNaN(yearNum) || yearNum < 1000 || yearNum > CURRENT_YEAR + 1) notFound()

  const supabase = adminClient()

  let rawBans: BanRow[] = []
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('bans')
        .select('book_id, country_code, countries(name_en), books(id, title, slug, cover_url, book_authors(authors(display_name)))')
        .eq('year_started', yearNum)
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      rawBans = rawBans.concat(data as unknown as BanRow[])
      if (data.length < 1000) break
      offset += 1000
    }
  }

  // Group bans by book
  const bookMap = new Map<number, BookEntry>()
  for (const ban of rawBans) {
    if (!ban.books) continue
    const book = ban.books
    if (!bookMap.has(book.id)) {
      bookMap.set(book.id, {
        id: book.id,
        title: book.title,
        slug: book.slug,
        cover_url: book.cover_url,
        author: book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
        bans: [],
      })
    }
    bookMap.get(book.id)!.bans.push({
      countryCode: ban.country_code,
      countryName: ban.countries?.name_en ?? ban.country_code,
    })
  }

  const books = [...bookMap.values()].sort((a, b) => b.bans.length - a.bans.length)

  // Group by country for the sidebar summary
  const countryTotals = new Map<string, { name: string; count: number }>()
  for (const ban of rawBans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const code = ban.country_code
    const entry = countryTotals.get(code) ?? { name, count: 0 }
    entry.count++
    countryTotals.set(code, entry)
  }
  const topCountries = [...countryTotals.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  // Prev / next year nav (only if within range)
  const prevYear = yearNum - 1 >= FIRST_YEAR ? yearNum - 1 : null
  const nextYear = yearNum + 1 <= CURRENT_YEAR ? yearNum + 1 : null

  if (books.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/stats" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 inline-block transition-colors">
          ← Stats
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Books Banned in {year}</h1>
        <p className="text-gray-500 dark:text-gray-400">No bans with a recorded start year of {year} in our catalogue.</p>
        <div className="flex gap-4 mt-6 text-sm">
          {prevYear && <Link href={`/banned-books/${prevYear}`} className="text-brand hover:underline">← {prevYear}</Link>}
          {nextYear && <Link href={`/banned-books/${nextYear}`} className="text-brand hover:underline">{nextYear} →</Link>}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/stats" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 inline-block transition-colors">
        ← Stats
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
            Books Banned in {year}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {books.length} {books.length === 1 ? 'book' : 'books'}, {rawBans.length} {rawBans.length === 1 ? 'ban' : 'bans'} documented
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          {prevYear && (
            <Link href={`/banned-books/${prevYear}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              ← {prevYear}
            </Link>
          )}
          {nextYear && (
            <Link href={`/banned-books/${nextYear}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              {nextYear} →
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Book list */}
        <div className="flex-1 min-w-0 divide-y divide-gray-100 dark:divide-gray-800">
          {books.map((book, i) => (
            <Link
              key={book.id}
              href={`/books/${book.slug}`}
              className="flex items-center gap-4 py-3 group hover:bg-gray-50 dark:hover:bg-gray-900/50 -mx-3 px-3 rounded-lg transition-colors"
            >
              <span className="w-7 shrink-0 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500 font-mono">
                {i + 1}
              </span>
              <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={`Cover of ${book.title}`}
                    width={36}
                    height={48}
                    className="w-full h-full object-cover"
                    sizes="36px"
                  />
                ) : (
                  <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:underline truncate">
                  {book.title}
                </p>
                {book.author && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{book.author}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                  {book.bans.map(b => `${countryFlag(b.countryCode)} ${b.countryName}`).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-sm font-bold tabular-nums text-red-500 dark:text-red-400">
                  {book.bans.length}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {book.bans.length === 1 ? 'ban' : 'bans'}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Country sidebar */}
        {topCountries.length > 0 && (
          <aside className="lg:w-52 shrink-0">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              By country
            </h2>
            <div className="space-y-1.5">
              {topCountries.map(([code, { name, count }]) => (
                <Link
                  key={code}
                  href={`/countries/${code}`}
                  className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{countryFlag(code)}</span>
                    <span className="truncate group-hover:underline">{name}</span>
                  </span>
                  <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 shrink-0">{count}</span>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}
