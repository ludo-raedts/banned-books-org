import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { syncInboxPreview } from '@/lib/inbox-sync'

export const maxDuration = 30

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const result = await syncInboxPreview()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, count: result.count })
}
