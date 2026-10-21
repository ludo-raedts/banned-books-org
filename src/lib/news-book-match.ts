// Targeted cache bust for the "in the news" block on book pages.
//
// books/[slug] runs on a 7-day ISR window and reads its news through ONE
// shared Data Cache entry (loadPublishedNews in book-relations.ts, tag
// 'news-items'). Busting that tag would mark every book page stale at once —
// a route-wide (soft) bust, which on a crawler-swept catalogue means ~20k
// background regenerations. Instead, after news lands we work out which books
// the new items actually mention and revalidatePath() only those pages. When
// such a page regenerates, Next checks the shared news entry against the
// page's soft (path) tags and refetches it, so the block is fresh for exactly
// the books that changed and nobody else pays.
//
// The match rule mirrors findNewsForTitles(): every title variant, trimmed,
// lower-cased, ≥ 4 chars, as a case-insensitive substring of title + summary.
import { revalidatePath } from 'next/cache'
import { adminClient } from './supabase'

export type NewsMention = { title: string; summary: string | null }

type BookTitleRow = {
  slug: string | null
  title: string | null
  title_english_meaningful: string | null
  title_native: string | null
  title_transliterated: string | null
}

// Paginated with an explicit order: a plain select caps at 1000 rows, and
// .range() without .order() repeats rows past the page size.
const PAGE = 1000

/** Slugs of the books whose title variants appear in any of `items`. */
export async function bookSlugsMentionedIn(items: NewsMention[]): Promise<string[]> {
  const haystacks = items.map(i => `${i.title}\n${i.summary ?? ''}`.toLowerCase())
  if (haystacks.length === 0) return []

  const sb = adminClient()
  const out: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('slug, title, title_english_meaningful, title_native, title_transliterated')
      .not('slug', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`books page @${from}: ${error.message}`)
    const rows = (data ?? []) as BookTitleRow[]
    for (const r of rows) {
      if (!r.slug) continue
      const needles = [r.title, r.title_english_meaningful, r.title_native, r.title_transliterated]
        .map(t => (t ?? '').trim().toLowerCase())
        .filter(t => t.length >= 4)
      if (needles.length === 0) continue
      if (haystacks.some(h => needles.some(n => h.includes(n)))) out.push(r.slug)
    }
    if (rows.length < PAGE) break
  }
  return [...new Set(out)]
}

/**
 * revalidatePath() the book pages that mention any of `items`. Returns how
 * many pages were busted. Call from a Route Handler or Server Action only.
 */
export async function bustBookPagesForNews(items: NewsMention[]): Promise<number> {
  const slugs = await bookSlugsMentionedIn(items)
  for (const slug of slugs) revalidatePath(`/books/${slug}`)
  return slugs.length
}
