import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'

const ALLOWED_FIELDS = new Set([
  'display_name', 'bio', 'birth_year', 'death_year', 'birth_country', 'photo_url',
])

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

  const { error } = await adminClient()
    .from('authors')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: Object.keys(updates) })
}
