'use client'

import { useState } from 'react'
import YearBookRow from '@/components/year-book-row'
import type { YearBook } from '@/lib/year-books'

// Appends the rest of a /banned-books/[year] list, YEAR_LIST_CAP rows per
// click, from /api/banned-books/[year] — keeps the ISR page itself small.
export default function YearMoreBooks({ year, shown, total }: { year: number; shown: number; total: number }) {
  const [extra, setExtra] = useState<YearBook[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const count = shown + extra.length
  const remaining = total - count

  async function loadMore() {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/banned-books/${year}?offset=${count}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { books: YearBook[] }
      setExtra(prev => [...prev, ...data.books])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {extra.map((book, i) => (
        <YearBookRow key={book.id} book={book} rank={shown + i + 1} />
      ))}
      {remaining > 0 && (
        <div className="pt-4 text-sm text-gray-500">
          <p className="mb-3">
            Showing {count.toLocaleString('en')} of {total.toLocaleString('en')} books, most-banned first.
          </p>
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:border-gray-900 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : `Show ${Math.min(remaining, 250).toLocaleString('en')} more`}
          </button>
          {failed && <p className="mt-2 text-red-600">Could not load more books — please try again.</p>}
        </div>
      )}
    </>
  )
}
