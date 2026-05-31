'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminBackLink from '@/components/admin-back-link'
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
  currentSelection: FeaturedBookRow[]
  config: {
    enabled: boolean
    year: number
    startDate: string
    endDate: string
    promoStartDate: string | null
    dateRange: string
    promoActive: boolean
  }
  tilePreview: {
    title: string
    tagline: string | null
  }
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
          <p className="text-sm text-gray-500 mt-1">
            Year {year}{year === props.config.year && ' · matches config'}
          </p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      {/* Year picker */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Year</label>
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value) || year)}
          className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
        />
        <button
          onClick={() => router.push(`/admin/banned-books-week?year=${year}`)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:border-gray-400"
        >
          Switch year
        </button>
      </div>

      <BBWConfigCard initial={props.config} onSave={() => router.refresh()} />

      {/* Tile preview — shows exactly how the homepage tile will render. */}
      <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-white">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Tile preview <span className="text-gray-400 font-normal">(what visitors see on the homepage)</span></div>
        <div className="border border-brand/40 rounded-lg p-4 bg-white max-w-sm">
          <svg className="w-5 h-5 text-brand mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <div className="font-semibold text-sm">{props.tilePreview.title}</div>
          {props.tilePreview.tagline ? (
            <div
              className="text-xs text-gray-600 leading-snug mt-1"
              dangerouslySetInnerHTML={{ __html: props.tilePreview.tagline }}
            />
          ) : (
            <div className="text-xs text-amber-700 mt-1 italic">
              bbw-tile-tagline content block not yet published — tile will be hidden until it is.
            </div>
          )}
          <div className="text-[11px] text-brand mt-2">Learn more →</div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Title is auto-generated from year + dates. Body text comes from{' '}
          <Link href="/admin/content-blocks/bbw-tile-tagline" className="text-brand hover:underline">bbw-tile-tagline</Link>.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Hub content blocks</div>
          <div className="text-sm font-medium mt-0.5">
            {props.requiredBlocks.filter(b => b.status === 'published').length} / {props.requiredBlockCount} published
          </div>
          <Link href="/admin/content-blocks" className="text-xs text-brand hover:underline mt-1 inline-block">Edit blocks →</Link>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
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
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
        >
          {busy === 'suggest' ? 'Generating…' : 'Generate suggestions'}
        </button>
        <button
          onClick={saveDraft}
          disabled={!!busy || picks.length === 0}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:border-gray-400"
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
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      {/* Featured picks list */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Featured picks ({picks.length})</h2>
        {picks.length === 0 ? (
          <p className="text-sm text-gray-500">No picks yet. Generate suggestions or save a manual list.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {picks.map((p, i) => (
              <li key={p.book_id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, +1)} disabled={i === picks.length - 1} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 disabled:opacity-30">↓</button>
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
                        <ul className="mt-1 text-xs text-gray-600 space-y-0.5 pl-3">
                          <li>recency: {(p.meta.components.recencyOfBans).toFixed(2)}</li>
                          <li>total bans: {(p.meta.components.totalBanCount).toFixed(2)}</li>
                          <li>geo spread: {(p.meta.components.geographicSpread).toFixed(2)}</li>
                          <li>top-list: {(p.meta.components.topListPresence).toFixed(2)}</li>
                          <li>diversity: {(p.meta.components.diversityBonus).toFixed(2)}</li>
                          {p.meta.penaltyApplied && <li className="text-amber-700">−40% prev-year penalty</li>}
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
                      className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white resize-y"
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
              <li key={a.book_id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-start justify-between gap-3">
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
                  className="px-2.5 py-1 rounded text-xs border border-gray-300 hover:border-gray-400"
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

// ── BBW config card (DB-backed, editable) ─────────────────────────────────
//
// Renders the runtime config and lets the editor flip enabled, change the
// year, dates, and (optional) promoStartDate from the admin UI. Saves
// through PATCH /api/admin/bbw-config which writes the singleton row in
// bbw_config (migration 017) and invalidates the in-memory cache so the
// homepage tile reflects the new values within ~60s.

type ConfigCardInput = {
  enabled: boolean
  year: number
  startDate: string
  endDate: string
  promoStartDate: string | null
  dateRange: string
  promoActive: boolean
}

function BBWConfigCard({ initial, onSave }: { initial: ConfigCardInput; onSave: () => void }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [year, setYear] = useState(initial.year)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [promoStart, setPromoStart] = useState(initial.promoStartDate ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    enabled !== initial.enabled ||
    year !== initial.year ||
    startDate !== initial.startDate ||
    endDate !== initial.endDate ||
    (promoStart || null) !== initial.promoStartDate

  async function save() {
    setBusy(true); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/bbw-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          year,
          startDate,
          endDate,
          promoStartDate: promoStart || null,
        }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setMsg('Saved.')
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  // Quick toggle path: flip enabled without committing the rest of the form.
  // The button autosaves so the editor doesn't need to scroll to the bottom
  // just to flip the kill switch.
  async function flipEnabled(next: boolean) {
    setEnabled(next)
    setBusy(true); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/bbw-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setMsg(next ? 'BBW enabled.' : 'BBW disabled.')
      onSave()
    } catch (err) {
      setEnabled(!next) // roll back optimistic flip
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1 text-sm bg-white disabled:opacity-50'

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Config</div>
        <ToggleSwitch
          checked={enabled}
          onChange={flipEnabled}
          disabled={busy}
          labelOn="Enabled"
          labelOff="Disabled"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Year</span>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value) || year)}
            disabled={busy}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Promo starts (optional — lead-up)</span>
          <input
            type="date"
            value={promoStart}
            onChange={e => setPromoStart(e.target.value)}
            disabled={busy}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">BBW start date</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            disabled={busy}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">BBW end date</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            disabled={busy}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
        <span className="text-gray-500">Date range: <span className="text-gray-700">{initial.dateRange}</span></span>
        <span className="text-gray-500">·</span>
        <span className="text-gray-500">
          Tile right now:{' '}
          {initial.promoActive ? (
            <span className="text-green-700">visible on homepage</span>
          ) : (
            <span>hidden ({initial.enabled ? 'outside promo window' : 'config disabled'})</span>
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={!dirty || busy}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
        {dirty && !busy && !msg && <span className="text-xs text-amber-600">Unsaved changes</span>}
      </div>
    </div>
  )
}

// Tiny toggle switch — used for the "enabled" kill switch above.
function ToggleSwitch({
  checked, onChange, disabled, labelOn, labelOff,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  labelOn: string
  labelOff: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 group disabled:opacity-50`}
    >
      <span className={`text-xs font-medium ${checked ? 'text-green-700' : 'text-gray-500'}`}>
        {checked ? labelOn : labelOff}
      </span>
      <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}
