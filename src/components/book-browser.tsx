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
  active,
  onClick,
  children,
  color = 'dark',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: 'dark' | 'red'
}) {
  const activeClass = color === 'red'
    ? 'bg-red-600 text-white border-red-600'
    : 'bg-gray-900 text-white border-gray-900'
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
        active ? activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

const PAGE_SIZE = 48

export default function BookBrowser({ books }: { books: Book[] }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<string | null>(null)
  const [country, setCountry] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Derive sorted country list from ban data
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
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [books])

  const filtered = useMemo(() => {
    const lq = q.toLowerCase().trim()
    return books.filter(book => {
      if (lq) {
        const inTitle  = book.title.toLowerCase().includes(lq)
        const inAuthor = book.book_authors.some(ba => ba.authors?.display_name.toLowerCase().includes(lq))
        if (!inTitle && !inAuthor) return false
      }
      if (scope   && !book.bans.some(b => b.scopes?.slug === scope))            return false
      if (country && !book.bans.some(b => b.country_code === country))           return false
      if (activeOnly && !book.bans.some(b => b.status === 'active'))             return false
      if (reason) {
        const slugs = getReasons(book.bans)
        if (!slugs.includes(reason)) return false
      }
      return true
    })
  }, [books, q, scope, country, activeOnly, reason])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [q, scope, country, activeOnly, reason])

  // Daily-rotating featured book (stable within one day, rotates overnight)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  const featuredIndex = filtered.length > 0 ? dayOfYear % filtered.length : 0
  const featured = filtered[featuredIndex]
  const rest = filtered.filter((_, i) => i !== featuredIndex)

  const visible = rest.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < rest.length

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMore = useCallback(() => {
    if (hasMore) setPage(p => p + 1)
  }, [hasMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const anyFilter = !!(q || scope || country || activeOnly || reason)

  function clearAll() {
    setQ(''); setScope(null); setCountry(''); setActiveOnly(false); setReason(null)
  }

  return (
    <>
      {/* ── Search ── */}
      <div className="relative mb-4">
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
          className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Scope */}
        <FilterPill active={scope === null} onClick={() => setScope(null)}>All</FilterPill>
        <FilterPill active={scope === 'school'} onClick={() => setScope(scope === 'school' ? null : 'school')}>🏫 Schools</FilterPill>
        <FilterPill active={scope === 'government'} onClick={() => setScope(scope === 'government' ? null : 'government')}>🏛 Governments</FilterPill>
        <FilterPill active={scope === 'public_library'} onClick={() => setScope(scope === 'public_library' ? null : 'public_library')}>📚 Libraries</FilterPill>

        <span className="self-center text-gray-200 select-none">|</span>

        {/* Active bans only */}
        <FilterPill active={activeOnly} onClick={() => setActiveOnly(!activeOnly)} color="red">
          🚫 Currently banned
        </FilterPill>

        {/* Country */}
        <div className="relative">
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white cursor-pointer focus:outline-none ${
              country ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            <option value="">🌍 All countries</option>
            {countries.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.count})</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
        </div>

        <span className="self-center text-gray-200 select-none">|</span>

        {/* Reasons */}
        {FILTER_REASONS.map(slug => (
          <FilterPill
            key={slug}
            active={reason === slug}
            onClick={() => setReason(reason === slug ? null : slug)}
          >
            <span aria-hidden>{reasonIcon(slug)}</span>
            {' '}{reasonLabel(slug)}
          </FilterPill>
        ))}

        {anyFilter && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Result count ── */}
      <p className="text-sm text-gray-400 mb-8">
        {anyFilter
          ? <><span className="font-medium text-gray-700">{filtered.length.toLocaleString()}</span> of {books.length.toLocaleString()} books</>
          : <><span className="font-medium text-gray-700">{books.length.toLocaleString()}</span> books</>
        }
      </p>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm">No books match your filters. <button onClick={clearAll} className="underline">Clear filters</button></p>
      )}

      {/* ── Featured ── */}
      {featured && (
        <Link href={`/books/${featured.slug}`} className="block mb-10 group">
          <div className="flex gap-6 border rounded-xl p-5 hover:border-gray-400 transition-colors bg-white">
            <div className="shrink-0">
              {featured.cover_url ? (
                <Image src={featured.cover_url} alt={`Cover of ${featured.title}`} width={110} height={165}
                  className="rounded shadow-sm object-cover" priority sizes="110px" />
              ) : (
                <div className="w-[110px] h-[165px] bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  No cover
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2 min-w-0">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Featured</p>
                <h2 className="text-xl font-bold group-hover:underline leading-snug">{featured.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {authorName(featured)}
                  {featured.first_published_year && (
                    <span className="text-gray-400"> · {featured.first_published_year}</span>
                  )}
                </p>
              </div>
              {featured.description && (
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{featured.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {featured.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                {getReasons(featured.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
              </div>
              <p className="text-sm font-medium text-red-600">{banLabel(featured.bans)}</p>
            </div>
          </div>
        </Link>
      )}

      {/* ── Grid ── */}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {visible.map(book => (
            <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
              <div className="mb-2">
                {book.cover_url ? (
                  <Image src={book.cover_url} alt={`Cover of ${book.title}`} width={160} height={240}
                    className="rounded shadow-sm object-cover w-full"
                    sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 23vw" />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-3">
                    {book.title}
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{authorName(book)}</p>
              {book.description && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{book.description}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {book.genres.map(slug => <GenreBadge key={slug} slug={slug} />)}
                {getReasons(book.bans).map(slug => <ReasonBadge key={slug} slug={slug} />)}
              </div>
              <p className="text-xs font-medium text-red-600 mt-1.5">{banLabel(book.bans)}</p>
            </Link>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
    </>
  )
}
