'use client'

// Client-side catalogue for a single reason page. The reason page itself is
// now static + ISR (no searchParams), so all filtering/pagination happens here
// against /api/books?reason=<slug> (which supports country/year/activeOnly/sort
// and is correctly paginated). Replaces the old server-side searchParams filter
// that forced the whole page to render dynamically on every request.
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'

export type ApiBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number | null
  book_authors?: { authors: { display_name: string } | null }[]
}

function authorOf(b: ApiBook): string {
  return b.book_authors?.map(ba => ba.authors?.display_name).filter(Boolean)[0] ?? ''
}

const PAGE = 48

const pill = (active: boolean) =>
  `px-3 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
    active ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600 hover:border-gray-400'
  }`

const selectCls =
  'text-xs border border-gray-200 rounded-full px-3 py-1 bg-white text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors'

type Sort = 'bans' | 'alpha' | 'popular'

export default function ReasonCatalogueBrowser({
  reason,
  initialBooks,
  initialTotal,
  countryOptions,
  years,
}: {
  reason: string
  initialBooks: ApiBook[]
  initialTotal: number
  countryOptions: { code: string; name: string }[]
  years: number[]
}) {
  const [country, setCountry] = useState('')
  const [year, setYear] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('bans')

  const [books, setBooks] = useState<ApiBook[]>(initialBooks)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Skip the fetch on first mount — the server already provided the default
  // (unfiltered, sort=bans) first page as initialBooks.
  const firstRender = useRef(true)

  const buildUrl = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ reason, sort, offset: String(offset), limit: String(PAGE) })
      if (country) p.set('country', country)
      if (year) p.set('year', year)
      if (activeOnly) p.set('activeOnly', '1')
      return `/api/books?${p.toString()}`
    },
    [reason, sort, country, year, activeOnly],
  )

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(buildUrl(0))
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setBooks(d.books ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => { if (!cancelled) { setBooks([]); setTotal(0) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [buildUrl])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await fetch(buildUrl(books.length))
      const d = await r.json()
      setBooks(prev => [...prev, ...(d.books ?? [])])
      if (typeof d.total === 'number') setTotal(d.total)
    } catch {
      /* ignore — the Load more button stays, user can retry */
    } finally {
      setLoadingMore(false)
    }
  }

  const hasFilter = !!(country || year || activeOnly)

  return (
    <div>
      <div className="space-y-2 mb-6">
        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium w-10 shrink-0">Sort:</span>
          {([['bans', 'Most banned'], ['alpha', 'Title'], ['popular', 'Most popular']] as [Sort, string][]).map(
            ([value, label]) => (
              <button key={value} onClick={() => setSort(value)} className={pill(sort === value)} aria-pressed={sort === value}>
                {label}
              </button>
            ),
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium w-10 shrink-0">Filter:</span>
          <label className="sr-only" htmlFor="reason-country">Country</label>
          <select id="reason-country" value={country} onChange={e => setCountry(e.target.value)} className={selectCls}>
            <option value="">All countries</option>
            {countryOptions.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="reason-year">Year</label>
          <select id="reason-year" value={year} onChange={e => setYear(e.target.value)} className={selectCls}>
            <option value="">All years</option>
            {years.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <button onClick={() => setActiveOnly(a => !a)} className={pill(activeOnly)} aria-pressed={activeOnly}>
            🚫 Active bans only
          </button>

          {hasFilter && (
            <button
              onClick={() => { setCountry(''); setYear(''); setActiveOnly(false) }}
              className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <p className="text-xs text-brand" aria-live="polite">
          {loading ? 'Filtering…' : `${total.toLocaleString('en')} ${total === 1 ? 'title' : 'titles'}`}
        </p>
      </div>

      {books.length === 0 && !loading ? (
        <p className="text-neutral-500 text-sm">No books match the current filters.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {books.map(book => (
            <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
              <div className="relative w-full aspect-[2/3] overflow-hidden rounded-sm bg-white border border-neutral-200">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={coverAlt(book.title, authorOf(book), book.first_published_year)}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 130px, (min-width: 768px) 16vw, 30vw"
                  />
                ) : (
                  <BookCoverPlaceholder title={book.title} author={authorOf(book)} slug={book.slug} className="absolute inset-0 w-full h-full" />
                )}
              </div>
              <h3 className="mt-2 font-serif text-xs font-medium leading-snug text-gray-900 group-hover:text-oxblood line-clamp-2 transition-colors">
                {book.title}
              </h3>
            </Link>
          ))}
        </div>
      )}

      {books.length < total && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {loadingMore ? 'Loading…' : `Load more (${(total - books.length).toLocaleString('en')} remaining)`}
          </button>
        </div>
      )}
    </div>
  )
}
