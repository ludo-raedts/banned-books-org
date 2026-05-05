'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AuthorListItem } from './page'

const PAGE_SIZE = 50

function Check({ value }: { value: boolean }) {
  return value ? (
    <span className="text-green-600 dark:text-green-400">✓</span>
  ) : (
    <span className="text-red-500 dark:text-red-400">✗</span>
  )
}

export default function AuthorsListClient({ authors }: { authors: AuthorListItem[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return authors
    return authors.filter(a => a.display_name.toLowerCase().includes(q))
  }, [authors, query])

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
        placeholder="Search by name…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-4"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No authors match your search.</p>
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
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-center">Bio?</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-center">Photo?</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-20 text-right">Birth</th>
                  <th className="px-3 py-2 w-16 text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((author, i) => (
                  <tr
                    key={author.id}
                    className={`border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/30'}`}
                    onClick={() => window.location.href = `/admin/authors/${author.slug}`}
                  >
                    <td className="px-3 py-2 font-medium leading-snug">
                      <Link
                        href={`/admin/authors/${author.slug}`}
                        className="hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {author.display_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-center">
                      <Check value={!!author.bio} />
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-center">
                      <Check value={!!author.photo_url} />
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 dark:text-gray-400 text-right tabular-nums">
                      {author.birth_year ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/authors/${author.slug}`}
                        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Edit →
                      </Link>
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
