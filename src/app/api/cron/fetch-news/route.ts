import { NextRequest, NextResponse } from 'next/server'
import { runFetchNews } from '@/lib/fetch-news'

// Daily fetch — protected by CRON_SECRET. Whether items go straight to
// 'published' or land as 'draft' for review is governed at runtime by the
// auto_publish flag in news_config (see src/config/news.ts), so this route
// stays trivial: pull, dedup, summarise, save.

// Headroom for the OpenAI calls — embed + summarise per item, ~1s each. The
// daily steady-state run is small (most items dedup), but a first run after
// adding feeds can take 60-90s. Vercel's Fluid Compute default is 300s; we
// set this explicitly so a Hobby-cap shift doesn't silently kill the cron.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runFetchNews(true)
  return NextResponse.json(result)
}
