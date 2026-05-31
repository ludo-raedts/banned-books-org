'use client'

import React, { useState, useEffect, useRef, useCallback, useId } from 'react'
import { track } from '@vercel/analytics'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import GenreBadge from './genre-badge'
import ReasonBadge, { reasonLabel, reasonIcon } from './reason-badge'
import type { Ban, Book, CountryOption } from './book-browser'
import { coverAlt } from '@/lib/cover-alt'
import { countryFlag } from '@/lib/country-flag'
import type { BookSort } from '@/lib/book-search'

const FILTER_REASONS = ['lgbtq', 'sexual', 'political', 'religious', 'racial', 'violence', 'language', 'drugs']

const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'bans',    label: 'Most banned'  },
  { value: 'alpha',   label: 'Title (A–Z)'  },
]

type Filters = {
  q: string
  country: string
  reason: string
  scope: string
  activeOnly: boolean
  sort: BookSort
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

function apiParams(opts: Filters & { offset: number; defaultSort: BookSort }) {
  const p = new URLSearchParams()
  if (opts.q)          p.set('q', opts.q)
  if (opts.scope)      p.set('scope', opts.scope)
  if (opts.country)    p.set('country', opts.country)
  if (opts.activeOnly) p.set('activeOnly', '1')
  if (opts.reason)     p.set('reason', opts.reason)
  if (opts.sort !== opts.defaultSort) p.set('sort', opts.sort)
  p.set('offset', String(opts.offset))
  return p.toString()
}

function urlParams(opts: Filters & { defaultSort: BookSort }) {
  const p = new URLSearchParams()
  if (opts.q)          p.set('q', opts.q)
  if (opts.country)    p.set('country', opts.country)
  if (opts.reason)     p.set('reason', opts.reason)
  if (opts.scope)      p.set('scope', opts.scope)
  if (opts.activeOnly) p.set('active', '1')
  if (opts.sort !== opts.defaultSort) p.set('sort', opts.sort)
  return p.toString()
}

function SuggestionGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border-t border-gray-100 first:border-t-0">
      {children}
    </div>
  )
}

function suggestionRowClass(isSelected: boolean): string {
  return `w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
    isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
  }`
}

function FilterPill({
  active, onClick, children, color = 'dark',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: 'dark' | 'red'
}) {
  const activeClass = color === 'red'
    ? 'bg-red-600 text-white border-red-600'
    : 'bg-gray-900 text-white border-gray-900'
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
        active ? activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

export default function SearchClient({
  initialBooks,
  initialTotal,
  totalCount,
  countries,
  initialFilters,
  defaultSort,
}: {
  initialBooks: Book[]
  initialTotal: number
  totalCount: number
  countries: CountryOption[]
  initialFilters: Filters
  defaultSort: BookSort
}) {
  const router = useRouter()

  const [q, setQ] = useState(initialFilters.q)
  const [debouncedQ, setDebouncedQ] = useState(initialFilters.q)
  const [country, setCountry] = useState(initialFilters.country)
  const [reason, setReason] = useState<string | null>(initialFilters.reason || null)
  const [scope, setScope] = useState<string | null>(initialFilters.scope || null)
  const [activeOnly, setActiveOnly] = useState(initialFilters.activeOnly)
  const [sort, setSort] = useState<BookSort>(initialFilters.sort)

  const [displayBooks, setDisplayBooks] = useState<Book[]>(initialBooks)
  const [total, setTotal] = useState(initialTotal)
  const [nextOffset, setNextOffset] = useState(initialBooks.length)
  const [loadingFilter, setLoadingFilter] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const isFirstRender = useRef(true)
  const hasTrackedSearchUsage = useRef(false)

  // ── Autocomplete state ──────────────────────────────────────────────────────
  // Three result types share a flat keyboard-navigation index (authors → countries → books)
  // so ArrowUp/Down moves through every visible row regardless of section.
  type BookSuggestion    = { kind: 'book';    id: number; slug: string; title: string; cover_url: string | null; author: string; banCount: number }
  type AuthorSuggestion  = { kind: 'author';  id: number; slug: string; display_name: string; photo_url: string | null; bookCount: number }
  type CountrySuggestion = { kind: 'country'; code: string; name_en: string; banCount: number }
  type Suggestion = BookSuggestion | AuthorSuggestion | CountrySuggestion

  const [authorSuggestions,  setAuthorSuggestions]  = useState<AuthorSuggestion[]>([])
  const [countrySuggestions, setCountrySuggestions] = useState<CountrySuggestion[]>([])
  const [bookSuggestions,    setBookSuggestions]    = useState<BookSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  // ARIA combobox wiring: the listbox + each option need stable ids so the
  // input can point aria-activedescendant at the keyboard-highlighted row.
  const listboxId = useId()
  const optionId = (i: number) => `${listboxId}-opt-${i}`
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  const flatSuggestions: Suggestion[] = [...authorSuggestions, ...countrySuggestions, ...bookSuggestions]

  // Autocomplete fetch — 200ms debounce
  useEffect(() => {
    if (q.length < 2) {
      setAuthorSuggestions([]); setCountrySuggestions([]); setBookSuggestions([])
      setShowSuggestions(false)
      return
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`)
        const { authors, countries, books } = await res.json()
        const mappedAuthors: AuthorSuggestion[] = (authors ?? []).map((a: {
          id: number; slug: string; display_name: string; photo_url: string | null; bookCount: number
        }) => ({
          kind: 'author',
          id: a.id,
          slug: a.slug,
          display_name: a.display_name,
          photo_url: a.photo_url,
          bookCount: a.bookCount,
        }))
        const mappedCountries: CountrySuggestion[] = (countries ?? []).map((c: {
          code: string; name_en: string; banCount: number
        }) => ({
          kind: 'country',
          code: c.code,
          name_en: c.name_en,
          banCount: c.banCount,
        }))
        const mappedBooks: BookSuggestion[] = (books ?? []).map((b: Book) => ({
          kind: 'book',
          id: b.id,
          slug: b.slug,
          title: b.title,
          cover_url: b.cover_url,
          author: b.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
          banCount: b.bans.length,
        }))
        setAuthorSuggestions(mappedAuthors)
        setCountrySuggestions(mappedCountries)
        setBookSuggestions(mappedBooks)
        setShowSuggestions(mappedAuthors.length + mappedCountries.length + mappedBooks.length > 0)
        setSelectedIndex(-1)
      } catch { /* ignore */ }
    }, 200)
    return () => clearTimeout(id)
  }, [q])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function suggestionHref(s: Suggestion): string {
    if (s.kind === 'book')    return `/books/${s.slug}`
    if (s.kind === 'author')  return `/authors/${s.slug}`
    return `/countries/${s.code.toLowerCase()}`
  }

  function handleSuggestionSelect(s: Suggestion) {
    setShowSuggestions(false)
    router.push(suggestionHref(s))
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || flatSuggestions.length === 0) {
      if (e.key === 'Enter') document.getElementById('book-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSuggestionSelect(flatSuggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    } else if (e.key === 'Enter') {
      setShowSuggestions(false)
      document.getElementById('book-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Debounce query for grid filtering — 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(id)
  }, [q])

  // ── Re-fetch + sync URL when filters change ────────────────────────────────
  useEffect(() => {
    // Skip on first render — server already provided initial data + URL is already correct
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const filters: Filters = { q: debouncedQ, country, reason: reason ?? '', scope: scope ?? '', activeOnly, sort }

    if (debouncedQ.trim() && !hasTrackedSearchUsage.current) {
      hasTrackedSearchUsage.current = true
      track('Search Submitted', { source: 'search-page' })
    }

    // Sync URL (replace, don't push, so back button doesn't get spammed)
    const qs = urlParams({ ...filters, defaultSort })
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })

    // Re-fetch
    let cancelled = false
    setLoadingFilter(true)
    fetch(`/api/books?${apiParams({ ...filters, offset: 0, defaultSort })}`)
      .then(r => r.json())
      .then(({ books, total: t }) => {
        if (cancelled) return
        setDisplayBooks(books ?? [])
        setTotal(t ?? 0)
        setNextOffset((books ?? []).length)
        setLoadingFilter(false)
      })
      .catch(() => { if (!cancelled) setLoadingFilter(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, country, reason, scope, activeOnly, sort])

  const hasFilters = !!(debouncedQ || country || reason || scope || activeOnly)
  const hasMore = displayBooks.length < total

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const filters: Filters = { q: debouncedQ, country, reason: reason ?? '', scope: scope ?? '', activeOnly, sort }
    setLoadingMore(true)
    fetch(`/api/books?${apiParams({ ...filters, offset: nextOffset, defaultSort })}`)
      .then(r => r.json())
      .then(({ books, total: t }) => {
        const incoming: Book[] = books ?? []
        setDisplayBooks(prev => {
          const seen = new Set(prev.map(b => b.id))
          return [...prev, ...incoming.filter(b => !seen.has(b.id))]
        })
        setTotal(t ?? 0)
        setNextOffset(prev => prev + incoming.length)
        setLoadingMore(false)
      })
      .catch(() => setLoadingMore(false))
  }, [loadingMore, hasMore, debouncedQ, country, reason, scope, activeOnly, sort, defaultSort, nextOffset])

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
    setQ(''); setCountry(''); setReason(null); setScope(null); setActiveOnly(false); setSort(defaultSort)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Search input */}
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
            aria-controls={listboxId}
            aria-activedescendant={selectedIndex >= 0 ? optionId(selectedIndex) : undefined}
            aria-label="Search books"
            placeholder={`Search ${totalCount > 0 ? totalCount.toLocaleString('en') + ' ' : ''}banned books by title or author…`}
            value={q}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={e => { setQ(e.target.value); setShowSuggestions(false) }}
            onFocus={() => { if (flatSuggestions.length > 0) setShowSuggestions(true) }}
            onKeyDown={handleSearchKeyDown}
            className={`w-full pl-12 border-2 border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 text-lg font-medium focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all min-h-[68px] shadow-sm hover:shadow-md focus:shadow-md ${q ? 'pr-11' : 'pr-4'}`}
          />
          {q && (
            <button
              onClick={() => {
                setQ('')
                setAuthorSuggestions([]); setCountrySuggestions([]); setBookSuggestions([])
                setShowSuggestions(false)
              }}
              aria-label="Clear search"
              className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {showSuggestions && flatSuggestions.length > 0 && (
            <div role="listbox" id={listboxId} aria-label="Search suggestions" className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {authorSuggestions.length > 0 && (
                <SuggestionGroupHeader>Authors</SuggestionGroupHeader>
              )}
              {authorSuggestions.map((s, i) => {
                const idx = i
                return (
                  <button
                    key={`author-${s.id}`}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                    role="option"
                    id={optionId(idx)}
                    aria-selected={idx === selectedIndex}
                    className={suggestionRowClass(idx === selectedIndex)}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {s.photo_url ? (
                        <Image src={s.photo_url} alt="" width={32} height={32} className="w-full h-full object-cover" sizes="32px" />
                      ) : (
                        <span aria-hidden className="text-sm text-gray-400">👤</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.display_name}</p>
                      <p className="text-xs text-gray-500 truncate">Author</p>
                    </div>
                    {s.bookCount > 0 && (
                      <span className="shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                        {s.bookCount} {s.bookCount === 1 ? 'book' : 'books'}
                      </span>
                    )}
                  </button>
                )
              })}
              {countrySuggestions.length > 0 && (
                <SuggestionGroupHeader>Countries</SuggestionGroupHeader>
              )}
              {countrySuggestions.map((s, i) => {
                const idx = authorSuggestions.length + i
                return (
                  <button
                    key={`country-${s.code}`}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                    role="option"
                    id={optionId(idx)}
                    aria-selected={idx === selectedIndex}
                    className={suggestionRowClass(idx === selectedIndex)}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg leading-none" aria-hidden>
                      {countryFlag(s.code)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name_en}</p>
                      <p className="text-xs text-gray-500 truncate">Country</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-red-500 tabular-nums">
                      {s.banCount} {s.banCount === 1 ? 'book' : 'books'}
                    </span>
                  </button>
                )
              })}
              {bookSuggestions.length > 0 && (
                <SuggestionGroupHeader>Books</SuggestionGroupHeader>
              )}
              {bookSuggestions.map((s, i) => {
                const idx = authorSuggestions.length + countrySuggestions.length + i
                return (
                  <button
                    key={`book-${s.id}`}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                    role="option"
                    id={optionId(idx)}
                    aria-selected={idx === selectedIndex}
                    className={suggestionRowClass(idx === selectedIndex)}
                  >
                    <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-gray-100">
                      {s.cover_url ? (
                        <Image src={s.cover_url} alt="" width={32} height={44} className="w-full h-full object-cover" sizes="32px" />
                      ) : (
                        <BookCoverPlaceholder title={s.title} slug={s.slug} className="h-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                      {s.author && <p className="text-xs text-gray-500 truncate">{s.author}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-red-500 tabular-nums">
                      {s.banCount} {s.banCount === 1 ? 'ban' : 'bans'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as BookSort)}
              aria-label="Sort books"
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white cursor-pointer focus:outline-none ${
                sort !== defaultSort
                  ? 'border-gray-900 text-gray-900'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>↕ {o.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          <span className="self-center text-gray-200 select-none hidden sm:block">|</span>
          <FilterPill active={scope === null} onClick={() => setScope(null)}>All</FilterPill>
          <FilterPill active={scope === 'school'} onClick={() => setScope(scope === 'school' ? null : 'school')}>🏫 Schools</FilterPill>
          <FilterPill active={scope === 'government'} onClick={() => setScope(scope === 'government' ? null : 'government')}>🏛 Governments</FilterPill>
          <FilterPill active={scope === 'public_library'} onClick={() => setScope(scope === 'public_library' ? null : 'public_library')}>📚 Libraries</FilterPill>
          <span className="self-center text-gray-200 select-none hidden sm:block">|</span>
          <FilterPill active={activeOnly} onClick={() => setActiveOnly(!activeOnly)} color="red">🚫 Currently banned</FilterPill>
          <div className="relative shrink-0">
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              aria-label="Filter by country"
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white cursor-pointer focus:outline-none ${
                country
                  ? 'border-gray-900 text-gray-900'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              <option value="">🌍 All countries</option>
              {countries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.count})</option>)}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          <span className="self-center text-gray-200 select-none hidden sm:block">|</span>
          {FILTER_REASONS.map(slug => (
            <FilterPill key={slug} active={reason === slug} onClick={() => setReason(reason === slug ? null : slug)}>
              <span aria-hidden>{reasonIcon(slug)}</span>{' '}{reasonLabel(slug)}
            </FilterPill>
          ))}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-3">
          {loadingFilter
            ? <span className="text-gray-400">Searching…</span>
            : hasFilters
              ? <><span className="font-medium text-gray-700">{total.toLocaleString('en')}</span> of {totalCount.toLocaleString('en')} books match</>
              : <><span className="font-medium text-gray-700">{totalCount.toLocaleString('en')}</span> books</>
          }
        </p>
      </div>

      {/* Empty state */}
      {!loadingFilter && displayBooks.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 py-10 px-6 text-center">
          <p className="text-gray-700 font-medium mb-1">No books match your search.</p>
          <p className="text-sm text-gray-500 mb-4">
            Try a different keyword or remove some filters.
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="text-sm text-brand hover:underline font-medium">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Book grid */}
      {displayBooks.length > 0 && (
        <div id="book-grid">
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
            {displayBooks.map(book => {
              const reasons = getReasons(book.bans)
              return (
                <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-row gap-3 items-start sm:flex-col sm:gap-0">
                  <div className="shrink-0 w-[60px] h-[90px] sm:w-full sm:h-auto sm:aspect-[2/3] sm:mb-2 relative overflow-hidden rounded shadow-sm">
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={coverAlt(book.title, authorName(book), book.first_published_year)} fill
                        className="object-cover" sizes="(max-width: 640px) 60px, (max-width: 768px) 33vw, 25vw" />
                    ) : (
                      <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} className="absolute inset-0 w-full h-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{authorName(book)}</p>
                    {book.description_book && (
                      <p className="max-sm:hidden text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{book.description_book}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {book.genres.slice(0, 2).map(slug => <GenreBadge key={slug} slug={slug} />)}
                      {reasons.slice(0, 2).map(slug => <ReasonBadge key={slug} slug={slug} />)}
                    </div>
                    <p className="text-xs font-medium text-red-500 mt-1">{banLabel(book.bans)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {loadingFilter && displayBooks.length === 0 && (
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-row gap-3 sm:flex-col sm:gap-2 animate-pulse items-start">
              <div className="shrink-0 w-[60px] h-[90px] sm:w-full sm:h-auto sm:aspect-[2/3] bg-gray-100 rounded" />
              <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <p className="text-sm text-gray-400 text-center py-4">Loading more…</p>
      )}
    </div>
  )
}
