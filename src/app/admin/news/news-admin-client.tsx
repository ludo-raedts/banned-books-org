'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeNewsDisplay, languageInfo, TranslatedBadge, OriginalTitleLine } from '@/lib/news-display'
import type { NewsConfig } from '@/config/news'

// router.refresh() re-runs the server component but won't re-seed
// useState(initialX), so newly-fetched items stayed invisible until a
// hard reload. Use this instead for any flow that needs the parent
// state to reflect server-side inserts.
function hardReload() {
  if (typeof window !== 'undefined') window.location.reload()
}

type NewsItem = {
  id: number
  title: string
  headline: string | null
  source_name: string
  source_url: string
  published_at: string | null
  summary: string | null
  source_language: string | null
  original_title: string | null
  original_summary: string | null
}

type PublishedItem = NewsItem & { auto_published: boolean }

/**
 * Optional editor-only block: original_summary collapsed in a <details>. The
 * original_title sits inline above (via OriginalTitleLine) per the language
 * transparency spec, but the full source description is verbose, so we tuck
 * it behind a click for translation auditing.
 */
function OriginalSummaryDetails({ item }: { item: NewsItem }) {
  if (!item.original_summary) return null
  if ((item.source_language ?? 'en').toLowerCase().slice(0, 2) === 'en') return null
  const { label } = languageInfo(item.source_language)
  return (
    <details className="text-xs text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
        Show original summary ({label})
      </summary>
      <p className="mt-2 leading-relaxed whitespace-pre-wrap italic">{item.original_summary}</p>
    </details>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const editInputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400'

function NewsRow({ item, onDone, onPatch }: { item: NewsItem; onDone: (id: number) => void; onPatch: (patch: Partial<NewsItem>) => void }) {
  const [editing, setEditing] = useState(false)
  const [headline, setHeadline] = useState(item.headline ?? '')
  const [summary, setSummary] = useState(item.summary ?? '')
  const [loading, setLoading] = useState<string | null>(null)

  async function call(action: string, extras?: { headline?: string; summary?: string }) {
    setLoading(action)
    await fetch('/api/admin/news', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action, ...extras }),
    })
    setLoading(null)
    // publish + reject move the draft out of the queue; update_text keeps the
    // row visible and merges the edit into parent state.
    if (action === 'update_text' && extras) onPatch(extras)
    else onDone(item.id)
  }

  const { title, sourceName } = normalizeNewsDisplay(item.title, item.source_name)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {item.headline && !editing && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand mb-1">
              {item.headline}
            </p>
          )}
          <a
            href={item.source_url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="font-semibold text-sm hover:underline leading-snug"
          >
            {title}
          </a>
          <OriginalTitleLine
            code={item.source_language}
            originalTitle={item.original_title}
            className="mt-0.5"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{sourceName} · {formatDate(item.published_at)}</span>
            <TranslatedBadge code={item.source_language} />
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest text-gray-500">Headline</span>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Short attention-grabbing kop"
              className={editInputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest text-gray-500">Summary</span>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={4}
              className={`${editInputCls} resize-none`}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{summary || <em className="text-gray-400">No summary</em>}</p>
      )}

      <OriginalSummaryDetails item={item} />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => call('publish', editing ? { headline, summary } : undefined)}
          disabled={!!loading}
          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-green-700"
        >
          {loading === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
        <button
          onClick={() => call('reject')}
          disabled={!!loading}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-red-700"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        {editing ? (
          <>
            <button
              onClick={() => { call('update_text', { headline, summary }); setEditing(false) }}
              disabled={!!loading}
              className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-medium disabled:opacity-50"
            >
              Save edit
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs hover:border-gray-400"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

export default function NewsAdminClient({
  initialItems,
  initialPublished,
  initialConfig,
}: {
  initialItems: NewsItem[]
  initialPublished: PublishedItem[]
  initialConfig: NewsConfig
}) {
  const [items, setItems] = useState<NewsItem[]>(initialItems)
  const [published, setPublished] = useState<PublishedItem[]>(initialPublished)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)
  const [rejectingAll, setRejectingAll] = useState(false)
  const [langFilter, setLangFilter] = useState<string>('all')
  const router = useRouter()

  // Languages present in the current draft queue. Drives the filter dropdown
  // — no point listing 'ru' if there are no Russian items pending.
  const availableLangs = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) set.add((item.source_language ?? 'en').toLowerCase().slice(0, 2))
    return [...set].sort()
  }, [items])

  const filteredItems = useMemo(() => {
    if (langFilter === 'all') return items
    return items.filter(i => (i.source_language ?? 'en').toLowerCase().slice(0, 2) === langFilter)
  }, [items, langFilter])

  function onDone(id: number) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function onUnpublished(id: number) {
    setPublished(prev => prev.filter(i => i.id !== id))
  }

  // In-place merge after Save edit: parent owns the items array and the child
  // can't mutate the row's props directly. router.refresh() re-runs the server
  // component but doesn't propagate into useState(initialItems), so we patch
  // the local state ourselves.
  function patchDraft(id: number, patch: Partial<NewsItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function patchPublished(id: number, patch: Partial<PublishedItem>) {
    setPublished(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  async function fetchNow() {
    setFetching(true)
    setFetchMsg(null)
    try {
      const res = await fetch('/api/admin/fetch-news', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setFetchMsg(`Error: ${data.error}`)
      } else {
        const dupBit = typeof data.duplicates === 'number' ? `, ${data.duplicates} duplicate${data.duplicates !== 1 ? 's' : ''}` : ''
        setFetchMsg(`Done — ${data.saved} saved, ${data.skipped} not relevant${dupBit}${data.errors?.length ? `, ${data.errors.length} error(s)` : ''}`)
        hardReload()
      }
    } catch {
      setFetchMsg('Network error')
    }
    setFetching(false)
  }

  async function rejectAll() {
    setRejectingAll(true)
    const res = await fetch('/api/admin/news', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject_all' }),
      credentials: 'include',
    })
    setRejectingAll(false)
    if (res.ok) setItems([])
  }

  return (
    <div className="flex flex-col gap-4">
      <NewsConfigCard initial={initialConfig} onSave={() => router.refresh()} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={fetchNow}
          disabled={fetching || rejectingAll}
          className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50 hover:opacity-90"
        >
          {fetching ? 'Fetching…' : 'Fetch news now'}
        </button>
        {items.length > 0 && (
          <button
            onClick={rejectAll}
            disabled={fetching || rejectingAll}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-red-700"
          >
            {rejectingAll ? 'Rejecting…' : 'Reject all'}
          </button>
        )}
        {availableLangs.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-auto">
            <span>Language</span>
            <select
              value={langFilter}
              onChange={e => setLangFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800"
            >
              <option value="all">All languages</option>
              {availableLangs.map(code => {
                const { label, flag } = languageInfo(code)
                return <option key={code} value={code}>{flag} {label}</option>
              })}
            </select>
          </label>
        )}
        {fetchMsg && <span className="text-sm text-gray-600 dark:text-gray-400">{fetchMsg}</span>}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-8">
          {items.length === 0 ? 'No drafts — run the fetch-news script to populate.' : 'No drafts in this language.'}
        </p>
      ) : (
        filteredItems.map(item => (
          <NewsRow key={item.id} item={item} onDone={onDone} onPatch={patch => patchDraft(item.id, patch)} />
        ))
      )}

      {published.length > 0 && (
        <section className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recent published</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Last {published.length} item{published.length !== 1 ? 's' : ''} on the public news page.
              Auto-published items are flagged so you can spot them quickly.
            </p>
          </div>
          {published.map(item => (
            <PublishedRow key={item.id} item={item} onDone={onUnpublished} onPatch={patch => patchPublished(item.id, patch)} />
          ))}
        </section>
      )}
    </div>
  )
}

function PublishedRow({ item, onDone, onPatch }: { item: PublishedItem; onDone: (id: number) => void; onPatch: (patch: Partial<PublishedItem>) => void }) {
  const [editing, setEditing] = useState(false)
  const [headline, setHeadline] = useState(item.headline ?? '')
  const [summary, setSummary] = useState(item.summary ?? '')
  const [loading, setLoading] = useState<string | null>(null)

  async function call(action: string, extras?: { headline?: string; summary?: string }) {
    setLoading(action)
    await fetch('/api/admin/news', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action, ...extras }),
    })
    setLoading(null)
    if (action === 'unpublish') onDone(item.id)
    else if (action === 'update_text' && extras) onPatch(extras)
  }

  async function unpublish() {
    if (!confirm(`Unpublish "${item.title.slice(0, 80)}"?\n\nIt will be removed from /news. The source URL stays in the dedup list so it won't be re-published.`)) return
    await call('unpublish')
  }

  const { title, sourceName } = normalizeNewsDisplay(item.title, item.source_name)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {item.headline && !editing && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand mb-1">
              {item.headline}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={item.source_url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="font-semibold text-sm hover:underline leading-snug"
            >
              {title}
            </a>
            {item.auto_published && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Auto
              </span>
            )}
          </div>
          <OriginalTitleLine
            code={item.source_language}
            originalTitle={item.original_title}
            className="mt-0.5"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{sourceName} · {formatDate(item.published_at)}</span>
            <TranslatedBadge code={item.source_language} />
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest text-gray-500">Headline</span>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Short attention-grabbing kop"
              className={editInputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest text-gray-500">Summary</span>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={4}
              className={`${editInputCls} resize-none`}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{summary || <em className="text-gray-400">No summary</em>}</p>
      )}

      <OriginalSummaryDetails item={item} />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={unpublish}
          disabled={!!loading}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-red-700"
        >
          {loading === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
        </button>
        {editing ? (
          <>
            <button
              onClick={() => { call('update_text', { headline, summary }); setEditing(false) }}
              disabled={!!loading}
              className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-medium disabled:opacity-50"
            >
              Save edit
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs hover:border-gray-400"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ── News config card ────────────────────────────────────────────────────────
//
// Auto-publish kill switch + dedup tuning. Daily cron pulls from feeds, and
// when auto_publish is on, items that pass relevance + similarity dedup go
// straight to 'published' — no draft queue needed. dedupThreshold is the
// cosine similarity above which a story counts as a duplicate of something
// already in the lookback window.

function NewsConfigCard({ initial, onSave }: { initial: NewsConfig; onSave: () => void }) {
  const [autoPublish, setAutoPublish] = useState(initial.autoPublish)
  const [threshold, setThreshold] = useState(initial.dedupThreshold)
  const [windowDays, setWindowDays] = useState(initial.dedupWindowDays)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    autoPublish !== initial.autoPublish ||
    threshold !== initial.dedupThreshold ||
    windowDays !== initial.dedupWindowDays

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/news-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onSave()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function flipAuto(next: boolean) {
    setAutoPublish(next)
    const ok = await patch({ autoPublish: next })
    if (!ok) setAutoPublish(!next)
    else setMsg(next ? 'Auto-publish on — daily cron will publish directly.' : 'Auto-publish off — items land as drafts.')
  }

  async function saveTuning() {
    const ok = await patch({ dedupThreshold: threshold, dedupWindowDays: windowDays })
    if (ok) setMsg('Saved.')
  }

  const inputCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 disabled:opacity-50'

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Auto-publish</div>
          <div className="text-xs text-gray-500 mt-0.5">Daily cron pulls feeds at 08:00 UTC. When on, items skip the draft queue.</div>
        </div>
        <ToggleSwitch
          checked={autoPublish}
          onChange={flipAuto}
          disabled={busy}
          labelOn="On"
          labelOff="Off"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Dedup threshold (cosine, 0–1) — lower = more aggressive</span>
          <input
            type="number"
            step="0.01"
            min="0.5"
            max="1"
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value) || threshold)}
            disabled={busy}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Dedup lookback (days)</span>
          <input
            type="number"
            min="1"
            max="60"
            value={windowDays}
            onChange={e => setWindowDays(Number(e.target.value) || windowDays)}
            disabled={busy}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={saveTuning}
          disabled={!dirty || busy}
          className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save dedup settings'}
        </button>
        {msg && <span className="text-xs text-green-700 dark:text-green-400">{msg}</span>}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  )
}

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
      className="inline-flex items-center gap-2 group disabled:opacity-50"
    >
      <span className={`text-xs font-medium ${checked ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
        {checked ? labelOn : labelOff}
      </span>
      <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}
