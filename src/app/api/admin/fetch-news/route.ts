import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { runFetchNews } from '@/lib/fetch-news'

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  console.log('[fetch-news] admin_session:', session ? `${session.slice(0, 4)}…` : 'undefined')
  console.log('[fetch-news] ADMIN_SECRET:', secret ? `${secret.slice(0, 4)}…` : 'undefined')
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { saved, skipped, errors } = await runFetchNews(true)
  return NextResponse.json({ saved, skipped, errors })
}
