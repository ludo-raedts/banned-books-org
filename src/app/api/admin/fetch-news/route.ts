import { NextRequest, NextResponse } from 'next/server'
import { runFetchNews } from '@/lib/fetch-news'

export async function POST(req: NextRequest) {
  const session = req.cookies.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { saved, skipped, errors } = await runFetchNews(true)
  return NextResponse.json({ saved, skipped, errors })
}
