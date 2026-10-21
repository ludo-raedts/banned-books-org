import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { revalidateTag } from 'next/cache'
import { runFetchNews } from '@/lib/fetch-news'
import { bustBookPagesForNews } from '@/lib/news-book-match'

// Same workload as /api/cron/fetch-news (which sets 300): 11 RSS feeds plus an
// embedding + summarize call per new item. Without this the admin button dies
// at the default function timeout on a busy news day.
export const maxDuration = 300

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { saved, skipped, errors, savedItems } = await runFetchNews(true)
  // Same busts as the cron: /news now, plus only the book pages the new
  // published items mention (never the route-wide 'news-items' tag).
  revalidateTag('news-page', 'max')
  const published = savedItems.filter(i => i.status === 'published')
  let bookPagesBusted = 0
  if (published.length > 0) {
    try {
      bookPagesBusted = await bustBookPagesForNews(published)
    } catch (e) {
      errors.push(`book-page bust: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return NextResponse.json({ saved, skipped, errors, bookPagesBusted })
}
