import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { syncInboxPreview } from '@/lib/inbox-sync'

export const maxDuration = 30

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncInboxPreview()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, count: result.count })
}
