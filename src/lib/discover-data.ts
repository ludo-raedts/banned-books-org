import { adminClient } from './supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'
import { genreLabel, isMappedGenre } from '@/components/genre-badge'
import {
  ICONIC_BOOK_SLUGS,
  GENRE_ALIASES,
  GENRE_BLOCKLIST,
  type DiscoverCandidate,
} from './discover-engine'

export type DiscoverReason = {
  slug: string
  label: string
  icon: string
}

export type DiscoverCountry = {
  code: string
  name: string
}

export type DiscoverGenre = {
  slug: string
  label: string
}

export type DiscoverData = {
  reasons: DiscoverReason[]
  countries: DiscoverCountry[]
  genres: DiscoverGenre[]
  candidates: DiscoverCandidate[]
}

export async function loadDiscoverData(): Promise<DiscoverData> {
  const supabase = adminClient()

  const [{ data: reasonRows }, { data: countryRows }, { data: mvRows }] = await Promise.all([
    supabase.from('reasons').select('slug').order('slug'),
    supabase.from('countries').select('code, name_en').order('name_en'),
    supabase.from('mv_reason_top_books').select('reason_slug, book_id, ban_count'),
  ])

  const activeReasons = new Set((mvRows ?? []).map(r => r.reason_slug as string))

  const reasons: DiscoverReason[] = (reasonRows ?? [])
    .map(r => ({
      slug: r.slug as string,
      label: reasonLabel(r.slug as string),
      icon: reasonIcon(r.slug as string),
    }))
    .filter(r => activeReasons.has(r.slug))

  const countries: DiscoverCountry[] = (countryRows ?? [])
    .filter(c => c.name_en && !['SU', 'CS', 'DD', 'YU'].includes(c.code as string))
    .map(c => ({ code: c.code as string, name: c.name_en as string }))

  // Build the candidate-pool descriptor map first so we can ship the
  // (reason_slug → ban_count) mapping along with each book.
  type Pending = { reasonBanCounts: Record<string, number> }
  const pending = new Map<number, Pending>()
  for (const row of mvRows ?? []) {
    const bookId = row.book_id as number
    const slug = row.reason_slug as string
    const ban = row.ban_count as number
    const p = pending.get(bookId)
    if (p) {
      p.reasonBanCounts[slug] = Math.max(p.reasonBanCounts[slug] ?? 0, ban)
    } else {
      pending.set(bookId, { reasonBanCounts: { [slug]: ban } })
    }
  }

  const bookIds = [...pending.keys()]
  const [{ data: books }, readingClubIds] = await Promise.all([
    bookIds.length
      ? supabase
          .from('books')
          .select(`
            id, title, slug, cover_url, genres,
            book_authors(authors(display_name)),
            bans(country_code)
          `)
          .in('id', bookIds)
      : Promise.resolve({ data: [] as unknown[] }),
    collectReadingClubGuideBookIds(supabase),
  ])

  const candidates: DiscoverCandidate[] = []
  for (const b of (books ?? []) as unknown as Array<{
    id: number
    title: string
    slug: string
    cover_url: string | null
    genres: string[] | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
    bans: Array<{ country_code: string }> | null
  }>) {
    const p = pending.get(b.id)
    if (!p) continue
    const author = (b.book_authors ?? [])
      .map(ba => ba.authors?.display_name)
      .find((n): n is string => Boolean(n)) ?? 'Unknown'
    const banCountries = Array.from(new Set((b.bans ?? []).map(x => x.country_code)))
    candidates.push({
      bookId: b.id,
      slug: b.slug,
      title: b.title,
      author,
      coverUrl: b.cover_url,
      genres: b.genres ?? [],
      banCountries,
      isIconic: ICONIC_BOOK_SLUGS.has(b.slug),
      hasReadingClubGuide: readingClubIds.has(b.id),
      reasonBanCounts: p.reasonBanCounts,
    })
  }

  const genres = collectDiscoverGenres(candidates)

  return { reasons, countries, genres, candidates }
}

// Books with a published reading-club PDF: union of book_ids across the
// five reading_club_* tables where discussion_questions is non-empty AND
// the row is published. Young-readers uses two question columns; either
// one being non-empty counts.
async function collectReadingClubGuideBookIds(
  supabase: ReturnType<typeof adminClient>,
): Promise<Set<number>> {
  const ids = new Set<number>()

  // Tables with a single `discussion_questions` column.
  for (const table of [
    'reading_club_theme_books',
    'reading_club_classics',
    'reading_club_international',
    'reading_club_currently_challenged',
  ] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('book_id, discussion_questions, published_at')
      .not('discussion_questions', 'is', null)
      .not('published_at', 'is', null)
    if (error) continue
    for (const row of (data ?? []) as Array<{ book_id: number | null; discussion_questions: string[] | null }>) {
      if (row.book_id == null) continue
      if (Array.isArray(row.discussion_questions) && row.discussion_questions.length > 0) {
        ids.add(row.book_id)
      }
    }
  }

  // Young-readers has two question columns (book + ban).
  const { data: yr, error: yrErr } = await supabase
    .from('reading_club_young_readers')
    .select('book_id, discussion_questions_book, discussion_questions_ban, published_at')
    .not('published_at', 'is', null)
  if (!yrErr) {
    for (const row of (yr ?? []) as Array<{
      book_id: number | null
      discussion_questions_book: string[] | null
      discussion_questions_ban: string[] | null
    }>) {
      if (row.book_id == null) continue
      const hasBook = Array.isArray(row.discussion_questions_book) && row.discussion_questions_book.length > 0
      const hasBan = Array.isArray(row.discussion_questions_ban) && row.discussion_questions_ban.length > 0
      if (hasBook || hasBan) ids.add(row.book_id)
    }
  }

  return ids
}

function collectDiscoverGenres(candidates: DiscoverCandidate[]): DiscoverGenre[] {
  const counts = new Map<string, number>()
  for (const c of candidates) {
    for (const slug of c.genres) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }

  const aliasToCanonical = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(GENRE_ALIASES)) {
    for (const a of aliases) aliasToCanonical.set(a, canonical)
  }

  const folded = new Map<string, number>()
  for (const [slug, n] of counts) {
    const canonical = aliasToCanonical.get(slug) ?? slug
    if (GENRE_BLOCKLIST.has(canonical)) continue
    folded.set(canonical, (folded.get(canonical) ?? 0) + n)
  }

  return [...folded.entries()]
    .filter(([slug]) => isMappedGenre(slug))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([slug]) => ({ slug, label: genreLabel(slug) }))
}
