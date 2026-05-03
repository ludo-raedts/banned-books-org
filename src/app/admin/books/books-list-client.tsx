'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { BookListItem } from './page'

const PAGE_SIZE = 50

export default function BooksListClient({ books }: { books: BookListItem[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(b => b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q))
  }, [books, query])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSearch(val: string) {
    setQuery(val)
    setPage(0)
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search by title or author…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-4"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No books match your search.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Author</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-right">Year</th>
                  <th className="px-3 py-2 w-16 text-right">AI</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((book, i) => (
                  <tr
                    key={book.id}
                    className={`border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/30'}`}
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
                        <div className="w-[27px] h-[40px] rounded bg-gray-200 dark:bg-gray-700" />
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
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 dark:text-gray-400">
                      {book.author ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 dark:text-gray-400 text-right tabular-nums">
                      {book.first_published_year ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {book.ai_drafted && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">AI</span>
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
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
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
