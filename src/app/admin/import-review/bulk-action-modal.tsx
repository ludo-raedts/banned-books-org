'use client'

import { useState } from 'react'
import type { SlugLabel } from './list-client'

type Props = {
  mode: 'approve' | 'reject' | 'defer' | 'merge'
  selectedIds: number[]
  // Subset of selectedIds that carry a dedup target. Merge-mode only — used
  // to warn the operator about rows that will fail per-row with "no dedup
  // target". null in other modes.
  mergeEligibleIds?: number[]
  reasons: SlugLabel[]
  scopes: SlugLabel[]
  onClose: () => void
  onComplete: (refresh: boolean) => void
}

type BulkResult = {
  succeeded: number
  failed: number
  errors: Array<{ id: number; message: string }>
}

const inputCls =
  'px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'

export default function BulkActionModal({
  mode,
  selectedIds,
  mergeEligibleIds,
  reasons,
  scopes,
  onClose,
  onComplete,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Approve-mode overlay fields. Required ones default to '' so the submit
  // button disables until the operator picks them.
  const [reasonSlug, setReasonSlug] = useState('')
  const [actionType, setActionType] = useState<'banned' | 'restricted' | 'challenged'>('banned')
  const [scopeSlug, setScopeSlug] = useState('')
  const [banStatus, setBanStatus] = useState<'active' | 'historical'>('historical')
  const [descriptionBan, setDescriptionBan] = useState('')
  const [inclusionRationaleTpl, setInclusionRationaleTpl] = useState('')

  // Reject-mode reason
  const [rejectReason, setRejectReason] = useState('')

  // Approve and merge share the same overlay-completeness check.
  const overlayReady = reasonSlug && scopeSlug && actionType && banStatus

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      // Merge posts to a different endpoint and takes only `ids` + `overlay`
      // (no `action` field). Approve/reject/defer all go through the shared
      // /bulk endpoint with `action` switching the behavior.
      if (mode === 'merge') {
        const res = await fetch('/api/admin/import-review/bulk/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: selectedIds,
            overlay: {
              reason_slug: reasonSlug,
              action_type: actionType,
              scope_slug: scopeSlug,
              ban_status: banStatus,
              description_ban: descriptionBan || null,
              inclusion_rationale_template: inclusionRationaleTpl || null,
            },
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        const json = await res.json() as BulkResult
        setResult(json)
        return
      }

      const body: Record<string, unknown> = {
        action: mode,
        ids: selectedIds,
      }
      if (mode === 'approve') {
        body.overlay = {
          reason_slug: reasonSlug,
          action_type: actionType,
          scope_slug: scopeSlug,
          ban_status: banStatus,
          description_ban: descriptionBan || null,
          inclusion_rationale_template: inclusionRationaleTpl || null,
        }
      } else if (mode === 'reject') {
        body.reason = rejectReason || null
      }
      const res = await fetch('/api/admin/import-review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json() as BulkResult
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  function handleDoneClick() {
    onComplete(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {mode === 'approve' && `Approve ${selectedIds.length} row${selectedIds.length !== 1 ? 's' : ''}`}
            {mode === 'reject'  && `Reject ${selectedIds.length} row${selectedIds.length !== 1 ? 's' : ''}`}
            {mode === 'defer'   && `Defer ${selectedIds.length} row${selectedIds.length !== 1 ? 's' : ''}`}
            {mode === 'merge'   && `Merge ${selectedIds.length} row${selectedIds.length !== 1 ? 's' : ''}`}
          </h2>
          {mode === 'approve' && !result && (
            <p className="text-sm text-gray-500 mt-1">
              Apply these settings to every selected row. Title, authors, and year stay as parsed.
            </p>
          )}
          {mode === 'merge' && !result && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-gray-500">
                Attach a new ban to each row&apos;s suggested existing book. The canonical book row is
                never overwritten; title variants become slug aliases.
              </p>
              {mergeEligibleIds && mergeEligibleIds.length < selectedIds.length && (
                <p className="text-xs text-amber-600">
                  {selectedIds.length - mergeEligibleIds.length} of {selectedIds.length} selected
                  row{selectedIds.length !== 1 ? 's' : ''} have no dedup target and will fail —
                  open those individually to pick a book.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-5">
          {result ? (
            <BulkResultView result={result} onDone={handleDoneClick} />
          ) : mode === 'approve' || mode === 'merge' ? (
            <div className="flex flex-col gap-4">
              <Field label="Reason" required>
                <select
                  value={reasonSlug}
                  onChange={e => setReasonSlug(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select reason…</option>
                  {reasons.map(r => (
                    <option key={r.slug} value={r.slug}>
                      {r.label_en} ({r.slug})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Action type" required>
                <select
                  value={actionType}
                  onChange={e => setActionType(e.target.value as typeof actionType)}
                  className={inputCls}
                >
                  <option value="banned">banned</option>
                  <option value="restricted">restricted</option>
                  <option value="challenged">challenged</option>
                </select>
              </Field>

              <Field label="Scope" required>
                <select
                  value={scopeSlug}
                  onChange={e => setScopeSlug(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select scope…</option>
                  {scopes.map(s => (
                    <option key={s.slug} value={s.slug}>
                      {s.label_en} ({s.slug})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ban status" required>
                <select
                  value={banStatus}
                  onChange={e => setBanStatus(e.target.value as typeof banStatus)}
                  className={inputCls}
                >
                  <option value="historical">historical</option>
                  <option value="active">active</option>
                </select>
              </Field>

              <Field
                label="Ban description (optional)"
                hint="Applied to every row. Leave blank to keep each row's parsed notes."
              >
                <textarea
                  value={descriptionBan}
                  onChange={e => setDescriptionBan(e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-y`}
                />
              </Field>

              <Field
                label="Inclusion rationale template (optional)"
                hint='Use {title} to inline each row’s title. Blank = use the parsed source citation.'
              >
                <input
                  type="text"
                  value={inclusionRationaleTpl}
                  onChange={e => setInclusionRationaleTpl(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Wikipedia bulk import (manual review): {title}"
                />
              </Field>
            </div>
          ) : mode === 'reject' ? (
            <Field label="Rejection reason (optional)">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className={`${inputCls} resize-y`}
                placeholder='e.g. "Out of inclusion criteria"'
              />
            </Field>
          ) : (
            <p className="text-sm text-gray-600">
              Defer {selectedIds.length} row{selectedIds.length !== 1 ? 's' : ''}? They stay in
              the queue under the &quot;Deferred&quot; filter.
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        {!result && (
          <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || ((mode === 'approve' || mode === 'merge') && !overlayReady)}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40 ${
                mode === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : mode === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : mode === 'merge'
                  ? 'bg-sky-600 hover:bg-sky-700'
                  : 'bg-gray-700 hover:bg-gray-800'
              }`}
            >
              {busy
                ? 'Working…'
                : mode === 'approve'
                ? 'Approve & commit'
                : mode === 'reject'
                ? 'Reject'
                : mode === 'merge'
                ? 'Merge & commit'
                : 'Defer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
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
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

function BulkResultView({ result, onDone }: { result: BulkResult; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="text-emerald-700 font-medium">
          {result.succeeded} succeeded
        </span>
        {result.failed > 0 && (
          <>
            {' · '}
            <span className="text-red-700 font-medium">
              {result.failed} failed
            </span>
          </>
        )}
      </p>
      {result.errors.length > 0 && (
        <div className="border border-red-200 rounded-lg p-3 bg-red-50 max-h-64 overflow-y-auto">
          <ul className="text-xs space-y-1.5">
            {result.errors.map(e => (
              <li key={e.id} className="text-red-700">
                <span className="font-mono">#{e.id}</span>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={onDone}
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  )
}
