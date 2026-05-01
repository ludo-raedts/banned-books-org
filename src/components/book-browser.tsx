'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import GenreBadge from './genre-badge'
import ReasonBadge, { reasonLabel, reasonIcon } from './reason-badge'

const FILTER_REASONS = ['lgbtq', 'sexual', 'political', 'religious', 'racial', 'violence', 'language', 'drugs']

export type Ban = {
  id: number
  status: string
  country_code: string
  countries: { name_en: string } | null
  scopes: { slug: string; label_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

export type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
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

const PAGE_SIZE = 48

export default function BookBrowser({ books, latestNews = [] }: { books: Book[]; latestNews?: NewsPreview[] }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<string | null>(null)
  const [country, setCountry] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const countries = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>()
    for (const book of books) {
      const seen = new Set<string>()
      for (const ban of book.bans) {
        if (!ban.country_code || seen.has(ban.country_code)) continue
        seen.add(ban.country_code)
        const name = ban.countries?.name_en ?? ban.country_code
        const ex = map.get(ban.country_code)
        if (ex) ex.count++
        else map.set(ban.country_code, { code: ban.country_code, name, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [books])

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim()
    return books.filter(book => {
      if (lq) {
        const inTitle  = book.title.toLowerCase().includes(lq)
        const inAuthor = book.book_authors.some(ba => ba.authors?.display_name.toLowerCase().includes(lq))
        if (!inTitle && !inAuthor) return false
      }
      if (scope    && !book.bans.some(b => b.scopes?.slug === scope))   return false
      if (country  && !book.bans.some(b => b.country_code === country)) return false
      if (activeOnly && !book.bans.some(b => b.status === 'active'))    return false
      if (reason && !getReasons(book.bans).includes(reason))            return false
      return true
    })
  }, [books, q, scope, country, activeOnly, reason])

  useEffect(() => { setPage(1) }, [q, scope, country, activeOnly, reason])

  const featuredPool = useMemo(() =>
    books.filter(b => b.cover_url && b.description)
      .sort((a, b) => b.bans.length - a.bans.length)
      .slice(0, 50),
    [books]
  )

  const [featuredIdx, setFeaturedIdx] = useState<number>(-1)
  useEffect(() => {
    if (featuredPool.length > 0) setFeaturedIdx(Math.floor(Math.random() * featuredPool.length))
  }, [featuredPool.length])

  const featured = featuredIdx >= 0 ? featuredPool[featuredIdx] : null
  const rest = featured ? filtered.filter(b => b !== featured) : filtered
  const visible = rest.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < rest.length

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMore = useCallback(() => { if (hasMore) setPage(p => p + 1) }, [hasMore])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const anyFilter = !!(q || scope || country || activeOnly || reason)
  function clearAll() { setQ(''); setScope(null); setCountry(''); setActiveOnly(false); setReason(null) }

  const hasNews = latestNews.length > 0

  return (
    <div className="flex flex-col gap-4">

      {/* ── Two-column section: [search + compact featured] | [news] ── */}
      {/* CSS grid default is items-stretch — both columns match height automatically */}
      <div className={hasNews ? 'lg:grid lg:grid-cols-3 lg:gap-6' : undefined}>

        {/* LEFT: search bar + compact featured card */}
        <div className={`flex flex-col gap-3${hasNews ? ' lg:col-span-2' : ''}`}>

          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search by title or author…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Compact featured card — visible on all screen sizes */}
          {featured && (
            <Link
              href={`/books/${featured.slug}`}
              className="group block border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <div className="flex gap-3">
                {/* Cover ~80px wide */}
                <div className="shrink-0 w-20">
                  {featured.cover_url ? (
                    <Image
                      src={featured.cover_url}
                      alt={`Cover of ${featured.title}`}
                      width={80}
                      height={120}
                      className="rounded shadow-sm object-cover w-20 h-[120px]"
                      priority
                      sizes="80px"
                    />
                  ) : (
                    <div className="w-20 h-[120px] bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center p-2">
                      No cover
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div>
                    <h2 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline">
                      {featured.title}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {authorName(featured)}
                      {featured.first_published_year && (
                        <span className="text-gray-400 dark:text-gray-500"> · {featured.first_published_year}</span>
                      )}
                    </p>
                  </div>
                  {featured.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
                      {featured.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {featured.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                    {getReasons(featured.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
                  </div>
                  <p className="text-xs font-medium text-red-500 dark:text-red-400">{banLabel(featured.bans)}</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* RIGHT: news panel — hidden on mobile, stretches to match left column height */}
        {hasNews && (
          <div className="hidden lg:block">
            <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Latest news
                </span>
              </div>
              <div className="flex flex-col flex-1 divide-y divide-gray-100 dark:divide-gray-800">
                {latestNews.map(item => (
                  <Link
                    key={item.id}
                    href="/news"
                    className="py-2.5 group/item first:pt-0"
                  >
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
              <Link
                href="/news"
                className="mt-3 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-right block"
              >
                All news →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Filters + count — full width ── */}
      <div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 sm:flex-wrap sm:overflow-x-visible sm:mx-0 sm:px-0 sm:pb-0">
          <FilterPill active={scope === null} onClick={() => setScope(null)}>All</FilterPill>
          <FilterPill active={scope === 'school'} onClick={() => setScope(scope === 'school' ? null : 'school')}>🏫 Schools</FilterPill>
          <FilterPill active={scope === 'government'} onClick={() => setScope(scope === 'government' ? null : 'government')}>🏛 Governments</FilterPill>
          <FilterPill active={scope === 'public_library'} onClick={() => setScope(scope === 'public_library' ? null : 'public_library')}>📚 Libraries</FilterPill>
          <span className="self-center text-gray-200 dark:text-gray-700 select-none hidden sm:block">|</span>
          <FilterPill active={activeOnly} onClick={() => setActiveOnly(!activeOnly)} color="red">
            🚫 Currently banned
          </FilterPill>
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
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name} ({c.count})</option>
              ))}
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
          {anyFilter
            ? <><span className="font-medium text-gray-700 dark:text-gray-200">{filtered.length.toLocaleString()}</span> of {books.length.toLocaleString()} books</>
            : <><span className="font-medium text-gray-700 dark:text-gray-200">{books.length.toLocaleString()}</span> books</>
          }
        </p>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No books match your filters.{' '}
          <button onClick={clearAll} className="underline">Clear filters</button>
        </p>
      )}

      {/* ── Book grid — full width ── */}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {visible.map(book => (
            <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
              <div className="mb-2">
                {book.cover_url ? (
                  <Image src={book.cover_url} alt={`Cover of ${book.title}`} width={160} height={240}
                    className="rounded shadow-sm object-cover w-full" sizes="160px" />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center p-3">
                    {book.title}
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{authorName(book)}</p>
              {book.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">{book.description}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {book.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                {getReasons(book.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
              </div>
              <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1.5">{banLabel(book.bans)}</p>
            </Link>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
    </div>
  )
}
