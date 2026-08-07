import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { runFetchNews } from '@/lib/fetch-news'

// Same workload as /api/cron/fetch-news (which sets 300): 11 RSS feeds plus an
// embedding + summarize call per new item. Without this the admin button dies
// at the default function timeout on a busy news day.
export const maxDuration = 300

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { saved, skipped, errors } = await runFetchNews(true)
  return NextResponse.json({ saved, skipped, errors })
}
