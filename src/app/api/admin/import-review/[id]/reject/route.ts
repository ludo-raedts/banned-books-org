import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'

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

  let reason: string | null = null
  try {
    const body = await request.json() as { reason?: unknown } | null
    if (body && typeof body.reason === 'string') {
      const trimmed = body.reason.trim()
      reason = trimmed || null
    }
  } catch {
    // No body / invalid JSON is fine — reason is optional.
  }

  const sb = adminClient()
  const { data: row, error: fetchErr } = await sb
    .from('import_review_queue')
    .select('id, status, agreement_details')
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
      { error: 'Cannot reject a row that was already approved' },
      { status: 409 },
    )
  }

  const existingDetails = (row.agreement_details ?? {}) as Record<string, unknown>
  const updatedDetails = reason
    ? { ...existingDetails, rejection_reason: reason }
    : existingDetails

  const { error: updateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'manual',
      review_notes: reason,
      agreement_details: updatedDetails,
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
