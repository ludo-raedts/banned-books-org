// Self-contained server-component wrapper around <HighlightsStrip>. Fetches
// the most-banned / trending / all-time book + author "top-1" picks and
// renders the strip. Designed to be dropped in below other content on a
// page (currently /stats) without forcing the host page to deal with the
// dedupe + view-lookup logic. Returns null if no data is available so the
// page degrades cleanly.

import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import HighlightsStrip, {
  type HighlightItem,
  type HighlightSlot,
  type AuthorHighlightItem,
} from './highlights-strip'
import type { Book } from './book-browser'

const FULL_SELECT = `
  id, title, slug, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
  book_authors(authors(display_name)),
  bans(
    id, status, country_code, year_started,
    countries(name_en),
    scopes(slug, label_en),
    ban_reason_links(reasons(slug))
  )
`

export default async function HighlightsStripBlock() {
  const timer = newTimer('highlights-strip-block')
  const supabase = adminClient()

  try {
    const [
      topBannedRes,
      trendingRes,
      allTimeRes,
      bannedAuthorsRes,
      trendingAuthorsRes,
      allTimeAuthorsRes,
      placeholderAuthorsRes,
    ] = await timer.wrap('parallel-7', () =>
      Promise.all([
        supabase.from('v_top_banned_books').select('entity_id, total_bans').limit(1),
        supabase.from('v_top_books_this_week').select('entity_id, views').limit(1),
        supabase.from('v_top_books_all_time').select('entity_id, views').limit(1),
        supabase.from('v_top_banned_authors').select('entity_id, total_bans, banned_books').limit(10),
        supabase.from('v_top_authors_this_week').select('entity_id, views').limit(10),
        supabase.from('v_top_authors_all_time').select('entity_id, views').limit(10),
        supabase.from('authors').select('id').eq('is_placeholder', true),
      ]),
    )

    const placeholderIds = new Set(((placeholderAuthorsRes.data ?? []) as { id: number }[]).map(a => a.id))
    const isAuthorOk = (id: number) => !placeholderIds.has(id)

    // ── Book IDs (top-1 per slot) ──────────────────────────────────────────
    const topBannedRow = (topBannedRes.data ?? [])[0] as { entity_id: number; total_bans: number } | undefined
    const trendingRow = (trendingRes.data ?? [])[0] as { entity_id: number } | undefined
    const allTimeRow = (allTimeRes.data ?? [])[0] as { entity_id: number } | undefined

    const used = new Set<number>()
    const bookSlots: { slot: HighlightSlot; id: number; context: string }[] = []
    if (topBannedRow) {
      const id = Number(topBannedRow.entity_id)
      used.add(id)
      bookSlots.push({ slot: 'most-banned', id, context: '' })
    }
    if (trendingRow) {
      const id = Number(trendingRow.entity_id)
      if (!used.has(id)) {
        used.add(id)
        bookSlots.push({ slot: 'trending', id, context: '' })
      }
    }
    if (allTimeRow) {
      const id = Number(allTimeRow.entity_id)
      if (!used.has(id)) {
        used.add(id)
        bookSlots.push({ slot: 'all-time', id, context: '' })
      }
    }

    const bookIds = bookSlots.map(s => s.id)
    const { data: booksRaw } = bookIds.length > 0
      ? await timer.wrap('books', () =>
          supabase.from('books').select(FULL_SELECT).in('id', bookIds),
          { ids: bookIds.length },
        )
      : { data: null }
    const bookById = new Map(((booksRaw ?? []) as unknown as Book[]).map(b => [b.id, b]))

    const items: HighlightItem[] = bookSlots
      .map(s => {
        const book = bookById.get(s.id)
        if (!book) return null
        let context = ''
        if (s.slot === 'most-banned' && topBannedRow) {
          const countries = new Set(book.bans.map(x => x.country_code)).size
          context = `${book.bans.length} ${book.bans.length === 1 ? 'ban' : 'bans'} across ${countries} ${countries === 1 ? 'country' : 'countries'}`
        }
        return { slot: s.slot, book, context }
      })
      .filter((x): x is HighlightItem => x !== null)

    // ── Author IDs (top-1 per slot, skipping placeholders + dupes) ────────
    const usedAuthors = new Set<number>()
    const findAuthor = <T extends { entity_id: number }>(rows: T[]): T | null => {
      for (const r of rows) {
        const id = Number(r.entity_id)
        if (isAuthorOk(id) && !usedAuthors.has(id)) {
          usedAuthors.add(id)
          return r
        }
      }
      return null
    }

    const bannedAuthor = findAuthor(
      (bannedAuthorsRes.data ?? []) as { entity_id: number; total_bans: number; banned_books: number }[],
    )
    const trendingAuthor = findAuthor(
      (trendingAuthorsRes.data ?? []) as { entity_id: number; views: number }[],
    )
    const allTimeAuthor = findAuthor(
      (allTimeAuthorsRes.data ?? []) as { entity_id: number; views: number }[],
    )

    const authorIdSet = new Set<number>()
    if (bannedAuthor) authorIdSet.add(Number(bannedAuthor.entity_id))
    if (trendingAuthor) authorIdSet.add(Number(trendingAuthor.entity_id))
    if (allTimeAuthor) authorIdSet.add(Number(allTimeAuthor.entity_id))

    const { data: authorsRaw } = authorIdSet.size > 0
      ? await timer.wrap('authors', () =>
          supabase.from('authors').select('id, display_name, slug, photo_url').in('id', [...authorIdSet]),
          { ids: authorIdSet.size },
        )
      : { data: null }
    const authorById = new Map(
      ((authorsRaw ?? []) as { id: number; display_name: string; slug: string; photo_url: string | null }[])
        .map(a => [a.id, a]),
    )

    const authorItems: AuthorHighlightItem[] = []
    if (bannedAuthor) {
      const a = authorById.get(Number(bannedAuthor.entity_id))
      if (a) {
        const totalBans = Number((bannedAuthor as { total_bans: number }).total_bans)
        const banBooks = Number((bannedAuthor as { banned_books: number }).banned_books)
        authorItems.push({
          slot: 'most-banned',
          author: a,
          context: `${totalBans.toLocaleString('en')} ${totalBans === 1 ? 'ban' : 'bans'} across ${banBooks} ${banBooks === 1 ? 'book' : 'books'}`,
        })
      }
    }
    if (trendingAuthor) {
      const a = authorById.get(Number(trendingAuthor.entity_id))
      if (a) authorItems.push({ slot: 'trending', author: a, context: '' })
    }
    if (allTimeAuthor) {
      const a = authorById.get(Number(allTimeAuthor.entity_id))
      if (a) authorItems.push({ slot: 'all-time', author: a, context: '' })
    }

    timer.end()

    if (items.length === 0 && authorItems.length === 0) return null

    return <HighlightsStrip items={items} authorItems={authorItems} />
  } catch {
    return null
  }
}
