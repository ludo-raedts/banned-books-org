import { NextRequest, NextResponse } from 'next/server'
import { runFetchNews } from '@/lib/fetch-news'

export async function POST(req: NextRequest) {
  const session = req.cookies.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  console.log('[fetch-news] cookies:', req.cookies.getAll().map(c => c.name))
  console.log('[fetch-news] admin_session:', session ? `${session.slice(0, 4)}…` : 'undefined')
  console.log('[fetch-news] ADMIN_SECRET:', secret ? `${secret.slice(0, 4)}…` : 'undefined')
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { saved, skipped, errors } = await runFetchNews(true)
  return NextResponse.json({ saved, skipped, errors })
}
