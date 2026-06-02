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

  const { error } = await adminClient()
    .from('authors')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyIndexNow([`/authors/${slug}`])

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
