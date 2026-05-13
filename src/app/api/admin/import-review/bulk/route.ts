// Bulk approve / reject / defer for /admin/import-review.
//
// Approve loops per row (each its own pg transaction inside commitParsedRow)
// so a failure on row 14 leaves rows 1-13 committed — partial success is the
// design, not a bug. The response surfaces per-row errors so the operator can
// triage the failures without re-doing the successes.

import { NextRequest, NextResponse } from 'next/server'
import type { Client as PgClient } from 'pg'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import {
  approveQueueRow,
  getQueueSourceContext,
  type ApproveOverlay,
} from '@/lib/imports/review-approve'
import { newPgClient } from '@/lib/wikipedia/importer'

export const maxDuration = 60

const ACTION_TYPES = new Set(['banned', 'restricted', 'challenged'])
const BAN_STATUSES = new Set(['active', 'historical'])

type BulkBody = {
  action: 'approve' | 'reject' | 'defer'
  ids: number[]
  overlay?: BulkApproveOverlay
  reason?: string | null
}

type BulkApproveOverlay = {
  reason_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  scope_slug: string
  ban_status: 'active' | 'historical'
  description_ban?: string | null
  inclusion_rationale_template?: string | null
}

type PerRowError = { id: number; message: string }

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseBody(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { action, ids } = parsed

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must not be empty' }, { status: 400 })
  }
  // Soft cap so a runaway client can't tie up a function for minutes.
  if (ids.length > 500) {
    return NextResponse.json({ error: 'ids cap is 500 per request' }, { status: 400 })
  }

  if (action === 'approve') {
    if (!parsed.overlay) {
      return NextResponse.json({ error: 'overlay is required for approve' }, { status: 400 })
    }
    return bulkApprove(ids, parsed.overlay)
  }
  if (action === 'reject') {
    return bulkSimpleStatus(ids, 'rejected', parsed.reason ?? null)
  }
  return bulkSimpleStatus(ids, 'deferred', null)
}

async function bulkApprove(ids: number[], overlay: BulkApproveOverlay) {
  const sb = adminClient()

  // Fetch all rows in one query so per-row processing is just an in-memory
  // lookup. Supabase caps at 1000; our 500-id cap above keeps us safe.
  const { data: rows, error: fetchErr } = await sb
    .from('import_review_queue')
    .select('id, source_slug, source_url, status, agreement_details')
    .in('id', ids)
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  const rowsById = new Map<number, NonNullable<typeof rows>[number]>()
  for (const r of rows ?? []) rowsById.set((r as { id: number }).id, r)

  const errors: PerRowError[] = []
  let succeeded = 0

  const pg = newPgClient()
  try {
    await pg.connect()
    for (const id of ids) {
      const row = rowsById.get(id)
      if (!row) {
        errors.push({ id, message: 'queue row not found' })
        continue
      }
      try {
        await approveOneRow(id, row, overlay, pg, sb)
        succeeded++
      } catch (err) {
        errors.push({
          id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    try { await pg.end() } catch { /* ignore */ }
  }

  return NextResponse.json({
    succeeded,
    failed: errors.length,
    errors,
  })
}

type QueueRow = {
  id: number
  source_slug: string
  source_url: string | null
  status: string
  agreement_details: Record<string, unknown> | null
}

async function approveOneRow(
  id: number,
  row: unknown,
  bulkOverlay: BulkApproveOverlay,
  pg: PgClient,
  sb: ReturnType<typeof adminClient>,
): Promise<void> {
  const r = row as QueueRow
  if (r.status === 'approved') {
    throw new Error('already approved')
  }
  if (r.status === 'rejected') {
    throw new Error('already rejected')
  }

  const agreement = (r.agreement_details ?? {}) as {
    page?: string
    revid?: number
    parsed_row?: {
      title?: string
      title_native?: string | null
      title_english_meaningful?: string | null
      authors?: string[]
      year?: number | null
      state?: string | null
      notes_raw?: string
      source_anchor?: string
    }
  }
  const parsed = agreement.parsed_row ?? {}
  const title = (parsed.title ?? '').trim()
  if (!title) throw new Error('parsed title is empty; open the row to edit before approving')
  const authors = (parsed.authors ?? []).map(a => a.trim()).filter(Boolean)
  if (authors.length === 0) throw new Error('parsed row has no author; open the row to edit before approving')
  const year = parsed.year
  if (year === null || year === undefined) throw new Error('parsed row has no year; open the row to edit before approving')

  const banDescription = bulkOverlay.description_ban?.trim()
    ? bulkOverlay.description_ban.trim()
    : formatBanDescription(parsed.state ?? null, parsed.notes_raw ?? '')

  const rationale = bulkOverlay.inclusion_rationale_template?.trim()
    ? bulkOverlay.inclusion_rationale_template.replace(/\{title\}/g, title)
    : defaultInclusionRationale(agreement.page, agreement.revid, r.source_slug)

  const ctx = getQueueSourceContext(r.source_slug, r.agreement_details, r.source_url)

  const fullOverlay: ApproveOverlay = {
    title,
    title_native: parsed.title_native ?? null,
    title_english_meaningful: parsed.title_english_meaningful ?? null,
    original_language: null,
    authors,
    year,
    first_published_year: null,
    reason_slug: bulkOverlay.reason_slug,
    action_type: bulkOverlay.action_type,
    scope_slug: bulkOverlay.scope_slug,
    ban_status: bulkOverlay.ban_status,
    description_book: null,
    description_ban: banDescription,
    inclusion_rationale: rationale,
  }

  const result = await approveQueueRow(id, fullOverlay, ctx, pg, sb, 'manual-bulk')
  if (result.queue_update_error) {
    throw new Error(
      `commit succeeded (book #${result.book_id}) but queue update failed: ${result.queue_update_error}`,
    )
  }
}

function formatBanDescription(state: string | null, notes: string): string {
  const prefix = state ? `State: ${state}. ` : ''
  return `${prefix}${notes}`.trim()
}

function defaultInclusionRationale(
  page: string | undefined,
  revid: number | undefined,
  sourceSlug: string,
): string {
  if (page && revid !== undefined) {
    return `Wikipedia bulk import: ${page} rev ${revid} (manual review)`
  }
  return `Manual import review from ${sourceSlug}`
}

async function bulkSimpleStatus(
  ids: number[],
  status: 'rejected' | 'deferred',
  reason: string | null,
) {
  const sb = adminClient()

  // For reject with reason, we need to merge `rejection_reason` into
  // agreement_details on each row. Without a reason, a single .update()
  // covers the whole set; with a reason, we have to loop because Supabase
  // doesn't have a server-side JSON-merge primitive.
  if (status === 'rejected' && reason) {
    return await rejectWithReason(ids, reason, sb)
  }

  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: 'manual-bulk',
  }
  if (status === 'rejected') {
    update.review_notes = null
  }
  const { error, count } = await sb
    .from('import_review_queue')
    .update(update, { count: 'exact' })
    .in('id', ids)
    .in('status', ['pending_review', 'deferred'])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const succeeded = count ?? 0
  const errors: PerRowError[] = []
  if (succeeded < ids.length) {
    // Identify which ids weren't updated — likely already approved/rejected.
    const { data: leftovers } = await sb
      .from('import_review_queue')
      .select('id, status')
      .in('id', ids)
      .not('status', 'eq', status)
    for (const r of (leftovers ?? []) as Array<{ id: number; status: string }>) {
      errors.push({ id: r.id, message: `already ${r.status}` })
    }
  }
  return NextResponse.json({
    succeeded,
    failed: errors.length,
    errors,
  })
}

async function rejectWithReason(
  ids: number[],
  reason: string,
  sb: ReturnType<typeof adminClient>,
) {
  // Read existing agreement_details for the rows we're touching, so the merge
  // preserves prior keys instead of clobbering them.
  const { data: rows, error: fetchErr } = await sb
    .from('import_review_queue')
    .select('id, status, agreement_details')
    .in('id', ids)
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const errors: PerRowError[] = []
  let succeeded = 0
  const nowIso = new Date().toISOString()
  for (const row of (rows ?? []) as Array<{
    id: number
    status: string
    agreement_details: Record<string, unknown> | null
  }>) {
    if (row.status === 'approved') {
      errors.push({ id: row.id, message: 'already approved' })
      continue
    }
    if (row.status === 'rejected') {
      errors.push({ id: row.id, message: 'already rejected' })
      continue
    }
    const merged = { ...(row.agreement_details ?? {}), rejection_reason: reason }
    const { error: updErr } = await sb
      .from('import_review_queue')
      .update({
        status: 'rejected',
        reviewed_at: nowIso,
        reviewed_by: 'manual-bulk',
        review_notes: reason,
        agreement_details: merged,
      })
      .eq('id', row.id)
    if (updErr) {
      errors.push({ id: row.id, message: updErr.message })
    } else {
      succeeded++
    }
  }

  // Surface rows that were requested but not found.
  const seen = new Set((rows ?? []).map(r => (r as { id: number }).id))
  for (const id of ids) {
    if (!seen.has(id)) errors.push({ id, message: 'queue row not found' })
  }

  return NextResponse.json({
    succeeded,
    failed: errors.length,
    errors,
  })
}

type ParseOk = {
  action: 'approve' | 'reject' | 'defer'
  ids: number[]
  overlay?: BulkApproveOverlay
  reason?: string | null
}
type ParseErr = { error: string }

function parseBody(input: unknown): ParseOk | ParseErr {
  if (!input || typeof input !== 'object') return { error: 'Body must be an object' }
  const b = input as Record<string, unknown>

  const action = b.action
  if (action !== 'approve' && action !== 'reject' && action !== 'defer') {
    return { error: 'action must be one of: approve, reject, defer' }
  }

  if (!Array.isArray(b.ids)) return { error: 'ids must be an array' }
  const ids = (b.ids as unknown[])
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map(n => Math.trunc(n))
  if (ids.length !== (b.ids as unknown[]).length) {
    return { error: 'ids must contain only finite numbers' }
  }

  const result: ParseOk = {
    action: action as BulkBody['action'],
    ids,
  }

  if (action === 'approve') {
    const overlay = b.overlay
    if (!overlay || typeof overlay !== 'object') {
      return { error: 'overlay is required for approve' }
    }
    const o = overlay as Record<string, unknown>
    if (typeof o.reason_slug !== 'string' || !o.reason_slug.trim()) {
      return { error: 'overlay.reason_slug is required' }
    }
    if (typeof o.scope_slug !== 'string' || !o.scope_slug.trim()) {
      return { error: 'overlay.scope_slug is required' }
    }
    if (typeof o.action_type !== 'string' || !ACTION_TYPES.has(o.action_type)) {
      return { error: 'overlay.action_type must be banned | restricted | challenged' }
    }
    if (typeof o.ban_status !== 'string' || !BAN_STATUSES.has(o.ban_status)) {
      return { error: 'overlay.ban_status must be active | historical' }
    }
    result.overlay = {
      reason_slug: o.reason_slug.trim(),
      action_type: o.action_type as BulkApproveOverlay['action_type'],
      scope_slug: o.scope_slug.trim(),
      ban_status: o.ban_status as BulkApproveOverlay['ban_status'],
      description_ban:
        typeof o.description_ban === 'string' ? o.description_ban.trim() || null : null,
      inclusion_rationale_template:
        typeof o.inclusion_rationale_template === 'string'
          ? o.inclusion_rationale_template.trim() || null
          : null,
    }
  } else if (action === 'reject') {
    if (typeof b.reason === 'string') {
      const trimmed = b.reason.trim()
      result.reason = trimmed || null
    } else {
      result.reason = null
    }
  }

  return result
}
