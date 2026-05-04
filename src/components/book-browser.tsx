'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { BookOpen, Globe, Search as SearchIcon } from 'lucide-react'
import GenreBadge from './genre-badge'
import ReasonBadge, { reasonLabel, reasonIcon } from './reason-badge'

const FILTER_REASONS = ['lgbtq', 'sexual', 'political', 'religious', 'racial', 'violence', 'language', 'drugs']

export type Ban = {
  id: number
  status: string
  country_code: string
  year_started: number | null
  countries: { name_en: string } | null
  scopes: { slug: string; label_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

export type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description_book: string | null
  openlibrary_work_id?: string | null
  isbn13?: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: Ban[]
}

export type NewsPreview = {
  id: number
  source_name: string
  published_at: string | null
  summary: string
}

export type CountryOption = {
  code: string
  name: string
  count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function banLabel(bans: Ban[]): string {
  const countries = [...new Set(bans.map(b => b.country_code))]
  if (countries.length === 0) return 'No recorded bans'
  if (countries.length === 1) {
    const name = bans[0].countries?.name_en
    return name ? `Banned in ${name}` : 'Banned in 1 country'
  }
  return `Banned in ${countries.length} countries`
}

function authorName(book: Book): string {
  return book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
}

function getReasons(bans: Ban[]): string[] {
  return [...new Set(bans.flatMap(b => b.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s)))]
}

function buildParams(opts: {
  q: string; scope: string | null; country: string; activeOnly: boolean; reason: string | null; offset: number
}) {
  const p = new URLSearchParams()
  if (opts.q)        p.set('q', opts.q)
  if (opts.scope)    p.set('scope', opts.scope)
  if (opts.country)  p.set('country', opts.country)
  if (opts.activeOnly) p.set('activeOnly', '1')
  if (opts.reason)   p.set('reason', opts.reason)
  p.set('offset', String(opts.offset))
  return p.toString()
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children, color = 'dark',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: 'dark' | 'red'
}) {
  const activeClass = color === 'red'
    ? 'bg-red-600 text-white border-red-600'
    : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
        active ? activeClass : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
    >
      {children}
    </button>
  )
}

function NewsPanel({ items, compact }: { items: NewsPreview[]; compact?: boolean }) {
  if (!items.length) return null
  return (
    <div className={compact ? 'bg-gray-50 dark:bg-gray-900/60 rounded-lg p-4 h-full flex flex-col' : 'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'}>
      <div className={compact ? 'mb-3' : 'px-4 pt-4 pb-2'}>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Happening now</span>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Book bans are not history.</p>
      </div>
      <div className={`${compact ? 'flex flex-col flex-1 divide-y divide-gray-100 dark:divide-gray-800' : 'divide-y divide-gray-100 dark:divide-gray-800'}`}>
        {items.map(item => (
          <Link key={item.id} href="/news" className={`group/item ${compact ? 'py-2.5 first:pt-0' : 'px-4 py-3'}`}>
            <p className={`text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-${compact ? 3 : 2} group-hover/item:text-gray-900 dark:group-hover/item:text-gray-100 transition-colors`}>
              {item.summary}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {item.source_name}
              {item.published_at && <span> · {formatNewsDate(item.published_at)}</span>}
            </p>
          </Link>
        ))}
      </div>
      <Link href="/news" className={`${compact ? 'mt-3 text-xs text-right' : 'px-4 py-3 text-sm text-brand font-medium'} text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors block`}>
        All news →
      </Link>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BookBrowser({
  initialBooks,
  totalCount = 0,
  latestNews = [],
  featuredBook = null,
  countries = [],
}: {
  initialBooks: Book[]
  totalCount?: number
  latestNews?: NewsPreview[]
  featuredBook?: Book | null
  countries?: CountryOption[]
}) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [scope, setScope] = useState<string | null>(null)
  const [country, setCountry] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  const [displayBooks, setDisplayBooks] = useState<Book[]>(initialBooks)
  const [total, setTotal] = useState(totalCount)
  const [nextOffset, setNextOffset] = useState(initialBooks.length)
  const [loadingFilter, setLoadingFilter] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(id)
  }, [q])

  const hasFilters = !!(debouncedQ || scope || country || activeOnly || reason)

  // Re-fetch when filters change
  useEffect(() => {
    if (!hasFilters) {
      setDisplayBooks(initialBooks)
      setTotal(totalCount)
      setNextOffset(initialBooks.length)
      return
    }
    let cancelled = false
    setLoadingFilter(true)
    fetch(`/api/books?${buildParams({ q: debouncedQ, scope, country, activeOnly, reason, offset: 0 })}`)
      .then(r => r.json())
      .then(({ books, total: t }) => {
        if (!cancelled) {
          setDisplayBooks(books ?? [])
          setTotal(t ?? 0)
          setNextOffset((books ?? []).length)
          setLoadingFilter(false)
        }
      })
      .catch(() => { if (!cancelled) setLoadingFilter(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, scope, country, activeOnly, reason])

  const hasMore = displayBooks.length < total

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetch(`/api/books?${buildParams({ q: debouncedQ, scope, country, activeOnly, reason, offset: nextOffset })}`)
      .then(r => r.json())
      .then(({ books, total: t }) => {
        setDisplayBooks(prev => [...prev, ...(books ?? [])])
        setTotal(t ?? 0)
        setNextOffset(prev => prev + (books ?? []).length)
        setLoadingMore(false)
      })
      .catch(() => setLoadingMore(false))
  }, [loadingMore, hasMore, debouncedQ, scope, country, activeOnly, reason, nextOffset])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  function clearAll() {
    setQ(''); setScope(null); setCountry(''); setActiveOnly(false); setReason(null)
  }

  const isSearching = q.length > 0
  const anyFilter = !!(q || scope || country || activeOnly || reason)
  const hasNews = latestNews.length > 0

  // Exclude featured book from grid
  const gridBooks = featuredBook ? displayBooks.filter(b => b.id !== featuredBook.id) : displayBooks

  return (
    <div className="flex flex-col gap-8">

      {/* ── TOP: Hero + Search + Featured / News sidebar ── */}
      <div className={!isSearching && hasNews ? 'lg:grid lg:grid-cols-3 lg:gap-6' : undefined}>

        <div className={`flex flex-col gap-4${hasNews ? ' lg:col-span-2' : ''}`}>

          {/* Hero */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-2">
              Books are still being banned
            </h1>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
              A growing catalogue of books banned, challenged, or removed across the world.
            </p>
            {/* Prominent stat row */}
            {totalCount > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-3">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {totalCount.toLocaleString()}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> books</span>
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {countries.length}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> countries</span>
                </span>
                <Link href="/stats" className="text-sm text-gray-400 dark:text-gray-500 hover:text-brand dark:hover:text-brand transition-colors">
                  See statistics →
                </Link>
              </div>
            )}
          </div>

          {/* Search */}
          <div>
            <div className="relative">
              <span className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search banned books, authors, or topics…"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') document.getElementById('book-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`w-full pl-11 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 min-h-[52px] ${q ? 'pr-10' : 'pr-4'}`}
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {q && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {loadingFilter
                  ? <span className="text-gray-400">Searching…</span>
                  : total > 0
                    ? <>Showing results for <span className="font-medium">&ldquo;{q}&rdquo;</span> — {total.toLocaleString()} {total === 1 ? 'book' : 'books'} found</>
                    : <>No books found for <span className="font-medium">&ldquo;{q}&rdquo;</span></>
                }
              </p>
            )}
          </div>

          {/* Featured book */}
          {featuredBook && !isSearching && (
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Featured entry</p>
              <Link
                href={`/books/${featuredBook.slug}`}
                className="group block border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <div className="flex gap-3">
                  <div className="shrink-0 w-20">
                    {featuredBook.cover_url ? (
                      <Image
                        src={featuredBook.cover_url}
                        alt={`Cover of ${featuredBook.title}`}
                        width={80} height={120}
                        className="rounded shadow-sm object-cover w-20 h-[120px]"
                        priority sizes="80px"
                      />
                    ) : (
                      <BookCoverPlaceholder title={featuredBook.title} author={authorName(featuredBook)} slug={featuredBook.slug} className="w-20 h-[120px]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div>
                      <h2 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline">{featuredBook.title}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {authorName(featuredBook)}
                        {featuredBook.first_published_year && <span className="text-gray-400 dark:text-gray-500"> · {featuredBook.first_published_year}</span>}
                      </p>
                    </div>
                    {featuredBook.description_book && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{featuredBook.description_book}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {featuredBook.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                      {getReasons(featuredBook.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
                    </div>
                    <p className="text-xs font-medium text-red-500 dark:text-red-400">{banLabel(featuredBook.bans)}</p>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Explore cards — inside left column so both columns balance */}
          {!isSearching && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Explore the catalogue</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Start with a book, a country, or a reason.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { Icon: BookOpen, title: 'Books', text: 'Browse the full database of banned and challenged books.', cta: 'View all books', href: '#book-grid' },
                  { Icon: Globe, title: 'Countries', text: 'See where books have been banned, restricted, or removed.', cta: 'Explore countries', href: '/countries' },
                  { Icon: SearchIcon, title: 'Reasons', text: 'Understand the patterns behind censorship: political, religious, social, and more.', cta: 'Explore reasons', href: '/reasons' },
                ].map(({ Icon, title, text, cta, href }) => (
                  <Link key={title} href={href} className="flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-sm transition-shadow">
                    <Icon className="w-6 h-6 text-brand mb-3" />
                    <span className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{text}</span>
                    <div className="flex-1" />
                    <span className="text-sm text-brand font-medium mt-3">{cta} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* News sidebar — desktop only */}
        {hasNews && !isSearching && (
          <div className="hidden lg:block">
            <NewsPanel items={latestNews} compact />
          </div>
        )}
      </div>

      {/* ── Mobile news ── */}
      {hasNews && !isSearching && (
        <div className="lg:hidden">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Happening now</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">Book bans are not history.</p>
          <NewsPanel items={latestNews} />
        </div>
      )}

      {/* ── Filters ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Filter the database</h2>
          <p className="text-sm text-gray-500">Explore how and why books are restricted — by institution, country, or reason.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <FilterPill active={scope === null} onClick={() => setScope(null)}>All</FilterPill>
          <FilterPill active={scope === 'school'} onClick={() => setScope(scope === 'school' ? null : 'school')}>🏫 Schools</FilterPill>
          <FilterPill active={scope === 'government'} onClick={() => setScope(scope === 'government' ? null : 'government')}>🏛 Governments</FilterPill>
          <FilterPill active={scope === 'public_library'} onClick={() => setScope(scope === 'public_library' ? null : 'public_library')}>📚 Libraries</FilterPill>
          <span className="self-center text-gray-200 dark:text-gray-700 select-none hidden sm:block">|</span>
          <FilterPill active={activeOnly} onClick={() => setActiveOnly(!activeOnly)} color="red">🚫 Currently banned</FilterPill>
          <div className="relative shrink-0">
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white dark:bg-gray-900 cursor-pointer focus:outline-none ${
                country
                  ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <option value="">🌍 All countries</option>
              {countries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.count})</option>)}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          <span className="self-center text-gray-200 dark:text-gray-700 select-none hidden sm:block">|</span>
          {FILTER_REASONS.map(slug => (
            <FilterPill key={slug} active={reason === slug} onClick={() => setReason(reason === slug ? null : slug)}>
              <span aria-hidden>{reasonIcon(slug)}</span>{' '}{reasonLabel(slug)}
            </FilterPill>
          ))}
          {anyFilter && (
            <button
              onClick={clearAll}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          {loadingFilter
            ? <span className="text-gray-400">Searching…</span>
            : anyFilter
              ? <><span className="font-medium text-gray-700 dark:text-gray-200">{total.toLocaleString()}</span> of {totalCount.toLocaleString()} books</>
              : <><span className="font-medium text-gray-700 dark:text-gray-200">{totalCount.toLocaleString()}</span> books</>
          }
        </p>
      </div>

      {/* ── Book grid ── */}
      {!loadingFilter && gridBooks.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No books match your filters.{' '}
          <button onClick={clearAll} className="underline">Clear filters</button>
        </p>
      )}

      {gridBooks.length > 0 && (
        <div id="book-grid">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {gridBooks.map(book => (
              <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
                <div className="mb-2">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={`Cover of ${book.title}`} width={160} height={240}
                      className="rounded shadow-sm object-cover w-full" sizes="160px" />
                  ) : (
                    <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{authorName(book)}</p>
                {book.description_book && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">{book.description_book}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {book.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                  {getReasons(book.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
                </div>
                <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1.5">{banLabel(book.bans)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loadingFilter && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="bg-gray-100 dark:bg-gray-800 rounded aspect-[2/3] w-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Loading more…</p>
      )}

      {!isSearching && !anyFilter && (
        <div className="mt-8 bg-gray-50 dark:bg-gray-900/60 rounded-xl py-16 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
              Access to knowledge should not depend on where you live, what you believe, or who is in power.
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm leading-relaxed">
              This project documents what is being restricted — and why.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
