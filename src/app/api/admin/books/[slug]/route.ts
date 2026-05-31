import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'
import { notifyIndexNow } from '@/lib/indexnow'

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
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { error } = await adminClient()
    .from('books')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyIndexNow([`/books/${slug}`])

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
