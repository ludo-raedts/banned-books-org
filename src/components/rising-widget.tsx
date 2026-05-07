import { adminClient } from '@/lib/supabase'
import Link from 'next/link'

type RisingEntry = {
  entityId: number
  slug: string
  label: string
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

function RisingListCompact({
  label,
  items,
  pathPrefix,
}: {
  label: string
  items: RisingEntry[]
  pathPrefix: string
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
        {label}
      </p>
      <ol className="space-y-1">
        {items.map((entry, i) => (
          <li key={entry.entityId} className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-3 shrink-0 text-right leading-none mt-px">
              {i + 1}
            </span>
            <Link
              href={`/${pathPrefix}/${entry.slug}`}
              className="flex-1 min-w-0 truncate text-xs text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              {entry.label}
            </Link>
            <GrowthBadge thisWeek={entry.thisWeek} prevWeek={entry.prevWeek} compact />
          </li>
        ))}
      </ol>
    </div>
  )
}

type Candidate = { id: number; thisWeek: number; prevWeek: number; growth: number }

async function fetchRisingCandidates(
  supabase: ReturnType<typeof adminClient>,
  entityType: 'book' | 'author',
  sevenDaysAgo: string,
  fourteenDaysAgo: string,
): Promise<Candidate[]> {
  let rows: { entity_id: number; viewed_at: string; visitor_hash: string | null }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('pageviews')
      .select('entity_id, viewed_at, visitor_hash')
      .eq('entity_type', entityType)
      .gte('viewed_at', fourteenDaysAgo)
      .range(offset, offset + 999)
    if (error || !data || data.length === 0) break
    rows = rows.concat(data as typeof rows)
    if (data.length < 1000) break
    offset += 1000
  }

  // Dedupe by visitor_hash so a single bot scraping 1000 pages counts once.
  // Rows without visitor_hash (legacy pre-013) are excluded.
  const thisWeekVisitors = new Map<number, Set<string>>()
  const prevWeekVisitors = new Map<number, Set<string>>()
  for (const row of rows) {
    if (!row.visitor_hash) continue
    const id = Number(row.entity_id)
    const map = row.viewed_at >= sevenDaysAgo ? thisWeekVisitors : prevWeekVisitors
    let set = map.get(id)
    if (!set) {
      set = new Set()
      map.set(id, set)
    }
    set.add(row.visitor_hash)
  }
  const thisWeekCounts = new Map<number, number>(
    [...thisWeekVisitors].map(([id, set]) => [id, set.size]),
  )
  const prevWeekCounts = new Map<number, number>(
    [...prevWeekVisitors].map(([id, set]) => [id, set.size]),
  )

  const candidates: Candidate[] = []
  for (const [id, thisWeek] of thisWeekCounts.entries()) {
    if (thisWeek < 2) continue
    const prevWeek = prevWeekCounts.get(id) ?? 0
    const growth = (thisWeek - prevWeek) / Math.max(prevWeek, 1)
    if (growth > 0) candidates.push({ id, thisWeek, prevWeek, growth })
  }
  candidates.sort((a, b) => b.growth - a.growth)
  return candidates.slice(0, 5)
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

    const [topBooks, topAuthors] = await Promise.all([
      fetchRisingCandidates(supabase, 'book', sevenDaysAgo, fourteenDaysAgo),
      fetchRisingCandidates(supabase, 'author', sevenDaysAgo, fourteenDaysAgo),
    ])

    const [{ data: bookDetails }, { data: authorDetails }] = await Promise.all([
      topBooks.length > 0
        ? supabase.from('books').select('id, title, slug').in('id', topBooks.map(c => c.id))
        : Promise.resolve({ data: [] as { id: number; title: string; slug: string }[] }),
      topAuthors.length > 0
        ? supabase.from('authors').select('id, display_name, slug').in('id', topAuthors.map(c => c.id))
        : Promise.resolve({ data: [] as { id: number; display_name: string; slug: string }[] }),
    ])

    const bookMap = new Map((bookDetails ?? []).map(b => [b.id, b]))
    const authorMap = new Map((authorDetails ?? []).map(a => [a.id, a]))

    const bookEntries: RisingEntry[] = topBooks
      .map(c => {
        const book = bookMap.get(c.id)
        if (!book?.slug) return null
        return { entityId: c.id, slug: book.slug, label: book.title, thisWeek: c.thisWeek, prevWeek: c.prevWeek }
      })
      .filter((e): e is RisingEntry => e !== null)

    const authorEntries: RisingEntry[] = topAuthors
      .map(c => {
        const a = authorMap.get(c.id)
        if (!a?.slug) return null
        return { entityId: c.id, slug: a.slug, label: a.display_name, thisWeek: c.thisWeek, prevWeek: c.prevWeek }
      })
      .filter((e): e is RisingEntry => e !== null)

    if (bookEntries.length === 0 && authorEntries.length === 0) return null

    if (compact) {
      return (
        <div className="space-y-3">
          {bookEntries.length > 0 && (
            <RisingListCompact label="Books" items={bookEntries} pathPrefix="books" />
          )}
          {authorEntries.length > 0 && (
            <RisingListCompact label="Authors" items={authorEntries} pathPrefix="authors" />
          )}
        </div>
      )
    }

    return (
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
          📈 Books gaining momentum
        </p>
        <ol className="space-y-1.5">
          {bookEntries.map((entry, i) => (
            <li key={entry.entityId} className="flex items-center gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center tabular-nums font-medium">
                {i + 1}
              </span>
              <Link
                href={`/books/${entry.slug}`}
                className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200 hover:underline hover:text-brand dark:hover:text-brand transition-colors"
              >
                {entry.label}
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
