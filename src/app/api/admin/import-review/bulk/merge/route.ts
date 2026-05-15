// Bulk merge for /admin/import-review.
//
// Each row in `ids` must carry an `agreement_details.dedup_check.book_id`
// pointing at an existing books row — that's the merge target. Rows without
// a dedup target produce a per-row error and the rest still proceed (partial
// success, same shape as bulk-approve).
//
// The overlay fields (reason / action / scope / status / description_ban /
// inclusion_rationale_template) are applied uniformly to every selected row,
// mirroring bulk-approve so operators can clear large dedupe clusters in one
// pass. Per-row title/authors/year are taken from `parsed_row` and serve as
// title-alias seeds for `book_slug_aliases` (the existing canonical book
// title is never overwritten).

import { NextRequest, NextResponse } from 'next/server'
import type { Client as PgClient } from 'pg'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import {
  getQueueSourceContext,
  mergeQueueRowIntoBook,
  type MergeOverlay,
} from '@/lib/imports/review-approve'
import { newPgClient } from '@/lib/wikipedia/importer'

export const maxDuration = 60

const ACTION_TYPES = new Set(['banned', 'restricted', 'challenged'])
const BAN_STATUSES = new Set(['active', 'historical'])

type BulkMergeOverlay = {
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
  const { ids, overlay } = parsed

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must not be empty' }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'ids cap is 500 per request' }, { status: 400 })
  }

  const sb = adminClient()
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

  let pg: Awaited<ReturnType<typeof newPgClient>> | null = null
  try {
    pg = newPgClient()
    await pg.connect()
    for (const id of ids) {
      const row = rowsById.get(id)
      if (!row) {
        errors.push({ id, message: 'queue row not found' })
        continue
      }
      try {
        await mergeOneRow(id, row, overlay, pg, sb)
        succeeded++
      } catch (err) {
        errors.push({
          id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } catch (err) {
    // Connection-level failure: no rows attempted. Mirror bulk-approve's
    // behaviour by surfacing every id as failed.
    const message = err instanceof Error ? err.message : String(err)
    for (const id of ids) {
      if (!errors.find(e => e.id === id)) {
        errors.push({ id, message })
      }
    }
  } finally {
    if (pg) {
      try { await pg.end() } catch { /* ignore */ }
    }
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

async function mergeOneRow(
  id: number,
  row: unknown,
  bulkOverlay: BulkMergeOverlay,
  pg: PgClient,
  sb: ReturnType<typeof adminClient>,
): Promise<void> {
  const r = row as QueueRow
  if (r.status === 'approved') throw new Error('already approved')
  if (r.status === 'rejected') throw new Error('already rejected')

  const agreement = (r.agreement_details ?? {}) as {
    page?: string
    revid?: number
    parsed_row?: {
      title?: string
      title_native?: string | null
      title_transliterated?: string | null
      title_english_meaningful?: string | null
      original_language?: string | null
      authors?: string[]
      year?: number | null
      state?: string | null
      notes_raw?: string
    }
    dedup_check?: { kind?: string; book_id?: number } | null
  }
  const targetBookId = agreement.dedup_check?.book_id
  if (!targetBookId || !Number.isFinite(targetBookId)) {
    throw new Error('no dedup target — open the row and pick a book manually')
  }

  const parsed = agreement.parsed_row ?? {}
  const title = (parsed.title ?? '').trim()
  if (!title) throw new Error('parsed title is empty; open the row to edit before merging')

  const authors = (parsed.authors ?? []).map(a => a.trim()).filter(Boolean)
  if (authors.length === 0) {
    throw new Error('parsed row has no author; open the row to edit before merging')
  }

  const year = parsed.year
  if (year === null || year === undefined) {
    throw new Error('parsed row has no year; open the row to edit before merging')
  }

  const banDescription = bulkOverlay.description_ban?.trim()
    ? bulkOverlay.description_ban.trim()
    : formatBanDescription(parsed.state ?? null, parsed.notes_raw ?? '')

  const rationale = bulkOverlay.inclusion_rationale_template?.trim()
    ? bulkOverlay.inclusion_rationale_template.replace(/\{title\}/g, title)
    : defaultInclusionRationale(agreement.page, agreement.revid, r.source_slug)

  const ctx = getQueueSourceContext(r.source_slug, r.agreement_details, r.source_url)

  const overlay: MergeOverlay = {
    target_book_id: targetBookId,
    title,
    title_native: parsed.title_native ?? null,
    title_transliterated: parsed.title_transliterated ?? null,
    title_english_meaningful: parsed.title_english_meaningful ?? null,
    original_language: parsed.original_language ?? null,
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

  const result = await mergeQueueRowIntoBook(id, overlay, ctx, pg, sb, 'manual-bulk-merge')
  if (result.queue_update_error) {
    throw new Error(
      `merge succeeded (book #${result.book_id}) but queue update failed: ${result.queue_update_error}`,
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
    return `Wikipedia bulk import (merged): ${page} rev ${revid} (manual review)`
  }
  return `Manual import review from ${sourceSlug} (merged)`
}

type ParseOk = { ids: number[]; overlay: BulkMergeOverlay }
type ParseErr = { error: string }

function parseBody(input: unknown): ParseOk | ParseErr {
  if (!input || typeof input !== 'object') return { error: 'Body must be an object' }
  const b = input as Record<string, unknown>

  if (!Array.isArray(b.ids)) return { error: 'ids must be an array' }
  const ids = (b.ids as unknown[])
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map(n => Math.trunc(n))
  if (ids.length !== (b.ids as unknown[]).length) {
    return { error: 'ids must contain only finite numbers' }
  }

  const overlay = b.overlay
  if (!overlay || typeof overlay !== 'object') {
    return { error: 'overlay is required' }
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

  return {
    ids,
    overlay: {
      reason_slug: o.reason_slug.trim(),
      action_type: o.action_type as BulkMergeOverlay['action_type'],
      scope_slug: o.scope_slug.trim(),
      ban_status: o.ban_status as BulkMergeOverlay['ban_status'],
      description_ban:
        typeof o.description_ban === 'string' ? o.description_ban.trim() || null : null,
      inclusion_rationale_template:
        typeof o.inclusion_rationale_template === 'string'
          ? o.inclusion_rationale_template.trim() || null
          : null,
    },
  }
}
