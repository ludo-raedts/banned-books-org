import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import {
  approveQueueRow,
  getQueueSourceContext,
  type ApproveOverlay,
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

  const validation = validateOverlay(body)
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

  // newPgClient() throws if DATABASE_URL isn't set (e.g. on Vercel without
  // a Supabase pooler URL configured). Pulling it inside the try block means
  // that error surfaces as a JSON 500 the UI can render — without the wrap,
  // the throw escapes the route handler entirely and Vercel returns its own
  // bare 500 page, so the UI just sees "HTTP 500" with no detail.
  let pg: Awaited<ReturnType<typeof newPgClient>> | null = null
  try {
    pg = newPgClient()
    await pg.connect()
    const result = await approveQueueRow(id, overlay, ctx, pg, sb, 'manual')
    return NextResponse.json({
      ok: true,
      book_id: result.book_id,
      ban_ids: result.ban_ids,
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

type ValidationOk = { overlay: ApproveOverlay }
type ValidationErr = { error: string }

function validateOverlay(input: unknown): ValidationOk | ValidationErr {
  if (!input || typeof input !== 'object') return { error: 'Body must be an object' }
  const b = input as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return { error: 'title is required' }

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
      title,
      title_native: optionalString(b.title_native),
      title_transliterated: optionalString(b.title_transliterated),
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
