export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'The 100 Most Banned Books in the World',
  description:
    'A ranked list of the most censored books worldwide, ordered by number of countries that have banned them. From George Orwell to Toni Morrison.',
  alternates: { canonical: '/top-100-banned-books' },
}

type BookRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string; countries: { name_en: string } | null }[]
}

type RankedBook = BookRow & { distinct_countries: number; total_bans: number }

async function fetchTop100(): Promise<RankedBook[]> {
  const supabase = adminClient()
  const SELECT = 'id, title, slug, cover_url, book_authors(authors(display_name)), bans(country_code, countries(name_en))'

  let all: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select(SELECT)
      // Stable order across pages — without it .range() skips/dupes rows past
      // 1000 and corrupts the ranking on this flagship page.
      .order('id')
      .range(offset, offset + 999)
    // Throw rather than render a partial/empty ranking on a transient error.
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as BookRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  // Rank by geographic spread, with raw ban-event count as tiebreaker. Sorting
  // on b.bans.length alone made PEN America's per-district records dominate
  // the top of the list (a US-only book with 200 district records outranking
  // a classic banned in 6 countries).
  const ranked: RankedBook[] = all.map(b => ({
    ...b,
    distinct_countries: new Set(b.bans.map(x => x.country_code)).size,
    total_bans: b.bans.length,
  }))
  ranked.sort((a, b) => b.distinct_countries - a.distinct_countries || b.total_bans - a.total_bans)
  return ranked.slice(0, 100)
}

function topCountries(bans: BookRow['bans'], n = 3): string[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const ban of bans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const entry = counts.get(name) ?? { name, count: 0 }
    entry.count++
    counts.set(name, entry)
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((e) => e.name)
}

export default async function Top100Page() {
  const books = await fetchTop100()
  const topCountryCount = books[0]?.distinct_countries ?? 0
  const totalEventsSum = books.reduce((sum, b) => sum + b.total_bans, 0)

  const heroStats = [
    { value: '100', label: 'Books ranked' },
    { value: topCountryCount.toLocaleString('en'), label: 'Countries · #1 entry' },
    { value: totalEventsSum.toLocaleString('en'), label: 'Documented events' },
  ]

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Top-list · Ranked by geographic spread</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            The 100 most banned books in the world.
          </h1>

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

            <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700">
              Ranked by the number of countries that have banned each title, with raw ban-event count as a tiebreaker. Ranking by geographic spread (rather than raw event count) prevents one country&apos;s per-district reporting from dominating the list. A &ldquo;ban&rdquo; means a formal government prohibition, a court-ordered removal, or a documented school or library challenge resulting in restriction — each with a verifiable source. See our{' '}
              <Link href="/methodology" className="text-oxblood hover:underline">methodology</Link>{' '}for the full definition.
            </p>
          </div>
        </div>
      </section>

      {/* ── The list ──────────────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Updated daily">
        <ol className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
          {books.map((book, i) => {
            const rank = i + 1
            const author = book.book_authors
              .map((ba) => ba.authors?.display_name)
              .filter(Boolean)
              .join(', ')
            const countries = topCountries(book.bans)

            return (
              <li key={book.id}>
                <Link
                  href={`/books/${book.slug}`}
                  className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors"
                >
                  {/* Rank */}
                  <span className="w-10 shrink-0 text-right font-serif text-xl tabular-nums text-oxblood font-semibold">
                    {rank}
                  </span>

                  {/* Cover */}
                  <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
                        alt={coverAlt(book.title, author)}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                    )}
                  </div>

                  {/* Title + author + sample countries */}
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base font-medium text-gray-900 leading-snug group-hover:text-oxblood transition-colors truncate">
                      {book.title}
                    </p>
                    {author && (
                      <p className="text-xs text-neutral-600 truncate">{author}</p>
                    )}
                    {countries.length > 0 && (
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {countries.join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Country count */}
                  <div className="shrink-0 text-right">
                    <span className="font-serif text-xl font-semibold tabular-nums text-oxblood">
                      {book.distinct_countries}
                    </span>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {book.distinct_countries === 1 ? 'country' : 'countries'}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      </SectionShell>

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <SectionShell tone="white">
        <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
          Data is updated daily. Bans reflect documented records in our catalogue — coverage is uneven and skewed toward countries with systematic reporting (notably the United States).{' '}
          <Link href="/methodology" className="text-oxblood hover:underline">Read the methodology →</Link>
        </p>
      </SectionShell>
    </main>
  )
}
