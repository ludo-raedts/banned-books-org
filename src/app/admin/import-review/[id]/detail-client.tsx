'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLAG_BADGE_CLASS, FLAG_TOOLTIPS, STATUS_BADGE_CLASS } from '../flag-styles'

type QueueStatus = 'pending_review' | 'approved' | 'rejected' | 'deferred'
type ActionType = 'banned' | 'restricted' | 'challenged'
type BanStatus = 'active' | 'historical'

export type DuplicateBookFull = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  first_published_year: number | null
  isbn13: string | null
  cover_url: string | null
  description: string | null
  description_book: string | null
  ai_drafted: boolean | null
  genres: string[]
  authors: Array<{ display_name: string; slug: string }>
  existing_bans: Array<{
    id: number
    country_code: string
    year_started: number | null
    year_ended: number | null
    action_type: string
    status: string
    region: string | null
    institution: string | null
    description: string | null
    scope_slug: string | null
    scope_label: string | null
    sources: Array<{ name: string; url: string }>
  }>
  slug_aliases: Array<{ slug: string; source: string; created_at: string }>
}

export type DetailViewData = {
  id: number
  source_slug: string
  source_url: string | null
  status: QueueStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  page: string | null
  revid: number | null
  section_anchor: string
  parsed: {
    title: string
    title_native: string | null
    title_english_meaningful: string | null
    authors: string[]
    year: number | null
    state: string | null
    notes_raw: string
  }
  quality_flags: string[]
  dedup: { kind: string; book_id: number | null; similarity: number | null } | null
  duplicate_book: { slug: string; title: string; first_published_year: number | null } | null
  duplicate_book_full: DuplicateBookFull | null
  reason_suggestion: { slug: string | null; confidence: string } | null
  section_defaults: {
    action_type: ActionType
    scope_slug: string
    ban_status: BanStatus
  } | null
  // Auto-suggested via Unicode-block detection on parsed.title_native + the
  // source country. Optional so the server loader can add this field in a
  // separate change without breaking this type contract (it lands together
  // with the inferScriptAndLanguage helper in page.tsx).
  language_suggestion?: { language: string; script: string | null } | null
  approved_book_id: number | null
}

type SlugLabel = { slug: string; label_en: string }

type Props = {
  data: DetailViewData
  reasons: SlugLabel[]
  scopes: SlugLabel[]
}

const inputCls =
  'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-full'

const textareaCls = `${inputCls} resize-y`

export default function DetailClient({ data, reasons, scopes }: Props) {
  const router = useRouter()
  const isPending = data.status === 'pending_review' || data.status === 'deferred'

  // Default the form to what auto-approve would have written if it could.
  const [title, setTitle] = useState(data.parsed.title)
  const [titleNative, setTitleNative] = useState(data.parsed.title_native ?? '')
  const [titleEnglish, setTitleEnglish] = useState(data.parsed.title_english_meaningful ?? '')
  const [originalLanguage, setOriginalLanguage] = useState(
    data.language_suggestion?.language ?? '',
  )
  const [authors, setAuthors] = useState<string[]>(
    data.parsed.authors.length > 0 ? data.parsed.authors : [''],
  )
  const [year, setYear] = useState<string>(
    data.parsed.year !== null ? String(data.parsed.year) : '',
  )
  const [firstPublishedYear, setFirstPublishedYear] = useState<string>('')
  const [reasonSlug, setReasonSlug] = useState<string>(data.reason_suggestion?.slug ?? '')
  const [actionType, setActionType] = useState<ActionType>(
    data.section_defaults?.action_type ?? 'banned',
  )
  const [scopeSlug, setScopeSlug] = useState<string>(
    data.section_defaults?.scope_slug ?? '',
  )
  const [banStatus, setBanStatus] = useState<BanStatus>(
    data.section_defaults?.ban_status ?? 'historical',
  )
  const [descriptionBook, setDescriptionBook] = useState('')
  const [descriptionBan, setDescriptionBan] = useState(buildDefaultBanDescription(data.parsed))
  const [inclusionRationale, setInclusionRationale] = useState(buildDefaultRationale(data))

  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'defer' | 'merge'>(null)
  const [error, setError] = useState<string | null>(null)
  const [mergeResult, setMergeResult] = useState<null | {
    book_id: number
    ban_id: number
    ban_created: boolean
    enriched_fields: string[]
    aliases_added: string[]
  }>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const showModel3Fields =
    data.quality_flags.includes('model_3_review_needed') ||
    !!data.parsed.title_native ||
    !!data.parsed.title_english_meaningful

  const canMerge = !!data.duplicate_book_full
  const mergeTarget = data.duplicate_book_full

  function setAuthorAt(idx: number, value: string) {
    setAuthors(prev => prev.map((a, i) => (i === idx ? value : a)))
  }
  function addAuthor() {
    setAuthors(prev => [...prev, ''])
  }
  function removeAuthor(idx: number) {
    setAuthors(prev => prev.filter((_, i) => i !== idx))
  }

  async function callAction(
    action: 'approve' | 'reject' | 'defer',
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/admin/import-review/${data.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleApprove() {
    const yearNum = year.trim() ? parseInt(year.trim(), 10) : null
    if (yearNum === null || !Number.isFinite(yearNum)) {
      setError('Year is required.')
      return
    }
    const cleanAuthors = authors.map(a => a.trim()).filter(Boolean)
    if (cleanAuthors.length === 0) {
      setError('At least one author is required.')
      return
    }
    if (!reasonSlug) {
      setError('Reason is required.')
      return
    }
    if (!scopeSlug) {
      setError('Scope is required.')
      return
    }
    if (!inclusionRationale.trim()) {
      setError('Inclusion rationale is required.')
      return
    }
    const fpy = firstPublishedYear.trim()
      ? parseInt(firstPublishedYear.trim(), 10)
      : null

    const ok = await callAction('approve', {
      title: title.trim(),
      title_native: titleNative.trim() || null,
      title_english_meaningful: titleEnglish.trim() || null,
      original_language: originalLanguage.trim() || null,
      authors: cleanAuthors,
      year: yearNum,
      first_published_year: fpy,
      reason_slug: reasonSlug,
      action_type: actionType,
      scope_slug: scopeSlug,
      ban_status: banStatus,
      description_book: descriptionBook.trim() || null,
      description_ban: descriptionBan.trim() || null,
      inclusion_rationale: inclusionRationale.trim(),
    })
    if (ok) router.push('/admin/import-review')
  }

  async function handleReject() {
    const ok = await callAction('reject', {
      reason: rejectReason.trim() || null,
    })
    if (ok) {
      setRejectModal(false)
      router.push('/admin/import-review')
    }
  }

  async function handleDefer() {
    const ok = await callAction('defer', {})
    if (ok) router.push('/admin/import-review')
  }

  async function handleMerge() {
    if (!mergeTarget) {
      setError('No existing book to merge into.')
      return
    }
    const yearNum = year.trim() ? parseInt(year.trim(), 10) : null
    if (yearNum === null || !Number.isFinite(yearNum)) {
      setError('Year is required.')
      return
    }
    const cleanAuthors = authors.map(a => a.trim()).filter(Boolean)
    if (cleanAuthors.length === 0) {
      setError('At least one author is required (form validation only — existing book authors are kept).')
      return
    }
    if (!reasonSlug) {
      setError('Reason is required.')
      return
    }
    if (!scopeSlug) {
      setError('Scope is required.')
      return
    }
    if (!inclusionRationale.trim()) {
      setError('Inclusion rationale is required.')
      return
    }
    const fpy = firstPublishedYear.trim()
      ? parseInt(firstPublishedYear.trim(), 10)
      : null

    setBusy('merge')
    setError(null)
    try {
      const res = await fetch(`/api/admin/import-review/${data.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_book_id: mergeTarget.id,
          title: title.trim(),
          title_native: titleNative.trim() || null,
          title_english_meaningful: titleEnglish.trim() || null,
          original_language: originalLanguage.trim() || null,
          authors: cleanAuthors,
          year: yearNum,
          first_published_year: fpy,
          reason_slug: reasonSlug,
          action_type: actionType,
          scope_slug: scopeSlug,
          ban_status: banStatus,
          description_book: descriptionBook.trim() || null,
          description_ban: descriptionBan.trim() || null,
          inclusion_rationale: inclusionRationale.trim(),
        }),
      })
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error((j.error as string) ?? `HTTP ${res.status}`)
      }
      setMergeResult({
        book_id: j.book_id as number,
        ban_id: j.ban_id as number,
        ban_created: j.ban_created as boolean,
        enriched_fields: (j.enriched_fields as string[]) ?? [],
        aliases_added: (j.aliases_added as string[]) ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-baseline gap-3 mb-2">
        <h1 className="text-2xl font-bold leading-tight">
          {data.parsed.title || <em className="text-gray-400">(no title)</em>}
        </h1>
        <span className="text-sm px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {data.source_slug}
        </span>
        <span className={`text-sm px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[data.status]}`}>
          {data.status.replace('_', ' ')}
        </span>
        <a
          href={googleSearchUrl(data.parsed.title, data.parsed.authors)}
          target="_blank"
          rel="noopener noreferrer"
          title="Search Google for this title and author (opens new tab)"
          className="text-sm px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Google ↗
        </a>
      </header>

      {isPending && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          <span className="uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-2">Step 2 of 4</span>
          The fields below are what two LLMs extracted from the source — not enriched content. Confirm the metadata
          and approve to commit; covers, descriptions and reason classifications are filled by{' '}
          <a href="/admin/scripts#after-approval" className="font-mono text-[11px] underline hover:no-underline">enrich-all.ts</a>{' '}
          afterward.
        </p>
      )}

      {data.duplicate_book_full && (
        <ExistingBookPanel
          book={data.duplicate_book_full}
          dedupKind={data.dedup?.kind ?? null}
          similarity={data.dedup?.similarity ?? null}
          parsed={data.parsed}
        />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: parsed data (read-only) */}
        <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-900/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            As parsed
          </h2>
          <ReadOnlyField label="Title">{data.parsed.title || '—'}</ReadOnlyField>
          {data.parsed.title_native && (
            <ReadOnlyField label="Title (native)">{data.parsed.title_native}</ReadOnlyField>
          )}
          {data.parsed.title_english_meaningful && (
            <ReadOnlyField label="Title (English)">
              {data.parsed.title_english_meaningful}
            </ReadOnlyField>
          )}
          <ReadOnlyField label="Authors">
            {data.parsed.authors.length > 0 ? data.parsed.authors.join(', ') : '—'}
          </ReadOnlyField>
          <ReadOnlyField label="Year">
            {data.parsed.year ?? '—'}
          </ReadOnlyField>
          <ReadOnlyField label="Section">
            {data.section_anchor || '—'}
            {data.parsed.state && (
              <span className="text-gray-500 dark:text-gray-400"> · {data.parsed.state}</span>
            )}
          </ReadOnlyField>
          <ReadOnlyField label="Notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {data.parsed.notes_raw || '—'}
            </p>
          </ReadOnlyField>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {data.quality_flags.length === 0 ? (
                <span className="text-xs text-gray-400 dark:text-gray-500">No quality flags</span>
              ) : (
                data.quality_flags.map(f => (
                  <span
                    key={f}
                    title={FLAG_TOOLTIPS[f] ?? f}
                    className={`inline-block px-1.5 py-0.5 rounded text-xs ${FLAG_BADGE_CLASS[f] ?? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                  >
                    {f}
                  </span>
                ))
              )}
            </div>
            {data.source_url && (
              <p className="text-xs">
                <a
                  href={data.source_url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {data.source_url}
                </a>
              </p>
            )}
            {/* Detailed candidate-book panel renders above the two-column grid
                via ExistingBookPanel; no duplicate callout needed here. */}
          </div>
        </section>

        {/* Right: editable form */}
        <section className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Edit & commit
          </h2>

          <FormField label="Title" required>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              disabled={!isPending}
            />
          </FormField>

          {showModel3Fields && (
            <>
              <FormField
                label="Title (native script)"
                hint="Original-language title, e.g. Архипелаг ГУЛАГ"
              >
                <input
                  type="text"
                  value={titleNative}
                  onChange={e => setTitleNative(e.target.value)}
                  className={inputCls}
                  disabled={!isPending}
                />
              </FormField>

              <FormField
                label="Title (English meaning)"
                hint="Literal English meaning when title is non-English"
              >
                <input
                  type="text"
                  value={titleEnglish}
                  onChange={e => setTitleEnglish(e.target.value)}
                  className={inputCls}
                  disabled={!isPending}
                />
              </FormField>

              <FormField
                label="Original language"
                hint={
                  data.language_suggestion
                    ? `ISO 639-1 two-letter code. Auto-filled from ${
                        data.language_suggestion.script ?? 'script'
                      } + source country — overwrite if wrong.`
                    : 'ISO 639-1 two-letter code (en, fr, ru, zh…)'
                }
              >
                <input
                  type="text"
                  value={originalLanguage}
                  onChange={e => setOriginalLanguage(e.target.value)}
                  className={`${inputCls} max-w-[8rem]`}
                  maxLength={2}
                  disabled={!isPending}
                />
              </FormField>
            </>
          )}

          <FormField label="Authors" required>
            <div className="flex flex-col gap-1.5">
              {authors.map((a, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    type="text"
                    value={a}
                    onChange={e => setAuthorAt(i, e.target.value)}
                    className={inputCls}
                    disabled={!isPending}
                  />
                  {isPending && authors.length > 1 && (
                    <button
                      onClick={() => removeAuthor(i)}
                      className="px-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="Remove author"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {isPending && (
                <button
                  onClick={addAuthor}
                  className="self-start px-2 py-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  + Add author
                </button>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year (of ban)" required>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                className={inputCls}
                disabled={!isPending}
              />
            </FormField>
            <FormField label="First published" hint="Optional">
              <input
                type="number"
                value={firstPublishedYear}
                onChange={e => setFirstPublishedYear(e.target.value)}
                className={inputCls}
                disabled={!isPending}
              />
            </FormField>
          </div>

          <FormField label="Reason" required>
            <select
              value={reasonSlug}
              onChange={e => setReasonSlug(e.target.value)}
              className={inputCls}
              disabled={!isPending}
            >
              <option value="">Select reason…</option>
              {reasons.map(r => (
                <option key={r.slug} value={r.slug}>
                  {r.label_en} ({r.slug})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Action type" required>
              <select
                value={actionType}
                onChange={e => setActionType(e.target.value as ActionType)}
                className={inputCls}
                disabled={!isPending}
              >
                <option value="banned">banned</option>
                <option value="restricted">restricted</option>
                <option value="challenged">challenged</option>
              </select>
            </FormField>
            <FormField label="Ban status" required>
              <select
                value={banStatus}
                onChange={e => setBanStatus(e.target.value as BanStatus)}
                className={inputCls}
                disabled={!isPending}
              >
                <option value="historical">historical</option>
                <option value="active">active</option>
              </select>
            </FormField>
          </div>

          <FormField label="Scope" required>
            <select
              value={scopeSlug}
              onChange={e => setScopeSlug(e.target.value)}
              className={inputCls}
              disabled={!isPending}
            >
              <option value="">Select scope…</option>
              {scopes.map(s => (
                <option key={s.slug} value={s.slug}>
                  {s.label_en} ({s.slug})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Book description" hint="Optional. Plain text or markdown.">
            <textarea
              value={descriptionBook}
              onChange={e => setDescriptionBook(e.target.value)}
              rows={3}
              className={textareaCls}
              disabled={!isPending}
            />
          </FormField>

          <FormField label="Ban description" hint="Optional. Prefilled from Wikipedia notes.">
            <textarea
              value={descriptionBan}
              onChange={e => setDescriptionBan(e.target.value)}
              rows={4}
              className={textareaCls}
              disabled={!isPending}
            />
          </FormField>

          <FormField label="Inclusion rationale" required>
            <input
              type="text"
              value={inclusionRationale}
              onChange={e => setInclusionRationale(e.target.value)}
              className={inputCls}
              disabled={!isPending}
            />
          </FormField>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {isPending && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleApprove}
                disabled={!!busy}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
              >
                {busy === 'approve' ? 'Committing…' : 'Approve & commit'}
              </button>
              <button
                onClick={() => setRejectModal(true)}
                disabled={!!busy}
                className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
              >
                Reject
              </button>
              <button
                onClick={handleDefer}
                disabled={!!busy}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {busy === 'defer' ? 'Deferring…' : 'Defer for later'}
              </button>
              {canMerge && mergeTarget && (
                <button
                  onClick={handleMerge}
                  disabled={!!busy}
                  title={`Enrich existing book #${mergeTarget.id} ("${mergeTarget.title}") with any empty fields, add this row's data as a new ban, and mark this queue row approved. Existing fields are NEVER overwritten.`}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {busy === 'merge' ? 'Merging…' : `Merge into #${mergeTarget.id}`}
                </button>
              )}
            </div>
          )}

          {!isPending && data.approved_book_id && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 space-y-2">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Approved to{' '}
                <a
                  href={`/admin/books/${data.approved_book_id}`}
                  className="font-medium underline"
                >
                  book #{data.approved_book_id}
                </a>
                {data.reviewed_at && ` on ${formatDate(data.reviewed_at)}`}
                {data.reviewed_by && ` by ${data.reviewed_by}`}.
              </p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                <strong>Next step:</strong> the book has no cover, description, ban context, or reason classification
                yet. Run{' '}
                <a href="/admin/scripts#after-approval" className="font-mono underline hover:no-underline">
                  enrich-all.ts
                </a>{' '}
                to fill those fields.
              </p>
            </div>
          )}

          {mergeResult && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 space-y-2">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Merged into{' '}
                <a
                  href={`/admin/books/${mergeResult.book_id}`}
                  className="font-medium underline"
                >
                  book #{mergeResult.book_id}
                </a>
                {' · '}
                {mergeResult.ban_created
                  ? <>new ban <code className="font-mono text-xs">#{mergeResult.ban_id}</code> added</>
                  : <>existing ban <code className="font-mono text-xs">#{mergeResult.ban_id}</code> reused (idempotent)</>}.
              </p>
              {mergeResult.enriched_fields.length > 0 && (
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  Enriched empty fields: {mergeResult.enriched_fields.join(', ')}.
                </p>
              )}
              {mergeResult.aliases_added.length > 0 && (
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  Added slug aliases:{' '}
                  {mergeResult.aliases_added.map((s, i) => (
                    <span key={s}>
                      <code className="font-mono text-[11px]">/books/{s}</code>
                      {i < mergeResult.aliases_added.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-xs">
                <button
                  onClick={() => router.push('/admin/import-review')}
                  className="underline text-amber-900 dark:text-amber-200 hover:no-underline"
                >
                  ← Back to review queue
                </button>
              </p>
            </div>
          )}
        </section>
      </div>

      {rejectModal && (
        <RejectModal
          reason={rejectReason}
          setReason={setRejectReason}
          busy={busy === 'reject'}
          onCancel={() => setRejectModal(false)}
          onConfirm={handleReject}
        />
      )}
    </div>
  )
}

function googleSearchUrl(title: string, authors: string[]): string {
  const parts: string[] = []
  const trimmedTitle = title?.trim() ?? ''
  if (trimmedTitle) parts.push(`"${trimmedTitle}"`)
  for (const a of authors) {
    const t = a?.trim()
    if (t) parts.push(t)
  }
  const query = parts.join(' ').trim() || 'banned book'
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function buildDefaultBanDescription(parsed: DetailViewData['parsed']): string {
  const prefix = parsed.state ? `State: ${parsed.state}. ` : ''
  return `${prefix}${parsed.notes_raw ?? ''}`.trim()
}

function buildDefaultRationale(data: DetailViewData): string {
  if (data.page && data.revid !== null) {
    return `Wikipedia bulk import: ${data.page} rev ${data.revid} (manual review)`
  }
  return `Manual import review from ${data.source_slug}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <div className="text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  )
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

function ExistingBookPanel({
  book,
  dedupKind,
  similarity,
  parsed,
}: {
  book: DuplicateBookFull
  dedupKind: string | null
  similarity: number | null
  parsed: DetailViewData['parsed']
}) {
  const kindLabel =
    dedupKind === 'duplicate'
      ? 'Confirmed duplicate'
      : dedupKind === 'possible_duplicate'
        ? 'Possible duplicate'
        : 'Existing match'
  const tone =
    dedupKind === 'duplicate'
      ? 'border-emerald-300 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20'
      : 'border-amber-300 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20'

  // Banner-level summary of what's already in the DB for this book, so the
  // editor can see at a glance whether THIS row would create a new ban
  // (different country/year/scope) or be a true no-op duplicate.
  const banCountriesSummary =
    book.existing_bans.length === 0
      ? 'no bans yet'
      : `${book.existing_bans.length} ban${book.existing_bans.length === 1 ? '' : 's'} in ` +
        [...new Set(book.existing_bans.map(b => b.country_code))].join(', ')

  // Year-suffix-aware title comparison: highlight whether the parsed title
  // would auto-add-ban via slug-collision (titles look identical modulo
  // common Wikipedia disambiguator suffixes) or whether it's a softer match.
  const parsedTitleNorm = normalizeTitleClientSide(parsed.title)
  const existingTitleNorm = normalizeTitleClientSide(book.title)
  const titlesIdentical =
    parsedTitleNorm.toLowerCase() === existingTitleNorm.toLowerCase()

  return (
    <section
      className={`mb-6 border rounded-xl ${tone} overflow-hidden`}
      aria-label="Existing book candidate"
    >
      <header className="flex flex-wrap items-baseline gap-3 px-5 py-3 border-b border-current/10">
        <span className="text-xs font-semibold uppercase tracking-widest">
          {kindLabel}
        </span>
        {similarity !== null && (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            similarity {similarity.toFixed(2)}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {banCountriesSummary}
        </span>
        {titlesIdentical && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
            Titles match after normalization
          </span>
        )}
      </header>

      <div className="grid md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1.2fr)] gap-5 p-5">
        {/* Cover */}
        <div className="flex flex-col items-start gap-2">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              className="w-[140px] h-[210px] object-cover rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            />
          ) : (
            <div className="w-[140px] h-[210px] flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400">
              no cover
            </div>
          )}
          <a
            href={`/books/${book.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-gray-600 dark:text-gray-400 hover:no-underline"
          >
            View public page ↗
          </a>
          <a
            href={`/admin/books/${book.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-gray-600 dark:text-gray-400 hover:no-underline"
          >
            Edit in admin ↗
          </a>
        </div>

        {/* Book facts */}
        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Title
            </div>
            <div className="text-base font-semibold leading-tight break-words">
              {book.title}
            </div>
            {book.title_native && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span className="text-[10px] uppercase tracking-wide mr-1">native</span>
                {book.title_native}
              </div>
            )}
            {book.title_transliterated && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-[10px] uppercase tracking-wide mr-1">translit</span>
                {book.title_transliterated}
              </div>
            )}
            {book.title_english_meaningful && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-[10px] uppercase tracking-wide mr-1">english</span>
                {book.title_english_meaningful}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Authors
              </div>
              <div>
                {book.authors.length === 0
                  ? <em className="text-gray-400">—</em>
                  : book.authors.map(a => a.display_name).join(', ')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                First published
              </div>
              <div>{book.first_published_year ?? <em className="text-gray-400">—</em>}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Language
              </div>
              <div>{book.original_language ?? <em className="text-gray-400">—</em>}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                ISBN-13
              </div>
              <div className="font-mono text-xs">
                {book.isbn13 ?? <em className="text-gray-400">—</em>}
              </div>
            </div>
          </div>

          {book.genres.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                Genres
              </div>
              <div className="flex flex-wrap gap-1">
                {book.genres.map(g => (
                  <span
                    key={g}
                    className="text-xs px-1.5 py-0.5 rounded bg-white/60 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(book.description_book ?? book.description) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Description {book.ai_drafted ? <em>(AI-drafted)</em> : null}
              </summary>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
                {book.description_book ?? book.description}
              </p>
            </details>
          )}

          {book.slug_aliases.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                {book.slug_aliases.length} slug alias{book.slug_aliases.length === 1 ? '' : 'es'}
              </summary>
              <ul className="mt-1 space-y-0.5">
                {book.slug_aliases.map(a => (
                  <li key={a.slug} className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                    /books/{a.slug}{' '}
                    <span className="text-gray-400 dark:text-gray-500">[{a.source}]</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Existing bans */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Existing bans on this book
          </div>
          {book.existing_bans.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No bans recorded yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {book.existing_bans.map(b => (
                <li
                  key={b.id}
                  className="text-xs rounded border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 px-2 py-1.5"
                >
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold">{b.country_code}</span>
                    <span className="text-gray-500 dark:text-gray-400">·</span>
                    <span>
                      {b.year_started ?? '?'}
                      {b.year_ended ? `–${b.year_ended}` : ''}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">·</span>
                    <span>{b.action_type}</span>
                    {b.scope_slug && (
                      <>
                        <span className="text-gray-500 dark:text-gray-400">·</span>
                        <span>{b.scope_label ?? b.scope_slug}</span>
                      </>
                    )}
                    <span
                      className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                        b.status === 'active'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  {(b.region || b.institution) && (
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {[b.region, b.institution].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {b.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      {b.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-blue-600 dark:text-blue-400 truncate max-w-[200px]"
                          title={s.name}
                        >
                          {s.name}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

// Mirror of the server's normalizeTitleForDedup, kept inline so the panel
// can flag "titles match after normalization" without an extra round-trip.
// If the regex / suffix list diverges, the badge is purely informational so
// drift is non-fatal — the actual dedup decision lives on the queue row.
function normalizeTitleClientSide(title: string): string {
  const KNOWN_SUFFIXES = new Set(['series', 'novel', 'book', 'novella'])
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!m) return title.trim()
  const head = m[1].trim()
  const inside = m[2].trim().toLowerCase()
  if (/^\d{4}$/.test(inside) || KNOWN_SUFFIXES.has(inside)) return head
  return title.trim()
}

function RejectModal({
  reason,
  setReason,
  busy,
  onCancel,
  onConfirm,
}: {
  reason: string
  setReason: (val: string) => void
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">Reject this row</h3>
        </div>
        <div className="p-5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder='e.g. "Out of inclusion criteria"'
            className={`${inputCls} resize-y mt-1`}
          />
        </div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
