// Self-contained "Happening now" block — the homepage news strip. Was
// previously embedded inside <BookBrowser> as the <NewsPanel> sub-component;
// after the homepage was reframed around top-lists the block was lost. This
// file gives it its own life: fetches the three most-recent published news
// items and renders them as a stack of summary cards linking through to
// /news. Renders nothing if no published news exists yet.

import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { normalizeNewsDisplay, TranslatedBadge } from '@/lib/news-display'

type NewsRow = {
  id: number
  title: string
  source_name: string
  published_at: string | null
  summary: string
  source_language: string | null
}

function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function NewsBlock() {
  const timer = newTimer('news-block')
  const supabase = adminClient()

  const { data } = await timer.wrap('news_items', () =>
    supabase
      .from('news_items')
      .select('id, title, source_name, published_at, summary, source_language')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  )
  timer.end()

  const items = (data ?? []) as NewsRow[]
  if (items.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Happening now</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Book bans are not history.</p>
        </div>
        <Link
          href="/news"
          className="shrink-0 text-sm text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors whitespace-nowrap"
        >
          All news →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(item => {
          const { sourceName } = normalizeNewsDisplay(item.title, item.source_name)
          return (
            <Link
              key={item.id}
              href="/news"
              className="group block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors"
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug line-clamp-4 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {item.summary}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1.5 flex-wrap">
                <span>
                  {sourceName}
                  {item.published_at && <span> · {formatNewsDate(item.published_at)}</span>}
                </span>
                <TranslatedBadge code={item.source_language} size="compact" />
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
