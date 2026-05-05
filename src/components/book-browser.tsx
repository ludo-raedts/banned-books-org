'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  trendingSlot,
}: {
  initialBooks: Book[]
  totalCount?: number
  latestNews?: NewsPreview[]
  featuredBook?: Book | null
  countries?: CountryOption[]
  trendingSlot?: React.ReactNode
}) {
  const router = useRouter()

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

  // ── Autocomplete state ──────────────────────────────────────────────────────
  type Suggestion = { id: number; slug: string; title: string; cover_url: string | null; author: string; banCount: number }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  // Autocomplete fetch — 200ms debounce
  useEffect(() => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/books?q=${encodeURIComponent(q)}&limit=5`)
        const { books } = await res.json()
        const mapped: Suggestion[] = (books ?? []).map((b: Book) => ({
          id: b.id,
          slug: b.slug,
          title: b.title,
          cover_url: b.cover_url,
          author: b.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
          banCount: b.bans.length,
        }))
        setSuggestions(mapped)
        setShowSuggestions(mapped.length > 0)
        setSelectedIndex(-1)
      } catch { /* ignore */ }
    }, 200)
    return () => clearTimeout(id)
  }, [q])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSuggestionSelect(slug: string) {
    setShowSuggestions(false)
    setQ('')
    router.push(`/books/${slug}`)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') document.getElementById('book-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSuggestionSelect(suggestions[selectedIndex].slug)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    } else if (e.key === 'Enter') {
      setShowSuggestions(false)
      document.getElementById('book-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Debounce search input (for grid filtering — 300ms)
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

          {/* Search */}
          <div ref={searchWrapperRef}>
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
              <input
                type="text"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-autocomplete="list"
                placeholder={`Search ${totalCount > 0 ? totalCount.toLocaleString() + ' ' : ''}banned books…`}
                value={q}
                onChange={e => { setQ(e.target.value); setShowSuggestions(false) }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                onKeyDown={handleSearchKeyDown}
                className={`w-full pl-12 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg font-medium focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors min-h-[56px] shadow-sm ${q ? 'pr-11' : 'pr-4'}`}
              />
              {q && (
                <button
                  onClick={() => { setQ(''); setSuggestions([]); setShowSuggestions(false) }}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s.slug) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        i === selectedIndex
                          ? 'bg-gray-100 dark:bg-gray-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      } ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                    >
                      <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {s.cover_url ? (
                          <Image src={s.cover_url} alt="" width={32} height={44} className="w-full h-full object-cover" sizes="32px" />
                        ) : (
                          <BookCoverPlaceholder title={s.title} slug={s.slug} className="h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{s.title}</p>
                        {s.author && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.author}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-red-500 dark:text-red-400 tabular-nums">
                        {s.banCount} {s.banCount === 1 ? 'ban' : 'bans'}
                      </span>
                    </button>
                  ))}
                </div>
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
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Book of the day</p>
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

        {/* News + Trending sidebar — desktop only */}
        {(hasNews || trendingSlot) && !isSearching && (
          <div className="hidden lg:block">
            <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-4 h-full flex flex-col gap-5">
              {hasNews && (
                <div className="flex flex-col">
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Happening now</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Book bans are not history.</p>
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                    {latestNews.map(item => (
                      <Link key={item.id} href="/news" className="py-2.5 group/item first:pt-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-3 group-hover/item:text-gray-900 dark:group-hover/item:text-gray-100 transition-colors">
                          {item.summary}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {item.source_name}
                          {item.published_at && <span> · {formatNewsDate(item.published_at)}</span>}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <Link href="/news" className="mt-3 text-xs text-right text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors block">
                    All news →
                  </Link>
                </div>
              )}
              {trendingSlot && (
                <div className={hasNews ? 'border-t border-gray-200 dark:border-gray-700 pt-4' : ''}>
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trending this week</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Most visited in the last 7 days.</p>
                  </div>
                  {trendingSlot}
                </div>
              )}
            </div>
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
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
            {gridBooks.map(book => {
              const reasons = getReasons(book.bans)
              return (
                <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-row gap-3 items-start sm:flex-col sm:gap-0">
                  {/* Cover */}
                  <div className="shrink-0 w-[60px] h-[90px] sm:w-full sm:h-auto sm:aspect-[2/3] sm:mb-2 relative overflow-hidden rounded shadow-sm">
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={`Cover of ${book.title}`} fill
                        className="object-cover" sizes="(max-width: 640px) 60px, (max-width: 768px) 33vw, 25vw" />
                    ) : (
                      <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} className="absolute inset-0 w-full h-full" />
                    )}
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{authorName(book)}</p>
                    {book.description_book && (
                      <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">{book.description_book}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {book.genres.slice(0, 2).map(slug => <GenreBadge key={slug} slug={slug} />)}
                      {reasons.slice(0, 2).map(slug => <ReasonBadge key={slug} slug={slug} />)}
                    </div>
                    <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1">{banLabel(book.bans)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {loadingFilter && (
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-row gap-3 sm:flex-col sm:gap-2 animate-pulse items-start">
              <div className="shrink-0 w-[60px] h-[90px] sm:w-full sm:h-auto sm:aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
              </div>
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
