import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import { notifyIndexNow } from '@/lib/indexnow'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

const ALLOWED_FIELDS = new Set([
  'display_name', 'bio', 'birth_year', 'death_year', 'birth_country', 'photo_url',
])

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

  // Gate photo_url through the image-host allowlist (next/image 500s on hosts
  // outside remotePatterns). Empty string clears the photo.
  if ('photo_url' in updates) {
    const p = updates.photo_url
    if (p === '' || p === null) {
      updates.photo_url = null
    } else if (!isAllowedImageUrl(typeof p === 'string' ? p : undefined)) {
      return NextResponse.json(
        { error: 'photo_url must be an https URL on a host in the image allowlist (src/lib/allowed-image-hosts.ts).' },
        { status: 400 },
      )
    }
  }

  // birth_year / death_year are integer columns — reject non-numeric input.
  for (const field of ['birth_year', 'death_year'] as const) {
    if (field in updates) {
      const v = updates[field]
      if (v === '' || v === null) {
        updates[field] = null
      } else if (typeof v !== 'number' || !Number.isInteger(v)) {
        return NextResponse.json(
          { error: `${field} must be an integer or null` },
          { status: 400 },
        )
      }
    }
  }

  // ── Manual-provenance stamping ─────────────────────────────────────────────
  // The edit client sends its full form on every save, so diff against the
  // current row and stamp only on a REAL change.
  //
  // Why: the enrichment pins are sticky *_checked_at gates. enrich-author-ol
  // (long-tail OL bio/years) is NULL-guarded, so the dangerous case is a
  // deliberately CLEARED value — e.g. a namesake-contaminated birth_year set
  // to NULL (the 2026-07-01 "Joseph Amiel" fix) would be refilled from OL,
  // possibly from the same namesake, unless ol_checked_at marks the author as
  // resolved. Same for photos: enrich-author-photos-v2 skips authors with
  // photo_v2_checked_at set (only --recheck ignores it).
  const supabase = adminClient()
  const { data: current } = await supabase
    .from('authors')
    .select('bio, birth_year, death_year, photo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (current) {
    const changed = (field: 'bio' | 'birth_year' | 'death_year' | 'photo_url') =>
      field in updates && (updates[field] ?? null) !== (current[field] ?? null)

    // Bio and years are written together by enrich-author-ol behind one gate,
    // so any manual edit to them pins the whole OL probe. (A cleared bio can
    // still be refilled from Wikipedia by enrich-author-bios — that path is
    // fill-missing from a named source, which is acceptable.)
    if (changed('bio') || changed('birth_year') || changed('death_year')) {
      updates.ol_checked_at = new Date().toISOString()
    }
    if (changed('photo_url')) {
      updates.photo_v2_checked_at = new Date().toISOString()
    }
  }

  const { error } = await supabase
    .from('authors')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyIndexNow([`/authors/${slug}`])

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
