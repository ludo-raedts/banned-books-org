import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import { notifyIndexNow } from '@/lib/indexnow'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

const ALLOWED_FIELDS = new Set([
  'title', 'title_native', 'title_native_script', 'title_transliterated',
  'title_english_meaningful', 'first_published_year', 'genres', 'cover_url',
  'description_book', 'description_ban', 'censorship_context', 'ai_drafted',
  'warning_level', 'inclusion_rationale', 'extended_context',
])

const VALID_WARNING_LEVELS = new Set(['none', 'context', 'extended'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { slug } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if ('warning_level' in updates) {
    const lvl = updates.warning_level
    if (typeof lvl !== 'string' || !VALID_WARNING_LEVELS.has(lvl)) {
      return NextResponse.json(
        { error: 'warning_level must be one of: none, context, extended' },
        { status: 400 },
      )
    }
  }

  // Gate cover_url through the image-host allowlist: a URL on a host outside
  // next.config.ts remotePatterns would make next/image 500 the public book
  // page. Empty string clears the cover.
  if ('cover_url' in updates) {
    const c = updates.cover_url
    if (c === '' || c === null) {
      updates.cover_url = null
    } else if (!isAllowedImageUrl(typeof c === 'string' ? c : undefined)) {
      return NextResponse.json(
        { error: 'cover_url must be an https URL on a host in the image allowlist (src/lib/allowed-image-hosts.ts).' },
        { status: 400 },
      )
    }
  }

  // first_published_year is an integer column — reject non-numeric input up
  // front rather than surfacing a raw Postgres type error as a 500.
  if ('first_published_year' in updates) {
    const y = updates.first_published_year
    if (y === '' || y === null) {
      updates.first_published_year = null
    } else if (typeof y !== 'number' || !Number.isInteger(y)) {
      return NextResponse.json(
        { error: 'first_published_year must be an integer or null' },
        { status: 400 },
      )
    }
  }

  // ── Manual-provenance stamping ─────────────────────────────────────────────
  // The edit client sends its full form on every save, so we diff against the
  // current row and only stamp on a REAL change — otherwise fixing a year would
  // silently mark an untouched OL/Wikipedia description as 'manual'.
  //
  // Why stamp at all: enrichment pins live in columns the pipelines gate on.
  // Without them a hand-written description keeps description_source_type NULL,
  // which is exactly what `enrich-descriptions-v2 --reground-ungrounded`
  // selects (descriptions-v2.ts, regroundUngrounded branch) — a later reground
  // run would overwrite the admin's text. Same story for covers: ol/gb-harvest
  // skip cover_status='manual_override' but nothing else.
  const supabase = adminClient()
  const { data: current } = await supabase
    .from('books')
    .select('description_book, cover_url')
    .eq('slug', slug)
    .maybeSingle()

  if (current && 'description_book' in updates) {
    const next = (updates.description_book ?? null) as string | null
    if (next !== (current.description_book ?? null)) {
      if (next) {
        // A human wrote/edited this text: record provenance so regrounds skip
        // it, and force ai_drafted off regardless of the checkbox state.
        updates.description_source_type = 'manual'
        updates.ai_drafted = false
      } else {
        // Cleared: no text → no source. Leaves the row eligible for a sourced
        // refill by the fill-missing pipeline, which is the desired retry path.
        updates.description_source_type = null
      }
    }
  }

  if (current && 'cover_url' in updates) {
    const next = (updates.cover_url ?? null) as string | null
    if (next !== (current.cover_url ?? null)) {
      // 'manual_override' is the established admin pin (enrich-ol-harvest /
      // enrich-gb-harvest skip it; cover audits exclude it). A cleared cover
      // must not stay 'valid' (audit-integrity invariant cover-status-valid-
      // no-url) — 'rejected_placeholder' routes it to the retry path.
      updates.cover_status = next ? 'manual_override' : 'rejected_placeholder'
    }
  }

  const { error } = await supabase
    .from('books')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyIndexNow([`/books/${slug}`])

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
