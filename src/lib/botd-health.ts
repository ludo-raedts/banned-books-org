/**
 * botd-health.ts — shared data-health checks for the book-of-the-day picks.
 *
 * The SAME gap definitions power two surfaces, so they never drift:
 *   - scripts/audit-botd-week.ts (the weekly CLI pre-flight the /botd-week
 *     skill runs), and
 *   - /admin/bluesky "Upcoming" list, which shows a live health badge per pick.
 *
 * Health is computed live from the books/authors rows — there is no separate
 * "checked by the pre-flight agent" flag in the DB. That is deliberate: a book
 * whose gaps are all closed IS what the pre-flight produces, so a "ready" badge
 * means "nothing left for the pre-flight to fix" and can never go stale or lie.
 */

// The importer's placeholder bio ("… Their work has been subject to censorship
// or banning challenges.") and anything about this short is not a real bio.
const TEMPLATE_BIO_MARKER = 'subject to censorship or banning challenges'
export const THIN_BIO_CHARS = 200
export const THIN_DESC_CHARS = 80

export type AuthorHealthRow = {
  id: number
  slug: string
  display_name: string
  bio: string | null
  bio_source_type: string | null
  photo_url: string | null
  wikidata_id: string | null
  website_url: string | null
  social_links: Record<string, string> | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  links_checked_at: string | null
  is_placeholder: boolean | null
}

export type BookHealthRow = {
  id: number
  title: string
  slug: string
  first_published_year: number | null
  cover_url: string | null
  description_book: string | null
  description_ban: string | null
  description_source_type: string | null
  genres: string[] | null
  bookshop_isbn13: string | null
  isbn13: string | null
  book_authors: Array<{ authors: AuthorHealthRow | null }> | null
}

/** PostgREST select that hydrates every field the gap checks below read. */
export const BOOK_HEALTH_SELECT =
  'id, title, slug, first_published_year, cover_url, description_book, description_ban, ' +
  'description_source_type, genres, bookshop_isbn13, isbn13, ' +
  'book_authors(authors(id, slug, display_name, bio, bio_source_type, photo_url, wikidata_id, ' +
  'website_url, social_links, birth_year, birth_month, birth_day, links_checked_at, is_placeholder))'

export function bookGaps(b: BookHealthRow): string[] {
  const gaps: string[] = []
  if (!b.cover_url) gaps.push('cover_url MISSING')
  const desc = b.description_book
  if (!desc) gaps.push('description MISSING (description_book null)')
  else if (desc.length < THIN_DESC_CHARS) gaps.push(`description THIN (${desc.length} chars)`)
  if (!b.description_ban) gaps.push('description_ban MISSING')
  else if (b.description_ban.length < THIN_DESC_CHARS) gaps.push(`description_ban THIN (${b.description_ban.length} chars)`)
  if (desc && !b.description_source_type) gaps.push('description UNSTAMPED (description_source_type null)')
  if (b.first_published_year == null) gaps.push('first_published_year NULL')
  if (!b.genres || b.genres.length === 0) gaps.push('genres EMPTY')
  if (!b.bookshop_isbn13 && !b.isbn13) gaps.push('no ISBN (bookshop_isbn13 + isbn13 null → no buy links)')
  return gaps
}

export function authorGaps(a: AuthorHealthRow): string[] {
  const gaps: string[] = []
  if (a.is_placeholder) gaps.push('IS_PLACEHOLDER (skip enrichment)')
  if (!a.bio) gaps.push('bio MISSING')
  else if (a.bio.includes(TEMPLATE_BIO_MARKER)) gaps.push('bio TEMPLATE (importer placeholder)')
  else if (a.bio.length < THIN_BIO_CHARS) gaps.push(`bio THIN (${a.bio.length} chars)`)
  if (a.bio && !a.bio_source_type) gaps.push('bio UNSTAMPED (bio_source_type null)')
  if (!a.photo_url) gaps.push('photo_url MISSING')
  if (!a.wikidata_id) gaps.push('wikidata_id MISSING')
  if (!a.website_url && !a.social_links) gaps.push('links MISSING (website_url + social_links null)')
  if (a.links_checked_at == null) gaps.push('links UNPROBED (links_checked_at null)')
  if (a.birth_year == null) gaps.push('birth_year NULL')
  else if (a.birth_month == null || a.birth_day == null) gaps.push('birth_month/day NULL (no birthday feature)')
  return gaps
}
