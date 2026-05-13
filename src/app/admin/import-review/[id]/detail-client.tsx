'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLAG_BADGE_CLASS, FLAG_TOOLTIPS, STATUS_BADGE_CLASS } from '../flag-styles'

type QueueStatus = 'pending_review' | 'approved' | 'rejected' | 'deferred'
type ActionType = 'banned' | 'restricted' | 'challenged'
type BanStatus = 'active' | 'historical'

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
  reason_suggestion: { slug: string | null; confidence: string } | null
  section_defaults: {
    action_type: ActionType
    scope_slug: string
    ban_status: BanStatus
  } | null
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
  const [originalLanguage, setOriginalLanguage] = useState('')
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

  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'defer'>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const showModel3Fields =
    data.quality_flags.includes('model_3_review_needed') ||
    !!data.parsed.title_native ||
    !!data.parsed.title_english_meaningful

  const isPossibleDuplicate = data.dedup?.kind === 'possible_duplicate'

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
            {data.dedup && data.duplicate_book && (
              <DupCallout
                kind={data.dedup.kind}
                similarity={data.dedup.similarity}
                book={data.duplicate_book}
              />
            )}
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
                hint="ISO 639-1 two-letter code (en, fr, ru, zh…)"
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
              {isPossibleDuplicate && (
                <button
                  disabled
                  title="Merging into an existing book is not yet implemented. Use the form above to commit as a new book, or Reject to skip."
                  className="px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-medium opacity-50 cursor-not-allowed"
                >
                  Merge into existing (not yet)
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

function DupCallout({
  kind,
  similarity,
  book,
}: {
  kind: string
  similarity: number | null
  book: { slug: string; title: string; first_published_year: number | null }
}) {
  const label = kind === 'possible_duplicate' ? 'Possible duplicate' : 'Duplicate'
  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 text-xs">
      <p className="font-medium text-amber-800 dark:text-amber-300">
        {label}
        {similarity !== null && ` (sim ${similarity.toFixed(2)})`}
      </p>
      <p className="mt-1 text-amber-800 dark:text-amber-300">
        Matches existing book:{' '}
        <a
          href={`/admin/books/${book.slug}`}
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {book.title}
        </a>
        {book.first_published_year !== null && ` (${book.first_published_year})`}
      </p>
    </div>
  )
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
