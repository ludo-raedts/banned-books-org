'use client'

import { useState, useRef } from 'react'
import { ALLOWED_IMAGE_HOSTS } from '@/lib/allowed-image-hosts'
import type { BookEditData } from './page'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ImgStatus = 'idle' | 'loading' | 'loaded' | 'error'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

function getHostname(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

const inputCls = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const textareaCls = `${inputCls} resize-y`

export default function BookEditClient({ book }: { book: BookEditData }) {
  const [title, setTitle] = useState(book.title)
  const [year, setYear] = useState(book.first_published_year?.toString() ?? '')
  const [genres, setGenres] = useState((book.genres ?? []).join(', '))
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? '')
  const [imgStatus, setImgStatus] = useState<ImgStatus>(book.cover_url ? 'loading' : 'idle')
  const [descriptionBook, setDescriptionBook] = useState(book.description_book ?? '')
  const [descriptionBan, setDescriptionBan] = useState(book.description_ban ?? '')
  const [censorshipContext, setCensorshipContext] = useState(book.censorship_context ?? '')
  const [aiDrafted, setAiDrafted] = useState(book.ai_drafted ?? false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showHostWarning, setShowHostWarning] = useState(false)
  const [hostAdded, setHostAdded] = useState(false)
  const imgKey = useRef(0)

  function handleCoverUrlChange(val: string) {
    setCoverUrl(val)
    setImgStatus(val ? 'loading' : 'idle')
    imgKey.current += 1
  }

  const hostname = coverUrl ? getHostname(coverUrl) : null
  const isAllowedHost = hostname ? ALLOWED_IMAGE_HOSTS.includes(hostname) : true

  async function performSave() {
    setSaveState('saving')
    setShowHostWarning(false)
    setErrorMsg('')
    try {
      const body: Record<string, unknown> = {
        title,
        first_published_year: year ? parseInt(year) : null,
        genres: genres.split(',').map(g => g.trim()).filter(Boolean),
        cover_url: coverUrl || null,
        description_book: descriptionBook || null,
        description_ban: descriptionBan || null,
        censorship_context: censorshipContext || null,
        ai_drafted: aiDrafted,
      }
      const res = await fetch(`/api/admin/books/${book.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setSaveState('error')
    }
  }

  async function handleSaveAnyway() {
    // Add unknown hostname to allowed list
    if (hostname && !isAllowedHost) {
      try {
        await fetch('/api/admin/books/add-image-host', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostname }),
        })
        setHostAdded(true)
      } catch {
        // non-fatal — DB save still proceeds
      }
    }
    await performSave()
  }

  function handleSaveClick() {
    if (coverUrl && !isAllowedHost) {
      setShowHostWarning(true)
    } else {
      performSave()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Edit form */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-5">
        <Field label="Title" hint="The book's display title">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <Field label="First published year" hint="4-digit year of first publication">
          <input type="number" value={year} onChange={e => setYear(e.target.value)} min={1000} max={2099} className={`${inputCls} w-32`} />
        </Field>

        <Field label="Genres" hint="Comma-separated slugs, e.g. young-adult, literary-fiction">
          <input type="text" value={genres} onChange={e => setGenres(e.target.value)} className={inputCls} placeholder="young-adult, literary-fiction" />
        </Field>

        <Field label="Cover URL" hint="Paste a direct image URL — preview updates immediately">
          <div className="flex gap-4 items-start">
            <div className="flex-1 flex flex-col gap-1.5">
              <input
                type="url"
                value={coverUrl}
                onChange={e => handleCoverUrlChange(e.target.value)}
                className={inputCls}
                placeholder="https://…"
              />
              {coverUrl && imgStatus === 'loaded' && (
                <p className="text-xs text-green-600 dark:text-green-400">✓ Image loaded</p>
              )}
              {coverUrl && imgStatus === 'error' && (
                <p className="text-xs text-red-600 dark:text-red-400">⚠ Image failed to load — this URL may not work on the site</p>
              )}
            </div>
            {/* Preview using plain <img> so any hostname works */}
            <div className={`shrink-0 w-[54px] h-[80px] rounded overflow-hidden border bg-gray-100 dark:bg-gray-800 ${
              imgStatus === 'loaded' ? 'border-green-400 dark:border-green-600' :
              imgStatus === 'error'  ? 'border-red-400 dark:border-red-600' :
              'border-gray-200 dark:border-gray-700'
            }`}>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={imgKey.current}
                  src={coverUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onLoad={() => setImgStatus('loaded')}
                  onError={() => setImgStatus('error')}
                />
              ) : null}
            </div>
          </div>
        </Field>

        <Field label="Book description" hint="Public-facing synopsis of the book's content (shown on the book page)">
          <textarea rows={6} value={descriptionBook} onChange={e => setDescriptionBook(e.target.value)} className={textareaCls} />
        </Field>

        <Field label="Ban description" hint="Description of why the book was banned or challenged">
          <textarea rows={6} value={descriptionBan} onChange={e => setDescriptionBan(e.target.value)} className={textareaCls} />
        </Field>

        <Field label="Censorship context" hint="Broader political or historical context explaining the ban">
          <textarea rows={8} value={censorshipContext} onChange={e => setCensorshipContext(e.target.value)} className={textareaCls} />
        </Field>

        <Field label="AI-drafted" hint="Check if this description was generated by AI and may need human review">
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={aiDrafted}
              onChange={e => setAiDrafted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Mark as AI-drafted</span>
          </label>
        </Field>

        {/* Unknown hostname warning */}
        {showHostWarning && hostname && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col gap-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              ⚠ <strong>{hostname}</strong> is not in the Next.js image allowlist. The cover may not display correctly on the site.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAnyway}
                disabled={saveState === 'saving'}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                Save anyway
              </button>
              <button
                onClick={() => setShowHostWarning(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Host added notice */}
        {hostAdded && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
            ✓ <strong>{hostname}</strong> added to <code>src/lib/allowed-image-hosts.ts</code> — remember to push to GitHub to apply the config change.
          </p>
        )}

        {/* Save button */}
        {!showHostWarning && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveClick}
              disabled={saveState === 'saving'}
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {saveState === 'saved' && (
              <span className="text-sm text-green-600 dark:text-green-400">Saved ✓</span>
            )}
            {saveState === 'error' && (
              <span className="text-sm text-red-600 dark:text-red-400">{errorMsg}</span>
            )}
          </div>
        )}
      </div>

      {/* Read-only info */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Read-only info</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">Slug</dt>
          <dd className="font-mono text-xs break-all">{book.slug}</dd>
          <dt className="text-gray-500 dark:text-gray-400">ISBN-13</dt>
          <dd className="font-mono text-xs">{book.isbn13 ?? '—'}</dd>
          <dt className="text-gray-500 dark:text-gray-400">OpenLibrary ID</dt>
          <dd className="font-mono text-xs">{book.openlibrary_work_id ?? '—'}</dd>
          <dt className="text-gray-500 dark:text-gray-400">Bans</dt>
          <dd>{book.ban_count}</dd>
          <dt className="text-gray-500 dark:text-gray-400">Countries</dt>
          <dd className="text-xs">{book.ban_countries || '—'}</dd>
        </dl>
      </div>
    </div>
  )
}
