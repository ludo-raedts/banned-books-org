import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import {
  getQueueSourceContext,
  mergeQueueRowIntoBook,
  type MergeOverlay,
} from '@/lib/imports/review-approve'
import { newPgClient } from '@/lib/wikipedia/importer'

export const maxDuration = 30

const ACTION_TYPES = new Set(['banned', 'restricted', 'challenged'])
const BAN_STATUSES = new Set(['active', 'historical'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateMergeOverlay(body)
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const overlay = validation.overlay

  const sb = adminClient()
  const { data: row, error: fetchErr } = await sb
    .from('import_review_queue')
    .select('id, source_slug, source_url, status, agreement_details')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Queue row not found' }, { status: 404 })
  }
  if (row.status === 'approved') {
    return NextResponse.json(
      { error: 'Row is already approved' },
      { status: 409 },
    )
  }
  if (row.status === 'rejected') {
    return NextResponse.json(
      { error: 'Row was rejected; restore via a separate action' },
      { status: 409 },
    )
  }

  let ctx
  try {
    ctx = getQueueSourceContext(row.source_slug, row.agreement_details, row.source_url)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }

  // Same pattern as the approve route: pull newPgClient() inside the try so
  // any DATABASE_URL-missing error surfaces as a JSON response, not a bare
  // Vercel 500.
  let pg: Awaited<ReturnType<typeof newPgClient>> | null = null
  try {
    pg = newPgClient()
    await pg.connect()
    const result = await mergeQueueRowIntoBook(id, overlay, ctx, pg, sb, 'manual-merge')
    return NextResponse.json({
      ok: true,
      book_id: result.book_id,
      ban_id: result.ban_id,
      ban_created: result.ban_created,
      enriched_fields: result.enriched_fields,
      aliases_added: result.aliases_added,
      queue_update_error: result.queue_update_error ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  } finally {
    if (pg) {
      try { await pg.end() } catch { /* ignore */ }
    }
  }
}

type ValidationOk = { overlay: MergeOverlay }
type ValidationErr = { error: string }

function validateMergeOverlay(input: unknown): ValidationOk | ValidationErr {
  if (!input || typeof input !== 'object') return { error: 'Body must be an object' }
  const b = input as Record<string, unknown>

  const targetBookId = b.target_book_id
  if (typeof targetBookId !== 'number' || !Number.isFinite(targetBookId)) {
    return { error: 'target_book_id is required (number)' }
  }

  // Title is still required — used for slug-alias generation. Existing
  // canonical title is never overwritten by merge, but the parsed title
  // becomes a searchable alias.
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return { error: 'title is required' }

  // Authors are required in the form for UX symmetry with approve, but the
  // merge flow does NOT touch the existing book's authors. We validate the
  // shape but the values are not persisted.
  if (!Array.isArray(b.authors)) return { error: 'authors must be an array' }
  const authors = (b.authors as unknown[])
    .filter((a): a is string => typeof a === 'string')
    .map(a => a.trim())
    .filter(Boolean)
  if (authors.length === 0) return { error: 'at least one author is required' }

  const year = b.year
  if (typeof year !== 'number' || !Number.isFinite(year)) {
    return { error: 'year is required (number)' }
  }

  const fpy = b.first_published_year
  let firstPublishedYear: number | null = null
  if (fpy !== null && fpy !== undefined) {
    if (typeof fpy !== 'number' || !Number.isFinite(fpy)) {
      return { error: 'first_published_year must be a number or null' }
    }
    firstPublishedYear = fpy
  }

  const reasonSlug = typeof b.reason_slug === 'string' ? b.reason_slug.trim() : ''
  if (!reasonSlug) return { error: 'reason_slug is required' }

  const actionType = b.action_type
  if (typeof actionType !== 'string' || !ACTION_TYPES.has(actionType)) {
    return { error: 'action_type must be one of: banned, restricted, challenged' }
  }

  const scopeSlug = typeof b.scope_slug === 'string' ? b.scope_slug.trim() : ''
  if (!scopeSlug) return { error: 'scope_slug is required' }

  const banStatus = b.ban_status
  if (typeof banStatus !== 'string' || !BAN_STATUSES.has(banStatus)) {
    return { error: 'ban_status must be one of: active, historical' }
  }

  const inclusionRationale =
    typeof b.inclusion_rationale === 'string' ? b.inclusion_rationale.trim() : ''
  if (!inclusionRationale) return { error: 'inclusion_rationale is required' }

  const originalLanguage = optionalString(b.original_language)
  if (originalLanguage !== null && originalLanguage !== undefined && originalLanguage.length !== 2) {
    return { error: 'original_language must be a 2-letter ISO-639-1 code' }
  }

  return {
    overlay: {
      target_book_id: targetBookId,
      title,
      title_native: optionalString(b.title_native),
      title_english_meaningful: optionalString(b.title_english_meaningful),
      original_language: originalLanguage,
      authors,
      year,
      first_published_year: firstPublishedYear,
      reason_slug: reasonSlug,
      action_type: actionType as 'banned' | 'restricted' | 'challenged',
      scope_slug: scopeSlug,
      ban_status: banStatus as 'active' | 'historical',
      description_book: optionalString(b.description_book),
      description_ban: optionalString(b.description_ban),
      inclusion_rationale: inclusionRationale,
    },
  }
}

function optionalString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed || null
}
