import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
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
  return <span className={`${cls} text-emerald-600`}>↑{pct}%</span>
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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
        {label}
      </p>
      <ol className="space-y-1">
        {items.map((entry, i) => (
          <li key={entry.entityId} className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[10px] text-gray-400 tabular-nums w-3 shrink-0 text-right leading-none mt-px">
              {i + 1}
            </span>
            <Link
              href={`/${pathPrefix}/${entry.slug}`}
              className="flex-1 min-w-0 truncate text-xs text-gray-700 hover:text-brand transition-colors"
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

type RisingRow = { entity_id: number; this_week: number; prev_week: number }

export default async function RisingWidget({
  compact = false,
}: {
  compact?: boolean
}) {
  const timer = newTimer('rising')
  const supabase = adminClient()

  try {
    const [topBooksRes, topAuthorsRes] = await timer.wrap('mv-rising-parallel', () => Promise.all([
      supabase.from('mv_top_books_rising').select('entity_id, this_week, prev_week').limit(5),
      supabase.from('mv_top_authors_rising').select('entity_id, this_week, prev_week').limit(5),
    ]))

    const topBooks = (topBooksRes.data ?? []) as RisingRow[]
    const topAuthors = (topAuthorsRes.data ?? []) as RisingRow[]

    const [{ data: bookDetails }, { data: authorDetails }] = await timer.wrap('details-parallel', () => Promise.all([
      topBooks.length > 0
        ? supabase.from('books').select('id, title, slug').eq('is_gated', false).in('id', topBooks.map(c => Number(c.entity_id)))
        : Promise.resolve({ data: [] as { id: number; title: string; slug: string }[] }),
      topAuthors.length > 0
        ? supabase.from('authors').select('id, display_name, slug').in('id', topAuthors.map(c => Number(c.entity_id)))
        : Promise.resolve({ data: [] as { id: number; display_name: string; slug: string }[] }),
    ]))

    const bookMap = new Map((bookDetails ?? []).map(b => [b.id, b]))
    const authorMap = new Map((authorDetails ?? []).map(a => [a.id, a]))

    const bookEntries: RisingEntry[] = topBooks
      .map(c => {
        const id = Number(c.entity_id)
        const book = bookMap.get(id)
        if (!book?.slug) return null
        return { entityId: id, slug: book.slug, label: book.title, thisWeek: c.this_week, prevWeek: c.prev_week }
      })
      .filter((e): e is RisingEntry => e !== null)

    const authorEntries: RisingEntry[] = topAuthors
      .map(c => {
        const id = Number(c.entity_id)
        const a = authorMap.get(id)
        if (!a?.slug) return null
        return { entityId: id, slug: a.slug, label: a.display_name, thisWeek: c.this_week, prevWeek: c.prev_week }
      })
      .filter((e): e is RisingEntry => e !== null)

    timer.end('widget-fn-end')

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
        <p className="text-xs font-medium text-gray-500 mb-3">
          📈 Books gaining momentum
        </p>
        <ol className="space-y-1.5">
          {bookEntries.map((entry, i) => (
            <li key={entry.entityId} className="flex items-center gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-[11px] text-gray-500 flex items-center justify-center tabular-nums font-medium">
                {i + 1}
              </span>
              <Link
                href={`/books/${entry.slug}`}
                className="flex-1 min-w-0 truncate text-sm text-gray-800 hover:underline hover:text-brand transition-colors"
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
