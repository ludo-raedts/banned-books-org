'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FeaturedBookRow } from '@/lib/bbw-data'

type RequiredBlockSummary = { slug: string; title: string; status: 'placeholder' | 'draft' | 'published' }

type ScoredCandidate = {
  book_id: number
  // Fetched alongside the score so the UI can show real titles + authors
  // instead of "Book {id}". Falls back to the id-string only when the join
  // misses (shouldn't happen unless a book was deleted mid-suggest).
  title: string
  slug: string | null
  authors: string[]
  finalScore: number
  rawScore: number
  components: {
    recencyOfBans: number
    totalBanCount: number
    geographicSpread: number
    topListPresence: number
    diversityBonus: number
  }
  penaltyApplied: boolean
  countries: string[]
  reasons: string[]
  countryCount: number
  banCount: number
  inPreviousYears: boolean
}

interface Props {
  year: number
  configuredYear: number
  configuredEnabled: boolean
  currentSelection: FeaturedBookRow[]
  requiredBlocks: RequiredBlockSummary[]
  requiredBlockCount: number
  totalBooksInDataset: number
}

// Local row type combining the suggester output and editor edits before save.
type DraftRow = {
  book_id: number
  position: number
  custom_blurb: string
  pinned: boolean
  // Read-only metadata to display in the UI; not persisted on save.
  meta?: {
    title?: string
    authors?: string[]
    countries?: string[]
    reasons?: string[]
    banCount?: number
    finalScore?: number
    components?: ScoredCandidate['components']
    penaltyApplied?: boolean
    inPreviousYears?: boolean
  }
}

function fromFeaturedRow(r: FeaturedBookRow): DraftRow {
  return {
    book_id: r.bookId,
    position: r.position,
    custom_blurb: r.customBlurb ?? '',
    pinned: r.pinned,
    meta: {
      title: r.book.title,
      authors: r.book.authors,
      countries: Array.from({ length: r.book.countryCount }, () => ''),
      reasons: r.book.reasons,
      banCount: r.book.banCount,
    },
  }
}

export default function BannedBooksWeekAdminClient(props: Props) {
  const router = useRouter()
  const [year, setYear] = useState(props.year)
  const [picks, setPicks] = useState<DraftRow[]>(props.currentSelection.map(fromFeaturedRow))
  const [alternates, setAlternates] = useState<ScoredCandidate[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const blocksReady = props.requiredBlocks.every(b => b.status === 'published')
    && props.requiredBlocks.length === props.requiredBlockCount

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/banned-books-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, year, ...extra }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function generate() {
    const data = await call('suggest')
    if (!data) return
    setPicks((data.top10 as ScoredCandidate[]).map((c, i) => ({
      book_id: c.book_id,
      position: i + 1,
      custom_blurb: '',
      pinned: false,
      meta: {
        title: c.title,
        authors: c.authors,
        countries: c.countries,
        reasons: c.reasons,
        banCount: c.banCount,
        finalScore: c.finalScore,
        components: c.components,
        penaltyApplied: c.penaltyApplied,
        inPreviousYears: c.inPreviousYears,
      },
    })))
    setAlternates(data.alternates as ScoredCandidate[])
    setMsg('Suggestions generated. Review and save.')
  }

  async function saveDraft() {
    const data = await call('save_draft', { picks: picks.map(p => ({
      book_id: p.book_id,
      position: p.position,
      custom_blurb: p.custom_blurb || null,
      pinned: p.pinned,
    })) })
    if (data) {
      setMsg('Draft saved.')
      router.refresh()
    }
  }

  async function publish() {
    if (!blocksReady) {
      setError('Cannot publish — content blocks not all published')
      return
    }
    if (picks.length === 0) {
      setError('Save a draft first')
      return
    }
    // Persist current edits before flipping live.
    const saved = await call('save_draft', { picks: picks.map(p => ({
      book_id: p.book_id,
      position: p.position,
      custom_blurb: p.custom_blurb || null,
      pinned: p.pinned,
    })) })
    if (!saved) return
    const data = await call('publish')
    if (data) {
      setMsg('Published.')
      router.refresh()
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= picks.length) return
    const next = [...picks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    next.forEach((p, i) => { p.position = i + 1 })
    setPicks(next)
  }

  function remove(idx: number) {
    const next = picks.filter((_, i) => i !== idx)
    next.forEach((p, i) => { p.position = i + 1 })
    setPicks(next)
  }

  function promoteAlternate(altBookId: number) {
    const alt = alternates.find(a => a.book_id === altBookId)
    if (!alt) return
    const newPick: DraftRow = {
      book_id: alt.book_id,
      position: picks.length + 1,
      custom_blurb: '',
      pinned: false,
      meta: {
        title: alt.title,
        authors: alt.authors,
        countries: alt.countries,
        reasons: alt.reasons,
        banCount: alt.banCount,
        finalScore: alt.finalScore,
        components: alt.components,
        penaltyApplied: alt.penaltyApplied,
        inPreviousYears: alt.inPreviousYears,
      },
    }
    setPicks([...picks, newPick])
    setAlternates(alternates.filter(a => a.book_id !== altBookId))
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banned Books Week — featured picks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Year {year}{year === props.configuredYear && ' · matches config'}
          </p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          ← Admin dashboard
        </Link>
      </div>

      {/* Year picker */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Year</label>
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value) || year)}
          className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-800"
        />
        <button
          onClick={() => router.push(`/admin/banned-books-week?year=${year}`)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs hover:border-gray-400"
        >
          Switch year
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Config</div>
          <div className="text-sm font-medium mt-0.5">
            {props.configuredEnabled ? `Enabled — year ${props.configuredYear}` : `Disabled (year ${props.configuredYear})`}
          </div>
          <div className="text-xs text-gray-500 mt-1">Edit <code>config/banned-books-week.ts</code></div>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Content blocks</div>
          <div className="text-sm font-medium mt-0.5">
            {props.requiredBlocks.filter(b => b.status === 'published').length} / {props.requiredBlockCount} published
          </div>
          <Link href="/admin/content-blocks" className="text-xs text-brand hover:underline mt-1 inline-block">Edit blocks →</Link>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Dataset</div>
          <div className="text-sm font-medium mt-0.5">{props.totalBooksInDataset.toLocaleString('en')} books</div>
          <div className="text-xs text-gray-500 mt-1">Source for the suggester</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-5 flex flex-wrap gap-2 items-center">
        <button
          onClick={generate}
          disabled={!!busy}
          className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50 hover:opacity-90"
        >
          {busy === 'suggest' ? 'Generating…' : 'Generate suggestions'}
        </button>
        <button
          onClick={saveDraft}
          disabled={!!busy || picks.length === 0}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50 hover:border-gray-400"
        >
          {busy === 'save_draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button
          onClick={publish}
          disabled={!!busy || picks.length === 0 || !blocksReady}
          title={!blocksReady ? 'Required content blocks not all published' : undefined}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700"
        >
          {busy === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
        <Link href={`/banned-books-week?preview=draft`} target="_blank" className="text-sm text-brand hover:underline">
          Preview draft →
        </Link>
        {msg && <span className="text-xs text-green-700 dark:text-green-400">{msg}</span>}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {/* Featured picks list */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Featured picks ({picks.length})</h2>
        {picks.length === 0 ? (
          <p className="text-sm text-gray-500">No picks yet. Generate suggestions or save a manual list.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {picks.map((p, i) => (
              <li key={p.book_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, +1)} disabled={i === picks.length - 1} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30">↓</button>
                  </div>
                  <div className="w-7 text-xs text-gray-500 font-mono pt-1">#{p.position}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.meta?.title ?? `Book ${p.book_id}`}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.meta?.authors?.join(', ')}
                      {p.meta?.banCount ? ` · ${p.meta.banCount} bans` : ''}
                      {p.meta?.countries && p.meta.countries.length > 0 ? ` · ${new Set(p.meta.countries).size} countries` : ''}
                      {p.meta?.inPreviousYears ? ' · prev. year' : ''}
                    </div>
                    {p.meta?.components && (
                      <details className="mt-1.5">
                        <summary className="text-xs text-gray-500 cursor-pointer">Why the engine picked this</summary>
                        <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5 pl-3">
                          <li>recency: {(p.meta.components.recencyOfBans).toFixed(2)}</li>
                          <li>total bans: {(p.meta.components.totalBanCount).toFixed(2)}</li>
                          <li>geo spread: {(p.meta.components.geographicSpread).toFixed(2)}</li>
                          <li>top-list: {(p.meta.components.topListPresence).toFixed(2)}</li>
                          <li>diversity: {(p.meta.components.diversityBonus).toFixed(2)}</li>
                          {p.meta.penaltyApplied && <li className="text-amber-700 dark:text-amber-400">−40% prev-year penalty</li>}
                          <li className="font-medium">final: {(p.meta.finalScore ?? 0).toFixed(3)}</li>
                        </ul>
                      </details>
                    )}
                    <textarea
                      value={p.custom_blurb}
                      placeholder="Custom blurb (optional)"
                      onChange={e => {
                        const next = [...picks]; next[i] = { ...next[i], custom_blurb: e.target.value }; setPicks(next)
                      }}
                      rows={2}
                      className="mt-2 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 resize-y"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.pinned}
                        onChange={e => {
                          const next = [...picks]; next[i] = { ...next[i], pinned: e.target.checked }; setPicks(next)
                        }}
                      />
                      pinned
                    </label>
                    <button
                      onClick={() => remove(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Alternates */}
      {alternates.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Alternates ({alternates.length})</h2>
          <ul className="flex flex-col gap-2">
            {alternates.map(a => (
              <li key={a.book_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.authors.length > 0 && `${a.authors.join(', ')} · `}
                    {a.banCount} bans · {new Set(a.countries).size} countries · score {a.finalScore.toFixed(3)}
                    {a.inPreviousYears ? ' · prev. year' : ''}
                  </div>
                </div>
                <button
                  onClick={() => promoteAlternate(a.book_id)}
                  className="px-2.5 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 hover:border-gray-400"
                >
                  Promote
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
