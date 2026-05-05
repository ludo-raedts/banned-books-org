import { adminClient } from '@/lib/supabase'
import Link from 'next/link'

type RisingEntry = {
  entityId: number
  slug: string
  title: string
  thisWeek: number
  prevWeek: number
}

function GrowthBadge({ thisWeek, prevWeek, compact }: { thisWeek: number; prevWeek: number; compact: boolean }) {
  const cls = compact ? 'text-[10px] shrink-0 leading-none font-medium' : 'text-[11px] shrink-0 leading-none font-medium'
  if (prevWeek === 0) {
    return <span className={`${cls} text-blue-500`}>new</span>
  }
  const pct = Math.round(((thisWeek - prevWeek) / prevWeek) * 100)
  if (pct <= 0) return null
  return <span className={`${cls} text-emerald-600 dark:text-emerald-400`}>↑{pct}%</span>
}

export default async function RisingWidget({
  compact = false,
}: {
  compact?: boolean
}) {
  const supabase = adminClient()

  try {
    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch last 14 days of book pageviews (paginate past the 1000-row cap)
    let rows: { entity_id: number; viewed_at: string }[] = []
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('pageviews')
        .select('entity_id, viewed_at')
        .eq('entity_type', 'book')
        .gte('viewed_at', fourteenDaysAgo)
        .range(offset, offset + 999)
      if (error || !data || data.length === 0) break
      rows = rows.concat(data as typeof rows)
      if (data.length < 1000) break
      offset += 1000
    }

    if (rows.length === 0) return null

    // Split into this-week and prev-week buckets
    const thisWeekCounts = new Map<number, number>()
    const prevWeekCounts = new Map<number, number>()

    for (const row of rows) {
      const id = Number(row.entity_id)
      if (row.viewed_at >= sevenDaysAgo) {
        thisWeekCounts.set(id, (thisWeekCounts.get(id) ?? 0) + 1)
      } else {
        prevWeekCounts.set(id, (prevWeekCounts.get(id) ?? 0) + 1)
      }
    }

    // Score by growth rate; require at least 2 views this week to reduce noise
    type Candidate = { id: number; thisWeek: number; prevWeek: number; growth: number }
    const candidates: Candidate[] = []
    for (const [id, thisWeek] of thisWeekCounts.entries()) {
      if (thisWeek < 2) continue
      const prevWeek = prevWeekCounts.get(id) ?? 0
      const growth = (thisWeek - prevWeek) / Math.max(prevWeek, 1)
      if (growth > 0) {
        candidates.push({ id, thisWeek, prevWeek, growth })
      }
    }
    candidates.sort((a, b) => b.growth - a.growth)

    const top5 = candidates.slice(0, 5)
    if (top5.length === 0) return null

    const { data: bookDetails } = await supabase
      .from('books')
      .select('id, title, slug')
      .in('id', top5.map(c => c.id))

    const bookMap = new Map((bookDetails ?? []).map(b => [b.id, b]))

    const entries: RisingEntry[] = top5
      .map(c => {
        const book = bookMap.get(c.id)
        if (!book?.slug) return null
        return { entityId: c.id, slug: book.slug, title: book.title, thisWeek: c.thisWeek, prevWeek: c.prevWeek }
      })
      .filter((e): e is RisingEntry => e !== null)

    if (entries.length === 0) return null

    if (compact) {
      return (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
            Rising
          </p>
          <ol className="space-y-1">
            {entries.map((entry, i) => (
              <li key={entry.entityId} className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-3 shrink-0 text-right leading-none mt-px">
                  {i + 1}
                </span>
                <Link
                  href={`/books/${entry.slug}`}
                  className="flex-1 min-w-0 truncate text-xs text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
                >
                  {entry.title}
                </Link>
                <GrowthBadge thisWeek={entry.thisWeek} prevWeek={entry.prevWeek} compact />
              </li>
            ))}
          </ol>
        </div>
      )
    }

    return (
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
          📈 Books gaining momentum
        </p>
        <ol className="space-y-1.5">
          {entries.map((entry, i) => (
            <li key={entry.entityId} className="flex items-center gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center tabular-nums font-medium">
                {i + 1}
              </span>
              <Link
                href={`/books/${entry.slug}`}
                className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200 hover:underline hover:text-brand dark:hover:text-brand transition-colors"
              >
                {entry.title}
              </Link>
              <GrowthBadge thisWeek={entry.thisWeek} prevWeek={entry.prevWeek} compact={false} />
            </li>
          ))}
        </ol>
      </div>
    )
  } catch {
    return null
  }
}
