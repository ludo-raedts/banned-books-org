import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// Manage the Bluesky rotation exclusion list (the /admin/bluesky skip button).
// POST { book_id }  → exclude (skip) a book
// DELETE { book_id } → restore a book to the rotation

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { book_id } = await req.json().catch(() => ({}))
  if (!book_id) return NextResponse.json({ error: 'Missing book_id' }, { status: 400 })
  const { error } = await adminClient()
    .from('bluesky_excluded_books')
    .upsert({ book_id }, { onConflict: 'book_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { book_id } = await req.json().catch(() => ({}))
  if (!book_id) return NextResponse.json({ error: 'Missing book_id' }, { status: 400 })
  const { error } = await adminClient().from('bluesky_excluded_books').delete().eq('book_id', book_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
