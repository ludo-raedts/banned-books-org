import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const sb = adminClient()
  const { data: row, error: fetchErr } = await sb
    .from('import_review_queue')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Queue row not found' }, { status: 404 })
  }
  if (row.status === 'approved' || row.status === 'rejected') {
    return NextResponse.json(
      { error: `Cannot defer a row that was already ${row.status}` },
      { status: 409 },
    )
  }

  const { error: updateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'deferred',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'manual',
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
