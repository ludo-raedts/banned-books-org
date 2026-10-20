'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/link'
import { adminFetch } from '../../admin-fetch'
import { useAdminUi } from '../../admin-ui'
import { PageHeader } from '../../kit'

type Item = {
  author_id: number
  slug: string
  name: string
  birth_year: number | null
  death_year: number | null
  photo_url: string
  verdict: string
  reasoning: string
}
type Counts = { pending: number; stale: number; ok: number; wrong: number; replaced: number }
type Candidate = { url: string; source: string; label: string }

const VERDICT_LABEL: Record<string, string> = {
  era_mismatch: 'Era mismatch',
  unsure: 'Unsure',
  not_a_person: 'Art / statue',
  unreadable: 'Does not load',
}
const VERDICT_CLS: Record<string, string> = {
  era_mismatch: 'bg-amber-50 text-amber-800 border-amber-200',
  unsure: 'bg-gray-50 text-gray-700 border-gray-200',
  not_a_person: 'bg-purple-50 text-purple-800 border-purple-200',
  unreadable: 'bg-red-50 text-red-700 border-red-200',
}

function years(i: Item) {
  if (!i.birth_year && !i.death_year) return null
  return `${i.birth_year ?? '?'}–${i.death_year ?? ''}`
}

function ReviewCard({ item, onDecide }: {
  item: Item
  onDecide: (item: Item, action: 'ok' | 'wrong' | 'replace', photoUrl?: string) => void
}) {
  const [broken, setBroken] = useState(false)
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [loadingCands, setLoadingCands] = useState(false)
  const [brokenCands, setBrokenCands] = useState<Set<string>>(new Set())
  const { toast } = useAdminUi()

  const findOther = async () => {
    setLoadingCands(true)
    try {
      const j = await adminFetch<{ candidates: Candidate[] }>(`/api/admin/authors/${item.slug}/photo-candidates`)
      setCands(j.candidates.filter(c => c.url !== item.photo_url))
    } catch (e) {
      toast(`Search failed: ${(e as Error).message}`, 'error')
    } finally {
      setLoadingCands(false)
    }
  }

  const shown = (cands ?? []).filter(c => !brokenCands.has(c.url))

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
      <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center">
        {broken ? (
          <p className="text-xs text-gray-500 px-4 text-center">Image does not load<br />(dead link)</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt={`Current photo for ${item.name}`} className="w-full h-full object-cover"
            loading="lazy" onError={() => setBroken(true)} />
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a href={`/authors/${item.slug}`} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-sm text-gray-900 hover:underline break-words">{item.name}</a>
            {years(item) && <span className="text-xs text-gray-500 ml-1">({years(item)})</span>}
          </div>
          <span className={`shrink-0 text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${VERDICT_CLS[item.verdict] ?? VERDICT_CLS.unsure}`}>
            {VERDICT_LABEL[item.verdict] ?? item.verdict}
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-snug flex-1">{item.reasoning}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onDecide(item, 'ok')}
            className="rounded-md border border-green-300 bg-green-50 text-green-800 text-sm font-medium py-1.5 hover:bg-green-100">
            ✓ Good
          </button>
          <button onClick={() => onDecide(item, 'wrong')}
            className="rounded-md border border-red-300 bg-red-50 text-red-700 text-sm font-medium py-1.5 hover:bg-red-100">
            ✗ Wrong
          </button>
        </div>
        <div className="flex items-center justify-between text-xs">
          <button onClick={findOther} disabled={loadingCands} className="text-gray-600 hover:text-gray-900 underline disabled:opacity-50">
            {loadingCands ? 'Searching…' : cands ? 'Search again' : 'Find other photo'}
          </button>
          <Link href={`/admin/authors/${item.slug}`} className="text-gray-400 hover:text-gray-700">Edit author</Link>
        </div>
        {cands && (
          shown.length === 0 ? (
            <p className="text-xs text-gray-500">No alternatives found (Wikidata, Wikipedia, Open Library).</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {shown.map(c => (
                <button key={c.url} title={`${c.label} · ${c.source}`}
                  onClick={() => onDecide(item, 'replace', c.url)}
                  className="group text-left rounded border border-gray-200 hover:border-blue-500 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={c.label} className="w-full aspect-square object-cover"
                    onError={() => setBrokenCands(s => new Set(s).add(c.url))} />
                  <span className="block px-1 py-0.5 text-[10px] leading-tight text-gray-600 line-clamp-3">{c.label}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default function PhotoReviewClient() {
  const { toast } = useAdminUi()
  const [items, setItems] = useState<Item[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  // Decisions are POSTed one at a time: the queue is a single JSON file, and
  // two concurrent read-modify-writes would lose one decision.
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    adminFetch<{ items: Item[]; counts: Counts }>('/api/admin/photo-review')
      .then(j => { setItems(j.items); setCounts(j.counts) })
      .catch(e => setError((e as Error).message))
  }, [])

  const decide = useCallback((item: Item, action: 'ok' | 'wrong' | 'replace', photoUrl?: string) => {
    setItems(list => list?.filter(i => i.author_id !== item.author_id) ?? list)
    setCounts(c => c && {
      ...c,
      pending: c.pending - 1,
      ok: c.ok + (action === 'ok' ? 1 : 0),
      wrong: c.wrong + (action === 'wrong' ? 1 : 0),
      replaced: c.replaced + (action === 'replace' ? 1 : 0),
    })
    chain.current = chain.current.then(() =>
      adminFetch('/api/admin/photo-review', { method: 'POST', json: { author_id: item.author_id, action, photo_url: photoUrl } })
        .catch(e => {
          toast(`${item.name}: ${(e as Error).message}`, 'error')
          setItems(list => (list ? [item, ...list] : list))
        }))
  }, [toast])

  const byVerdict = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items ?? []) m.set(i.verdict, (m.get(i.verdict) ?? 0) + 1)
    return m
  }, [items])
  const visible = (items ?? []).filter(i => filter === 'all' || i.verdict === filter)

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <PageHeader
        title="Author photo review"
        subtitle={counts
          ? `${counts.pending} to review · ${counts.ok} good · ${counts.wrong} removed · ${counts.replaced} replaced${counts.stale ? ` · ${counts.stale} changed since the audit (hidden)` : ''}`
          : 'Photos the vision audit could not settle'}
        backHref="/admin/authors"
        backLabel="Authors"
      />

      <p className="text-sm text-gray-600 mb-4 max-w-3xl">
        <strong>Good</strong> keeps the photo and future audits skip it. <strong>Wrong</strong> removes it, and
        enrichment will not put it back. <strong>Find other photo</strong> shows candidates from Wikidata, Wikipedia
        and Open Library, each labelled so you can rule out namesakes; click one to use it.
      </p>

      {error && <p className="text-sm text-red-600">Failed to load: {error}</p>}
      {!items && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {items && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {['all', 'era_mismatch', 'unsure', 'not_a_person', 'unreadable'].map(v => {
              const n = v === 'all' ? items.length : byVerdict.get(v) ?? 0
              if (v !== 'all' && !n) return null
              return (
                <button key={v} onClick={() => setFilter(v)}
                  className={`text-sm rounded-full border px-3 py-1 ${filter === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                  {v === 'all' ? 'All' : VERDICT_LABEL[v]} <span className="opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing left to review here.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {visible.slice(0, 60).map(i => <ReviewCard key={i.author_id} item={i} onDecide={decide} />)}
            </div>
          )}
          {visible.length > 60 && (
            <p className="text-xs text-gray-500 mt-4">Showing 60 of {visible.length}; the next ones appear as you decide.</p>
          )}
        </>
      )}
    </main>
  )
}
