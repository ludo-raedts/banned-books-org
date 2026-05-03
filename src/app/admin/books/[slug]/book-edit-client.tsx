'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { BookEditData } from './page'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const textareaCls = `${inputCls} resize-y`

export default function BookEditClient({ book }: { book: BookEditData }) {
  const [title, setTitle] = useState(book.title)
  const [year, setYear] = useState(book.first_published_year?.toString() ?? '')
  const [genres, setGenres] = useState((book.genres ?? []).join(', '))
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? '')
  const [descriptionBook, setDescriptionBook] = useState(book.description_book ?? '')
  const [descriptionBan, setDescriptionBan] = useState(book.description_ban ?? '')
  const [censorshipContext, setCensorshipContext] = useState(book.censorship_context ?? '')
  const [aiDrafted, setAiDrafted] = useState(book.ai_drafted ?? false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setSaveState('saving')
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

        <Field label="Cover URL" hint="Paste a direct image URL — changes appear in the preview instantly">
          <div className="flex gap-4 items-start">
            <input
              type="url"
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              className={`${inputCls} flex-1`}
              placeholder="https://…"
            />
            <div className="shrink-0 w-[54px] h-[80px] rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {coverUrl ? (
                <Image src={coverUrl} alt="Cover preview" width={54} height={80} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full" />
              )}
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

        {/* Save button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
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
