'use client'

import { useState, useRef } from 'react'
import { ALLOWED_IMAGE_HOSTS } from '@/lib/allowed-image-hosts'
import { useAdminUi } from '../../admin-ui'
import { useUnsavedChanges } from '../../use-unsaved-changes'
import type { BookEditData } from './page'

type SaveState = 'idle' | 'saving'
type ImgStatus = 'idle' | 'loading' | 'loaded' | 'error'

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

function getHostname(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

const inputCls = 'px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const textareaCls = `${inputCls} resize-y`

// Mirrors DetectedScript in src/lib/imports/language-inference.ts — the values
// detectScript() can produce. Used to backfill title_native_script automatically.
const NATIVE_SCRIPTS = [
  'latin', 'cyrillic', 'greek', 'arabic', 'hebrew', 'han', 'hiragana', 'katakana',
  'hangul', 'devanagari', 'bengali', 'gurmukhi', 'gujarati', 'oriya', 'tamil',
  'telugu', 'kannada', 'malayalam', 'sinhala', 'thai', 'lao', 'tibetan', 'myanmar',
  'khmer', 'georgian', 'armenian', 'ethiopic', 'mixed',
] as const

export default function BookEditClient({ book }: { book: BookEditData }) {
  const [title, setTitle] = useState(book.title)
  const [titleNative, setTitleNative] = useState(book.title_native ?? '')
  const [titleNativeScript, setTitleNativeScript] = useState(book.title_native_script ?? '')
  const [titleTransliterated, setTitleTransliterated] = useState(book.title_transliterated ?? '')
  const [titleEnglish, setTitleEnglish] = useState(book.title_english_meaningful ?? '')
  const [year, setYear] = useState(book.first_published_year?.toString() ?? '')
  const [genres, setGenres] = useState((book.genres ?? []).join(', '))
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? '')
  const [imgStatus, setImgStatus] = useState<ImgStatus>(book.cover_url ? 'loading' : 'idle')
  const [descriptionBook, setDescriptionBook] = useState(book.description_book ?? '')
  const [descriptionBan, setDescriptionBan] = useState(book.description_ban ?? '')
  const [censorshipContext, setCensorshipContext] = useState(book.censorship_context ?? '')
  const [aiDrafted, setAiDrafted] = useState(book.ai_drafted ?? false)
  const [warningLevel, setWarningLevel] = useState<'none' | 'context' | 'extended'>(book.warning_level ?? 'none')
  const [inclusionRationale, setInclusionRationale] = useState(book.inclusion_rationale ?? '')
  const [extendedContext, setExtendedContext] = useState(book.extended_context ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [showHostWarning, setShowHostWarning] = useState(false)
  const [hostAdded, setHostAdded] = useState(false)
  const imgKey = useRef(0)
  const ui = useAdminUi()

  // On-request alternative-cover picker. Candidates come from
  // /api/admin/books/<slug>/cover-candidates (OL isbn/editions/search + Google
  // Books); clicking one just fills the cover field — the normal Save applies
  // it, and the PATCH route stamps cover_status='manual_override'.
  type CoverCandidate = { url: string; source: string }
  const [candidates, setCandidates] = useState<CoverCandidate[]>([])
  const [candState, setCandState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [brokenCands, setBrokenCands] = useState<Set<string>>(new Set())

  async function findCovers() {
    setCandState('loading')
    setBrokenCands(new Set())
    try {
      const res = await fetch(`/api/admin/books/${book.slug}/cover-candidates`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { candidates: CoverCandidate[] }
      setCandidates(j.candidates ?? [])
      setCandState('done')
    } catch {
      setCandState('error')
    }
  }

  const snapshot = JSON.stringify({
    title, titleNative, titleNativeScript, titleTransliterated, titleEnglish,
    year, genres, coverUrl, descriptionBook, descriptionBan, censorshipContext,
    aiDrafted, warningLevel, inclusionRationale, extendedContext,
  })
  const [baseline, setBaseline] = useState(snapshot)
  const dirty = snapshot !== baseline
  useUnsavedChanges(dirty)

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
    try {
      const body: Record<string, unknown> = {
        title,
        title_native: titleNative.trim() || null,
        title_native_script: titleNativeScript || null,
        title_transliterated: titleTransliterated.trim() || null,
        title_english_meaningful: titleEnglish.trim() || null,
        first_published_year: year ? parseInt(year) : null,
        genres: genres.split(',').map(g => g.trim()).filter(Boolean),
        cover_url: coverUrl || null,
        description_book: descriptionBook || null,
        description_ban: descriptionBan || null,
        censorship_context: censorshipContext || null,
        ai_drafted: aiDrafted,
        warning_level: warningLevel,
        inclusion_rationale: inclusionRationale.trim() || null,
        extended_context: warningLevel === 'extended' ? (extendedContext.trim() || null) : null,
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
      setBaseline(snapshot)
      setSaveState('idle')
      ui.toast('Saved', 'success')
    } catch (err) {
      setSaveState('idle')
      ui.toast(err instanceof Error ? err.message : 'Save failed', 'error')
    }
  }

  async function handleSaveAnyway() {
    // Add unknown hostname to allowed list
    if (hostname && !isAllowedHost) {
      try {
        const res = await fetch('/api/admin/books/add-image-host', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostname }),
        })
        // In production the allowlist is build-time only, so the route 400s;
        // only show the "added" banner when it actually succeeded.
        if (res.ok) setHostAdded(true)
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
      <div className="border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
        <Field label="Title" hint="The book's display title">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <div className="border-t border-gray-200 pt-5 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Multilingual title
          </h2>

          <Field
            label="Native title"
            hint="The title in its original language/script, e.g. «Архипелаг ГУЛАГ». Leave empty when it's the same as the title above. Shown as a secondary line on the public book page; powers a search-alias."
          >
            <input type="text" value={titleNative} onChange={e => setTitleNative(e.target.value)} className={inputCls} dir="auto" />
          </Field>

          <Field
            label="Native script"
            hint="Writing system of the native title. Normally auto-detected from the native title by the language-inference backfill — only set it by hand to override."
          >
            <select
              value={titleNativeScript}
              onChange={e => setTitleNativeScript(e.target.value)}
              className={`${inputCls} w-56`}
            >
              <option value="">— none / unknown —</option>
              {NATIVE_SCRIPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field
            label="Transliterated title"
            hint="Romanised form of a non-Latin native title, e.g. «Arkhipelag GULAG». Leave empty for Latin-script originals. Shown as a small italic line under the title on the public book page."
          >
            <input type="text" value={titleTransliterated} onChange={e => setTitleTransliterated(e.target.value)} className={inputCls} />
          </Field>

          <Field
            label="English meaning"
            hint="Literal English rendering when the title is non-English, e.g. «The Gulag Archipelago». Leave empty when the title above is already English. Shown as a secondary H2 on the public book page; powers a search-alias."
          >
            <input type="text" value={titleEnglish} onChange={e => setTitleEnglish(e.target.value)} className={inputCls} />
          </Field>
        </div>

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
                <p className="text-xs text-green-600">✓ Image loaded</p>
              )}
              {coverUrl && imgStatus === 'error' && (
                <p className="text-xs text-red-600">⚠ Image failed to load — this URL may not work on the site</p>
              )}
            </div>
            {/* Preview using plain <img> so any hostname works */}
            <div className={`shrink-0 w-[54px] h-[80px] rounded overflow-hidden border bg-gray-100 ${
              imgStatus === 'loaded' ? 'border-green-400' :
              imgStatus === 'error'  ? 'border-red-400' :
              'border-gray-200'
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

          {/* ── Alternative-cover picker ──────────────────────────────── */}
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <button
                type="button"
                onClick={findCovers}
                disabled={candState === 'loading'}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {candState === 'loading' ? 'Searching covers…' : 'Find alternative covers'}
              </button>
            </div>
            {candState === 'error' && (
              <p className="text-xs text-red-600">Cover search failed — try again.</p>
            )}
            {candState === 'done' && candidates.filter(c => !brokenCands.has(c.url)).length === 0 && (
              <p className="text-xs text-gray-500">No alternative covers found on OpenLibrary / Google Books.</p>
            )}
            {candidates.filter(c => !brokenCands.has(c.url)).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {candidates.filter(c => !brokenCands.has(c.url)).map(c => {
                  const selected = coverUrl === c.url
                  return (
                    <button
                      key={c.url}
                      type="button"
                      onClick={() => handleCoverUrlChange(c.url)}
                      title={`${c.source}\n${c.url}`}
                      className={`flex flex-col items-center gap-1 rounded-lg p-1.5 border transition-colors ${
                        selected
                          ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      }`}
                    >
                      <span className="block w-[72px] h-[106px] rounded overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.url}
                          alt={`Cover candidate (${c.source})`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={() => setBrokenCands(prev => new Set(prev).add(c.url))}
                        />
                      </span>
                      <span className="text-[10px] text-gray-500 max-w-[80px] truncate">
                        {selected ? '✓ selected' : c.source}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {candidates.some(c => coverUrl === c.url) && dirty && (
              <p className="text-xs text-gray-500">
                Click <span className="font-medium">Save</span> to apply — the pick is pinned as a manual override so enrichment won&apos;t replace it.
              </p>
            )}
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

        <div className="border-t border-gray-200 pt-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Editorial classification
            </h2>
            {!book.inclusion_rationale && warningLevel === 'none' && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                Unclassified
              </span>
            )}
          </div>

          <Field label="Warning level" hint="none = no editorial note · context = editorial note with essay links · extended = editorial note with full essay above the essay links">
            <select
              value={warningLevel}
              onChange={e => setWarningLevel(e.target.value as 'none' | 'context' | 'extended')}
              className={`${inputCls} w-48`}
            >
              <option value="none">none</option>
              <option value="context">context</option>
              <option value="extended">extended</option>
            </select>
          </Field>

          <Field
            label={
              <span className="flex items-center gap-2">
                Inclusion rationale
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                  Internal
                </span>
              </span>
            }
            hint="Internal note: why does this book meet our editorial criteria? Stored for our records — never shown publicly. Marks a book as classified."
          >
            <textarea
              rows={3}
              value={inclusionRationale}
              onChange={e => setInclusionRationale(e.target.value)}
              className={textareaCls}
            />
          </Field>

          {warningLevel === 'extended' && (
            <Field
              label={
                <span className="flex items-center gap-2">
                  Extended context
                  <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    Public
                  </span>
                </span>
              }
              hint="Markdown — the full contextual essay rendered on the public book page above the essay links. Required for extended-tier books."
            >
              <textarea
                rows={10}
                value={extendedContext}
                onChange={e => setExtendedContext(e.target.value)}
                className={`${textareaCls} font-mono text-xs`}
                placeholder="TODO — redactioneel essay nog te schrijven"
              />
              {!extendedContext.trim() && (
                <p className="text-xs text-amber-600">
                  ⚠ This book is marked <code>extended</code> but the contextual essay is empty.
                </p>
              )}
            </Field>
          )}

          {/* Public preview — what readers will see on /books/<slug> */}
          {warningLevel !== 'none' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 mb-2">
                Public preview — readers see this on the book page
              </p>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Editorial note
                </p>
                {warningLevel === 'extended' && extendedContext.trim() && (
                  <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">
                    {extendedContext.trim()}
                  </p>
                )}
                {warningLevel === 'extended' && !extendedContext.trim() && (
                  <p className="text-xs text-gray-400 italic mb-2">
                    (no extended context yet — only the essay links below will render)
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  On why we include works like this — see{' '}
                  <span className="underline">What we document — and why that is a choice</span>
                  {' '}and{' '}
                  <span className="underline">Why &ldquo;forbidden knowledge&rdquo; iceberg lists collapse important distinctions</span>.
                </p>
              </div>
            </div>
          )}
          {warningLevel === 'none' && (inclusionRationale.trim() || extendedContext.trim()) && (
            <p className="text-xs text-gray-400 italic">
              At <code>none</code> tier no public editorial note renders. The internal rationale stays in our records.
            </p>
          )}
        </div>

        <Field label="AI-drafted" hint="Check if this description was generated by AI and may need human review">
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={aiDrafted}
              onChange={e => setAiDrafted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-gray-700"
            />
            <span className="text-sm text-gray-600">Mark as AI-drafted</span>
          </label>
        </Field>

        {/* Unknown hostname warning */}
        {showHostWarning && hostname && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3">
            <p className="text-sm text-amber-800">
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
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Host added notice */}
        {hostAdded && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ✓ <strong>{hostname}</strong> added to <code>src/lib/allowed-image-hosts.ts</code> — remember to push to GitHub to apply the config change.
          </p>
        )}

        {/* Save button */}
        {!showHostWarning && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveClick}
              disabled={saveState === 'saving' || !dirty}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && saveState !== 'saving' && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
          </div>
        )}
      </div>

      {/* Read-only info */}
      <div className="border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Read-only info</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Slug</dt>
          <dd className="font-mono text-xs break-all">{book.slug}</dd>
          <dt className="text-gray-500">ISBN-13</dt>
          <dd className="font-mono text-xs">{book.isbn13 ?? '—'}</dd>
          <dt className="text-gray-500">OpenLibrary ID</dt>
          <dd className="font-mono text-xs">{book.openlibrary_work_id ?? '—'}</dd>
          <dt className="text-gray-500">Bans</dt>
          <dd>{book.ban_count}</dd>
          <dt className="text-gray-500">Countries</dt>
          <dd className="text-xs">{book.ban_countries || '—'}</dd>
        </dl>
      </div>
    </div>
  )
}
