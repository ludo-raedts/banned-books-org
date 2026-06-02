import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { runFetchNews } from '@/lib/fetch-news'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { saved, skipped, errors } = await runFetchNews(true)
  return NextResponse.json({ saved, skipped, errors })
}
