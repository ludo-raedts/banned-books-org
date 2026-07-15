'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, X, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'

export type BookHealth = { total: number; book: string[]; authors: { name: string; slug: string; gaps: string[] }[] }
export type UpcomingItem = { ymd: string; label: string; book: { id: number; slug: string; coverUrl: string | null; title: string; author: string; why: string; birthday?: { name: string; bornYear: number | null } | null; health?: BookHealth | null } | null }
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
                  <a
                    href={`/admin/books/${book.slug}`}
                    title="Open in book admin — edit cover, description, etc."
                    className="shrink-0 block w-10 h-14 rounded overflow-hidden bg-gray-100 border border-gray-200 hover:border-brand"
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-[9px] text-gray-400 text-center leading-tight px-0.5">no cover</span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {book.birthday && <span title={`${book.birthday.name} was born on this day${book.birthday.bornYear ? ` in ${book.birthday.bornYear}` : ''}`}>🎂 </span>}
                      <a href={`/admin/books/${book.slug}`} className="hover:text-brand hover:underline">{book.title}</a> <span className="font-normal text-gray-500">— {book.author}</span>
                    </p>
                    {book.birthday && <p className="text-[11px] text-amber-700">🎂 {book.birthday.name}&apos;s birthday{book.birthday.bornYear ? ` (b. ${book.birthday.bornYear})` : ''}</p>}
                    <p className="text-xs text-gray-500">{book.why}</p>
                    <Health slug={book.slug} health={book.health ?? null} />
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

      {/* ── Data-health note ───────────────────────────────────── */}
      <p className="text-[11px] text-gray-400 -mt-2">
        Data health is computed live from the same checks the weekly pre-flight runs — a <span className="text-emerald-700 font-medium">Data ready</span> row has no gaps left for the pre-flight to fix.
      </p>

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

/** Live data-health badge for one upcoming pick. Green when the book + its
 *  author(s) have zero gaps (i.e. nothing left for the weekly pre-flight);
 *  otherwise amber, listing the specific gaps so they can be fixed in place. */
function Health({ slug, health }: { slug: string; health: BookHealth | null }) {
  if (!health) return null

  if (health.total === 0) {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Data ready
      </p>
    )
  }

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <p className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
        <AlertTriangle className="w-3.5 h-3.5" /> {health.total} data {health.total === 1 ? 'gap' : 'gaps'}
      </p>
      <ul className="text-[11px] text-gray-500 leading-snug list-none pl-0">
        {health.book.length > 0 && (
          <li>
            <a href={`/admin/books/${slug}`} className="hover:text-brand hover:underline">Book</a>: {health.book.join(' · ')}
          </li>
        )}
        {health.authors
          .filter(a => a.gaps.length > 0)
          .map(a => (
            <li key={a.slug}>
              <a href={`/admin/authors/${a.slug}`} className="hover:text-brand hover:underline">{a.name}</a>: {a.gaps.join(' · ')}
            </li>
          ))}
      </ul>
    </div>
  )
}
