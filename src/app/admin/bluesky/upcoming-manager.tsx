'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, X, RotateCcw } from 'lucide-react'

export type UpcomingItem = { ymd: string; label: string; book: { id: number; title: string; author: string; why: string } | null }
export type ExcludedItem = { id: number; title: string; author: string }

export default function UpcomingManager({ upcoming, excluded }: { upcoming: UpcomingItem[]; excluded: ExcludedItem[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)

  async function mutate(method: 'POST' | 'DELETE', book_id: number) {
    setBusy(book_id)
    try {
      const res = await fetch('/api/admin/bluesky-exclude', {
        method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ book_id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(`Failed: ${j.error ?? res.status}`)
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {/* ── Upcoming queue ─────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-gray-400 shrink-0" />
          <h2 className="font-semibold text-gray-900">Upcoming</h2>
          <span className="text-xs text-gray-400">next {upcoming.length} days</span>
        </div>
        <ul className="flex flex-col divide-y divide-gray-100">
          {upcoming.map(({ ymd, label, book }) => (
            <li key={ymd} className="py-2.5 flex gap-3 items-start">
              <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5 tabular-nums">{label}</span>
              {book ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{book.title} <span className="font-normal text-gray-500">— {book.author}</span></p>
                    <p className="text-xs text-gray-500">{book.why}</p>
                  </div>
                  <button
                    onClick={() => mutate('POST', book.id)}
                    disabled={busy === book.id}
                    title="Skip this book — it won't be posted; this day rerolls to another title"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-md px-2 py-1 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> Skip
                  </button>
                </>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-400">Each date is pinned (frozen) once chosen, so editing book data no longer reshuffles the queue. Skipping a book only re-rolls its own day; the rest stay put.</p>
      </div>

      {/* ── Excluded books ─────────────────────────────────────── */}
      {excluded.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Excluded from rotation</h2>
            <span className="text-xs text-gray-400">{excluded.length}</span>
          </div>
          <ul className="flex flex-col divide-y divide-gray-100">
            {excluded.map(b => (
              <li key={b.id} className="py-2.5 flex gap-3 items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700">{b.title} <span className="text-gray-400">— {b.author}</span></p>
                </div>
                <button
                  onClick={() => mutate('DELETE', b.id)}
                  disabled={busy === b.id}
                  title="Restore this book to the rotation"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-700 border border-gray-200 hover:border-emerald-300 rounded-md px-2 py-1 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
