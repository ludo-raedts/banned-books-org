import { adminClient } from '@/lib/supabase'
import Link from 'next/link'

type TrendingEntry = {
  rank: number
  entityId: number
  lastWeekRank: number | null
  label: string
  slug: string
}

function RankChange({ thisWeek, lastWeek, compact }: { thisWeek: number; lastWeek: number | null; compact: boolean }) {
  const cls = compact ? 'text-[10px] shrink-0 leading-none' : 'text-[11px] shrink-0 leading-none'
  if (lastWeek === null) {
    return <span className={`${cls} text-blue-500 font-medium`}>new</span>
  }
  const delta = lastWeek - thisWeek
  if (delta > 0) return <span className={`${cls} text-emerald-600 dark:text-emerald-400`}>↑{delta}</span>
  if (delta < 0) return <span className={`${cls} text-red-400`}>↓{Math.abs(delta)}</span>
  return <span className={`${cls} text-gray-300 dark:text-gray-600`}>—</span>
}

function TrendingListCompact({
  label,
  items,
  pathPrefix,
}: {
  label: string
  items: TrendingEntry[]
  pathPrefix: string
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
        {label}
      </p>
      <ol className="space-y-1">
        {items.map(item => (
          <li key={item.entityId} className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-3 shrink-0 text-right leading-none mt-px">
              {item.rank}
            </span>
            <Link
              href={`/${pathPrefix}/${item.slug}`}
              className="flex-1 min-w-0 truncate text-xs text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              {item.label}
            </Link>
            <RankChange thisWeek={item.rank} lastWeek={item.lastWeekRank} compact />
          </li>
        ))}
      </ol>
    </div>
  )
}

function TrendingListFull({
  icon,
  label,
  items,
  pathPrefix,
}: {
  icon: string
  label: string
  items: TrendingEntry[]
  pathPrefix: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
        {icon} {label}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No data yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map(item => (
            <li key={item.entityId} className="flex items-center gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center tabular-nums font-medium">
                {item.rank}
              </span>
              <Link
                href={`/${pathPrefix}/${item.slug}`}
                className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200 hover:underline hover:text-brand dark:hover:text-brand transition-colors"
              >
                {item.label}
              </Link>
              <RankChange thisWeek={item.rank} lastWeek={item.lastWeekRank} compact={false} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/**
 * Self-contained server component — fetches trending data and renders the widget.
 * Silently renders nothing if the pageviews table doesn't exist yet.
 *
 * @param compact      Sidebar-friendly: no circles, tiny caps labels, flat rank numbers.
 * @param showHeader   Show the "Trending this week" heading (stats page uses this; sidebar manages its own).
 */
export default async function TrendingWidget({
  compact = false,
  showHeader = true,
}: {
  compact?: boolean
  showHeader?: boolean
}) {
  const supabase = adminClient()

  let books: TrendingEntry[] = []
  let authors: TrendingEntry[] = []

  try {
    const [
      { data: booksThisWeek },
      { data: booksLastWeek },
      { data: authorsThisWeek },
      { data: authorsLastWeek },
    ] = await Promise.all([
      supabase.from('v_top_books_this_week').select('entity_id, views'),
      supabase.from('v_top_books_last_week').select('entity_id, views'),
      supabase.from('v_top_authors_this_week').select('entity_id, views'),
      supabase.from('v_top_authors_last_week').select('entity_id, views'),
    ])

    // ── Books ──────────────────────────────────────────────────────────────────
    const topBookEntries = (booksThisWeek ?? []).slice(0, 5)
    const topBookIds = topBookEntries.map(r => Number(r.entity_id))
    if (topBookIds.length > 0) {
      const { data: bookDetails } = await supabase
        .from('books')
        .select('id, title, slug')
        .in('id', topBookIds)
      const bookMap = new Map((bookDetails ?? []).map(b => [b.id, b]))
      const lastWeekRankMap = new Map(
        (booksLastWeek ?? []).map((r, i) => [Number(r.entity_id), i + 1])
      )
      books = topBookEntries
        .map((r, i) => {
          const book = bookMap.get(Number(r.entity_id))
          if (!book?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            lastWeekRank: lastWeekRankMap.get(Number(r.entity_id)) ?? null,
            label: book.title,
            slug: book.slug,
          }
        })
        .filter((b): b is TrendingEntry => b !== null)
    }

    // ── Authors ────────────────────────────────────────────────────────────────
    const topAuthorEntries = (authorsThisWeek ?? []).slice(0, 5)
    const topAuthorIds = topAuthorEntries.map(r => Number(r.entity_id))
    if (topAuthorIds.length > 0) {
      const { data: authorDetails } = await supabase
        .from('authors')
        .select('id, display_name, slug')
        .in('id', topAuthorIds)
      const authorMap = new Map((authorDetails ?? []).map(a => [a.id, a]))
      const lastWeekRankMap = new Map(
        (authorsLastWeek ?? []).map((r, i) => [Number(r.entity_id), i + 1])
      )
      authors = topAuthorEntries
        .map((r, i) => {
          const author = authorMap.get(Number(r.entity_id))
          if (!author?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            lastWeekRank: lastWeekRankMap.get(Number(r.entity_id)) ?? null,
            label: author.display_name,
            slug: author.slug,
          }
        })
        .filter((a): a is TrendingEntry => a !== null)
    }
  } catch {
    return null
  }

  if (books.length === 0 && authors.length === 0) return null

  if (compact) {
    return (
      <div className="space-y-3">
        {books.length > 0 && (
          <TrendingListCompact label="Books" items={books} pathPrefix="books" />
        )}
        {authors.length > 0 && (
          <TrendingListCompact label="Authors" items={authors} pathPrefix="authors" />
        )}
      </div>
    )
  }

  return (
    <div>
      {showHeader && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Trending this week</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Most visited in the last 7 days.</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {books.length > 0 && (
          <TrendingListFull icon="📚" label="Books" items={books} pathPrefix="books" />
        )}
        {authors.length > 0 && (
          <TrendingListFull icon="✍️" label="Authors" items={authors} pathPrefix="authors" />
        )}
      </div>
    </div>
  )
}
