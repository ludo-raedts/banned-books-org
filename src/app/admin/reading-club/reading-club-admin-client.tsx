'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReadingClubCard } from '@/lib/reading-club-data'

type BlockStatusSummary = { ready: boolean; total: number; published: number }
type ThemeSummary = {
  slug: string
  displayName: string
  books: ReadingClubCard[]
  blocks: { slug: string; status: 'placeholder' | 'draft' | 'published' }[]
}

interface Props {
  currentYear: number
  currentlyChallenged: ReadingClubCard[]
  international: ReadingClubCard[]
  classics: ReadingClubCard[]
  themes: ThemeSummary[]
  blockStatus: {
    currentlyChallenged: BlockStatusSummary
    international: BlockStatusSummary
    classics: BlockStatusSummary
    themesIntro: BlockStatusSummary
  }
}

type TabKey = 'currently-challenged' | 'international' | 'classics' | 'themes'

export default function ReadingClubAdminClient(props: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('currently-challenged')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(payload: Record<string, unknown>): Promise<unknown> {
    setBusy(String(payload.action) + (payload.track ? ':' + payload.track : ''))
    setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/reading-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
        {([
          ['currently-challenged', 'Currently Challenged', props.blockStatus.currentlyChallenged],
          ['international',        'International',        props.blockStatus.international],
          ['classics',             'Classics',             props.blockStatus.classics],
          ['themes',               'By Theme',             props.blockStatus.themesIntro],
        ] as const).map(([key, label, status]) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {label}
              <span className="text-[10px] text-gray-400">({status.published}/{status.total})</span>
            </button>
          )
        })}
      </div>

      {(busy || msg || error) && (
        <div className="mb-4 text-xs">
          {busy && <span className="text-gray-500">Working… ({busy})</span>}
          {msg && <span className="text-green-700 dark:text-green-400">{msg}</span>}
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
        </div>
      )}

      {tab === 'currently-challenged' && (
        <CurrentlyChallengedTab
          year={props.currentYear}
          rows={props.currentlyChallenged}
          ready={props.blockStatus.currentlyChallenged.ready}
          call={call}
          onChange={() => router.refresh()}
        />
      )}

      {tab === 'international' && (
        <BookTrackTab
          title="International"
          track="international"
          rows={props.international}
          ready={props.blockStatus.international.ready}
          showPinned
          showSuggester
          call={call}
          onChange={() => router.refresh()}
        />
      )}

      {tab === 'classics' && (
        <BookTrackTab
          title="Classics"
          track="classics"
          rows={props.classics}
          ready={props.blockStatus.classics.ready}
          call={call}
          onChange={() => router.refresh()}
        />
      )}

      {tab === 'themes' && (
        <ThemesTab
          themes={props.themes}
          themesIntroReady={props.blockStatus.themesIntro.ready}
          call={call}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ── Currently Challenged tab ───────────────────────────────────────────────

function CurrentlyChallengedTab({
  year, rows, ready, call, onChange,
}: {
  year: number
  rows: ReadingClubCard[]
  ready: boolean
  call: (p: Record<string, unknown>) => Promise<unknown>
  onChange: () => void
}) {
  const [position, setPosition] = useState(rows.length + 1)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [bookId, setBookId] = useState<number | null>(null)
  const [count, setCount] = useState<string>('')
  const [questions, setQuestions] = useState<string>('')
  const [bookshopUrl, setBookshopUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('https://www.ala.org/bbooks/frequentlychallengedbooks/top10')

  async function add() {
    if (!title || !author) return
    await call({
      action: 'save_currently_challenged_entry',
      year,
      entry: {
        position,
        title, author,
        book_id: bookId,
        challenge_count: count ? Number(count) : null,
        bookshop_url: bookshopUrl || null,
        source_url: sourceUrl || null,
        discussion_questions: questions ? questions.split('\n').filter(Boolean) : null,
      },
    })
    setTitle(''); setAuthor(''); setCount(''); setQuestions(''); setBookshopUrl(''); setBookId(null)
    setPosition(p => p + 1)
    onChange()
  }

  async function remove(p: number) {
    await call({ action: 'delete_currently_challenged_entry', year, position: p })
    onChange()
  }

  async function publish() {
    await call({ action: 'publish_track', track: 'currently-challenged', year })
    onChange()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Currently Challenged — {year}</h2>
      <p className="text-xs text-gray-500 mb-4">Manual entry from the ALA OIF annual list. Up to 12 entries to handle ties.</p>

      <ol className="flex flex-col gap-2 mb-6">
        {rows.length === 0 ? (
          <li className="text-sm text-gray-500">No entries yet for {year}.</li>
        ) : rows.map(r => (
          <li key={r.position} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900 flex items-start gap-3">
            <span className="text-xs font-mono text-gray-500 pt-1">#{r.position}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{r.title}</div>
              <div className="text-xs text-gray-500">{r.authors.join(', ')}{r.challengeCount != null ? ` · ${r.challengeCount} challenges` : ''}</div>
              {(r.discussionQuestions ?? []).length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs text-gray-500 cursor-pointer">{r.discussionQuestions.length} discussion question{r.discussionQuestions.length !== 1 ? 's' : ''}</summary>
                  <ul className="mt-1 text-xs space-y-0.5 list-disc pl-5">
                    {r.discussionQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </details>
              )}
              <div className="text-[11px] text-gray-400 mt-1">
                {r.publishedAt ? `Published ${new Date(r.publishedAt).toLocaleDateString('en-GB')}` : 'Draft'}
              </div>
            </div>
            <button onClick={() => remove(r.position)} className="text-xs text-red-600 hover:underline">Remove</button>
          </li>
        ))}
      </ol>

      <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 mb-5">
        <summary className="text-sm font-medium cursor-pointer">Add entry</summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Position"><input type="number" value={position} onChange={e => setPosition(Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Challenge count"><input value={count} onChange={e => setCount(e.target.value)} className={inputCls} /></Field>
          <Field label="Title (type to match an existing book)" wide>
            <BookTitleTypeahead
              title={title}
              onTitleChange={setTitle}
              onMatch={book => {
                setTitle(book.title)
                setAuthor(book.authors[0] ?? author)
                setBookId(book.id)
              }}
              onClear={() => setBookId(null)}
              matchedBookId={bookId}
            />
          </Field>
          <Field label="Author" wide><input value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} /></Field>
          <Field label="Bookshop URL" wide><input value={bookshopUrl} onChange={e => setBookshopUrl(e.target.value)} className={inputCls} placeholder="https://bookshop.org/..." /></Field>
          <Field label="Source URL" wide><input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className={inputCls} /></Field>
          <Field label="Discussion questions (one per line)" wide><textarea rows={3} value={questions} onChange={e => setQuestions(e.target.value)} className={inputCls} /></Field>
        </div>
        <button onClick={add} disabled={!title || !author} className="mt-3 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900">Save entry</button>
      </details>

      <button
        onClick={publish}
        disabled={!ready || rows.length === 0}
        title={!ready ? 'Required content blocks not all published' : undefined}
        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700"
      >
        Publish track
      </button>
      {!ready && <span className="ml-3 text-xs text-amber-600">Content blocks not all published — see <Link href="/admin/content-blocks" className="underline">Content blocks</Link></span>}
    </div>
  )
}

// ── Generic book-driven track tab (international & classics) ─────────────

type ScoredAlt = {
  book_id: number
  finalScore: number
  components: { recencyOfBans: number; totalBanCount: number; geographicSpread: number; topListPresence: number; diversityBonus: number }
  countries: string[]
  reasons: string[]
  countryCount: number
  banCount: number
}

function BookTrackTab({
  title, track, rows, ready, showPinned, showSuggester, call, onChange,
}: {
  title: string
  track: 'international' | 'classics'
  rows: ReadingClubCard[]
  ready: boolean
  showPinned?: boolean
  showSuggester?: boolean
  call: (p: Record<string, unknown>) => Promise<unknown>
  onChange: () => void
}) {
  const [picks, setPicks] = useState<ReadingClubCard[]>(rows)
  const [alternates, setAlternates] = useState<ScoredAlt[]>([])
  const isInternational = track === 'international'

  async function suggest() {
    if (!isInternational) return
    const data = await call({ action: 'suggest_international' }) as { top10: ScoredAlt[]; alternates: ScoredAlt[] } | null
    if (!data) return
    setPicks(data.top10.map((c, i) => ({
      bookId: c.book_id, position: i + 1, title: `Book ${c.book_id}`, authors: [],
      customBlurb: null, discussionQuestions: [], bookSlug: null, coverUrl: null, description: null,
      countries: c.countries, reasons: c.reasons, banCount: c.banCount, publishedAt: null,
    })))
    setAlternates(data.alternates)
  }

  async function saveDraft() {
    await call({
      action: 'save_track_books',
      track,
      picks: picks.map(p => ({
        book_id: p.bookId,
        position: p.position,
        custom_blurb: p.customBlurb,
        discussion_questions: p.discussionQuestions,
      })),
    })
    onChange()
  }

  async function publish() {
    await saveDraft()
    await call({ action: 'publish_track', track })
    onChange()
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= picks.length) return
    const next = [...picks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    next.forEach((p, i) => { p.position = i + 1 })
    setPicks(next)
  }

  function addBook(book: { id: number; title: string; authors: string[]; banCount: number; countryCount: number; slug: string }) {
    if (picks.some(p => p.bookId === book.id)) return // already in list
    setPicks([...picks, {
      bookId: book.id,
      position: picks.length + 1,
      title: book.title,
      authors: book.authors,
      customBlurb: null,
      discussionQuestions: [],
      bookSlug: book.slug,
      coverUrl: null,
      description: null,
      countries: [],
      reasons: [],
      banCount: book.banCount,
      publishedAt: null,
    }])
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {showSuggester && (
          <button onClick={suggest} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:border-gray-400">
            Generate suggestions
          </button>
        )}
        <button onClick={saveDraft} disabled={picks.length === 0} className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50">
          Save draft
        </button>
        <button
          onClick={publish}
          disabled={!ready || picks.length === 0}
          title={!ready ? 'Required content blocks not all published' : undefined}
          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700"
        >
          Publish
        </button>
      </div>

      <BookSearchAdd onAdd={addBook} excludeIds={picks.map(p => p.bookId).filter((x): x is number => x != null)} />

      <ol className="flex flex-col gap-2 mb-6">
        {picks.length === 0 ? (
          <li className="text-sm text-gray-500">No picks yet.</li>
        ) : picks.map((p, i) => (
          <li key={p.bookId ?? i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900 flex items-start gap-3">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, +1)} disabled={i === picks.length - 1} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30">↓</button>
            </div>
            <span className="text-xs font-mono text-gray-500 pt-1">#{p.position}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500">{p.authors.join(', ')}{p.banCount ? ` · ${p.banCount} bans` : ''}{p.countries.length > 0 ? ` · ${new Set(p.countries).size} countries` : ''}</div>
              <textarea
                value={p.customBlurb ?? ''}
                placeholder="Custom blurb (optional)"
                onChange={e => {
                  const next = [...picks]
                  next[i] = { ...next[i], customBlurb: e.target.value || null }
                  setPicks(next)
                }}
                rows={2}
                className="mt-2 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 resize-y"
              />
            </div>
            <button onClick={() => setPicks(picks.filter((_, j) => j !== i).map((p, j) => ({ ...p, position: j + 1 })))} className="text-xs text-red-600 hover:underline">Remove</button>
          </li>
        ))}
      </ol>

      {alternates.length > 0 && (
        <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
          <summary className="text-sm font-medium cursor-pointer">Alternates ({alternates.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {alternates.map(a => (
              <li key={a.book_id} className="text-xs flex items-center justify-between">
                <span>Book {a.book_id} · {a.banCount} bans · {a.countryCount} countries · {a.finalScore.toFixed(3)}</span>
                <button
                  onClick={() => {
                    setPicks([...picks, {
                      bookId: a.book_id, position: picks.length + 1, title: `Book ${a.book_id}`, authors: [],
                      customBlurb: null, discussionQuestions: [], bookSlug: null, coverUrl: null, description: null,
                      countries: a.countries, reasons: a.reasons, banCount: a.banCount, publishedAt: null,
                    }])
                    setAlternates(alternates.filter(x => x.book_id !== a.book_id))
                  }}
                  className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:border-gray-400"
                >
                  Promote
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// ── Themes tab ──────────────────────────────────────────────────────────────

function ThemesTab({
  themes, themesIntroReady, call, onChange,
}: {
  themes: ThemeSummary[]
  themesIntroReady: boolean
  call: (p: Record<string, unknown>) => Promise<unknown>
  onChange: () => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">By Theme</h2>
      <p className="text-xs text-gray-500 mb-4">
        Each theme auto-pulls books from the dataset using the configured reason mapping. Publishing an admin override replaces the auto-pull.
        {!themesIntroReady && <span className="text-amber-600 ml-1">· "By Theme" intro block not yet published.</span>}
      </p>
      <div className="flex flex-col gap-4">
        {themes.map(t => (
          <ThemePanel key={t.slug} theme={t} call={call} onChange={onChange} />
        ))}
      </div>
    </div>
  )
}

function ThemePanel({
  theme, call, onChange,
}: {
  theme: ThemeSummary
  call: (p: Record<string, unknown>) => Promise<unknown>
  onChange: () => void
}) {
  const blockReady = theme.blocks.every(b => b.status === 'published') && theme.blocks.length > 0
  const [picks, setPicks] = useState<ReadingClubCard[]>(theme.books)

  async function publish() {
    await call({
      action: 'save_track_books',
      track: `theme:${theme.slug}`,
      picks: picks.map(p => ({
        book_id: p.bookId,
        position: p.position,
        custom_blurb: p.customBlurb,
        discussion_questions: p.discussionQuestions,
      })),
    })
    await call({ action: 'publish_track', track: `theme:${theme.slug}` })
    onChange()
  }

  return (
    <details className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
        <span className="font-medium text-sm">{theme.displayName}</span>
        <span className="text-xs text-gray-500">{picks.length} books{blockReady ? ' · intro published' : ' · intro pending'}</span>
      </summary>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <ol className="flex flex-col gap-1.5 mb-3">
          {picks.length === 0 ? (
            <li className="text-xs text-gray-500">No books for this theme yet.</li>
          ) : picks.slice(0, 12).map((p, i) => (
            <li key={p.bookId ?? i} className="text-xs flex items-center gap-2">
              <span className="font-mono text-gray-500">#{p.position}</span>
              <span className="flex-1">{p.title} — {p.authors.join(', ')} ({p.banCount} bans)</span>
              <button onClick={() => setPicks(picks.filter((_, j) => j !== i).map((p, j) => ({ ...p, position: j + 1 })))} className="text-red-600 hover:underline">remove</button>
            </li>
          ))}
        </ol>

        <BookSearchAdd
          onAdd={book => {
            if (picks.some(p => p.bookId === book.id)) return
            setPicks([...picks, {
              bookId: book.id,
              position: picks.length + 1,
              title: book.title,
              authors: book.authors,
              customBlurb: null,
              discussionQuestions: [],
              bookSlug: book.slug,
              coverUrl: null,
              description: null,
              countries: [],
              reasons: [],
              banCount: book.banCount,
              publishedAt: null,
            }])
          }}
          excludeIds={picks.map(p => p.bookId).filter((x): x is number => x != null)}
        />

        <button
          onClick={publish}
          disabled={!blockReady || picks.length === 0}
          title={!blockReady ? 'Theme intro block not yet published' : undefined}
          className="mt-3 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-green-700"
        >
          Save & publish theme
        </button>
      </div>
    </details>
  )
}

// ── Book search & add ───────────────────────────────────────────────────────
//
// Type-to-search input that hits /api/admin/books/search and lets the editor
// click a result to add it to the current track's picks. Used by Classics
// (the only manual-curation track), International (to add specific picks the
// engine didn't surface), and per-theme override panels.

type BookSearchHit = {
  id: number
  title: string
  slug: string
  authors: string[]
  banCount: number
  countryCount: number
}

function BookSearchAdd({
  onAdd, excludeIds,
}: {
  onAdd: (book: BookSearchHit) => void
  excludeIds: number[]
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<BookSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // Debounced search — wait for the user to stop typing for 200ms before
  // hitting the API. Empty/short queries clear results without a fetch.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/admin/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (!cancelled) setResults((d.results ?? []) as BookSearchHit[]) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const filtered = results.filter(r => !excludeIds.includes(r.id))

  return (
    <div className="relative mb-3">
      <input
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Add a book — type at least 2 characters of the title…"
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 z-20 max-h-72 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No matches{results.length > 0 ? ' (already added)' : ''}.</div>
          )}
          {filtered.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onAdd(r); setQ(''); setResults([]); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-gray-500">
                {r.authors.length > 0 ? r.authors.join(', ') : '—'}
                {r.banCount > 0 ? ` · ${r.banCount} bans · ${r.countryCount} ${r.countryCount === 1 ? 'country' : 'countries'}` : ' · no bans recorded'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Title typeahead (Currently Challenged form) ─────────────────────────────
//
// Differs from BookSearchAdd: instead of "click → add to list", here clicking
// a result *fills the current form* (title + author + matchedBookId), so the
// editor can keep typing extra fields. If no result matches, the form still
// works manually — book_id stays null.

function BookTitleTypeahead({
  title, onTitleChange, onMatch, onClear, matchedBookId,
}: {
  title: string
  onTitleChange: (v: string) => void
  onMatch: (book: BookSearchHit) => void
  onClear: () => void
  matchedBookId: number | null
}) {
  const [results, setResults] = useState<BookSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Skip search when the title was just confirmed via a click — the matched
    // book id signals "this is exactly that DB book, no further search needed".
    if (matchedBookId != null) return
    if (title.trim().length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/admin/books/search?q=${encodeURIComponent(title)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (!cancelled) setResults((d.results ?? []) as BookSearchHit[]) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [title, matchedBookId])

  return (
    <div className="relative">
      <input
        value={title}
        onChange={e => { onTitleChange(e.target.value); onClear(); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className={inputCls}
      />
      {matchedBookId != null && (
        <p className="mt-1 text-[11px] text-green-700 dark:text-green-400">
          ✓ Matched to existing book #{matchedBookId} — link will be created.{' '}
          <button type="button" onClick={onClear} className="underline">unlink</button>
        </p>
      )}
      {open && matchedBookId == null && title.trim().length >= 2 && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 z-20 max-h-72 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onMatch(r); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-gray-500">
                {r.authors.length > 0 ? r.authors.join(', ') : '—'}
                {r.banCount > 0 ? ` · ${r.banCount} bans` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tiny inputs ─────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800'

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
