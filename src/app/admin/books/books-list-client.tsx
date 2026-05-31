'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { BookListItem } from './page'

const PAGE_SIZE = 50

type ClassificationFilter =
  | 'all'
  | 'unclassified'
  | 'classified'
  | 'context'
  | 'extended'
  | 'extended_no_essay'

export default function BooksListClient({ books }: { books: BookListItem[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [classFilter, setClassFilter] = useState<ClassificationFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return books.filter(b => {
      if (q && !b.title.toLowerCase().includes(q) && !b.author?.toLowerCase().includes(q)) return false
      switch (classFilter) {
        case 'all':              return true
        case 'unclassified':     return b.warning_level === 'none' && !b.has_rationale
        case 'classified':       return b.warning_level !== 'none' || b.has_rationale
        case 'context':          return b.warning_level === 'context'
        case 'extended':         return b.warning_level === 'extended'
        // extended_no_essay is a server-side-known property; in the list we
        // approximate "extended without essay" via the dedicated /admin/books
        // detail view. Until the list query joins extended_context, treat this
        // as a synonym for 'extended'.
        case 'extended_no_essay': return b.warning_level === 'extended'
      }
    })
  }, [books, query, classFilter])

  const counts = useMemo(() => {
    let unclassified = 0, context = 0, extended = 0
    for (const b of books) {
      if (b.warning_level === 'context') context++
      else if (b.warning_level === 'extended') extended++
      if (b.warning_level === 'none' && !b.has_rationale) unclassified++
    }
    return { unclassified, context, extended }
  }, [books])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSearch(val: string) {
    setQuery(val)
    setPage(0)
  }

  function handleFilter(val: ClassificationFilter) {
    setClassFilter(val)
    setPage(0)
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search by title or author…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-3"
      />

      <div className="flex flex-wrap gap-1.5 mb-4 text-xs">
        {(
          [
            ['all',          `All (${books.length})`],
            ['unclassified', `Unclassified (${counts.unclassified})`],
            ['classified',   `Classified (${books.length - counts.unclassified})`],
            ['context',      `Context (${counts.context})`],
            ['extended',     `Extended (${counts.extended})`],
          ] as Array<[ClassificationFilter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleFilter(key)}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              classFilter === key
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-gray-400 self-center">
          Classification is editorial — not part of data quality.
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No books match your search.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {filtered.length.toLocaleString('en')} result{filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Author</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-right">Year</th>
                  <th className="px-3 py-2 hidden md:table-cell w-24">Class.</th>
                  <th className="px-3 py-2 w-16 text-right">AI</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((book, i) => (
                  <tr
                    key={book.id}
                    className={`border-b last:border-0 border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    onClick={() => window.location.href = `/admin/books/${book.slug}`}
                  >
                    <td className="px-3 py-2">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt=""
                          width={27}
                          height={40}
                          className="rounded object-cover w-[27px] h-[40px]"
                          unoptimized
                        />
                      ) : (
                        <div className="w-[27px] h-[40px] rounded bg-gray-200" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium leading-snug">
                      <Link
                        href={`/admin/books/${book.slug}`}
                        className="hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {book.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500">
                      {book.author ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-right tabular-nums">
                      {book.first_published_year ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {book.warning_level === 'extended' ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">extended</span>
                      ) : book.warning_level === 'context' ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">context</span>
                      ) : book.has_rationale ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">none</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {book.ai_drafted && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">AI</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
