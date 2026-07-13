/**
 * audit-botd-week.ts — weekly pre-flight for the upcoming book-of-the-day picks.
 *
 * Computes the picks for the next N days (default 8: today..+7) via the SAME
 * pickForDates() the /share hub and Bluesky bot use, then reports data gaps on
 * each picked book and its author(s): missing/thin descriptions, template bios,
 * missing socials/wikidata, missing buy links, etc. Report-only on the books
 * side — it writes nothing to books/authors.
 *
 * NOTE: not strictly side-effect-free — pickForDates() freezes today/future
 * picks into bluesky_daily_picks (source='auto', first writer wins), exactly
 * like opening the admin "upcoming" view. That is desirable here: the picks we
 * audit are guaranteed to be the picks that actually run.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/audit-botd-week.ts            # next 8 days
 *   pnpm tsx --env-file=.env.local scripts/audit-botd-week.ts --days=14
 *
 * Consumed by the /botd-week skill (.claude/skills/botd-week/SKILL.md), which
 * fixes the judgment-work gaps (bios, socials) one by one.
 */
import { adminClient } from '../src/lib/supabase'
import { pickForDates, dayNumber } from '../src/lib/bluesky-post'
import { intFlag } from './lib/cli'

const DAYS = intFlag('days', 8)

// The importer's placeholder bio ("… Their work has been subject to censorship
// or banning challenges.") and anything about this short is not a real bio.
const TEMPLATE_BIO_MARKER = 'subject to censorship or banning challenges'
const THIN_BIO_CHARS = 200
const THIN_DESC_CHARS = 80

type AuthorRow = {
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

type BookRow = {
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
  book_authors: Array<{ authors: AuthorRow | null }> | null
}

function bookGaps(b: BookRow): string[] {
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

function authorGaps(a: AuthorRow): string[] {
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

async function main() {
  const start = dayNumber(new Date().toISOString().slice(0, 10))
  const dates = Array.from({ length: DAYS }, (_, i) => new Date((start + i) * 86_400_000).toISOString().slice(0, 10))

  const picks = await pickForDates(dates)
  const sb = adminClient()

  console.log(`# Book-of-the-day pre-flight — ${dates[0]} … ${dates[dates.length - 1]}\n`)

  let clean = 0
  const seenBooks = new Set<number>()
  for (let i = 0; i < dates.length; i++) {
    const pick = picks[i]
    if (!pick) {
      console.log(`## ${dates[i]} — ⚠ NO PICK (empty eligible pool?)\n`)
      continue
    }
    const dup = seenBooks.has(pick.id)
    seenBooks.add(pick.id)

    const { data, error } = await sb
      .from('books')
      .select(
        'id, title, slug, first_published_year, cover_url, description_book, description_ban, ' +
          'description_source_type, genres, bookshop_isbn13, isbn13, ' +
          'book_authors(authors(id, slug, display_name, bio, bio_source_type, photo_url, wikidata_id, ' +
          'website_url, social_links, birth_year, birth_month, birth_day, links_checked_at, is_placeholder))',
      )
      .eq('id', pick.id)
      .single()
    if (error || !data) {
      console.log(`## ${dates[i]} — ⚠ hydrate failed for book id ${pick.id}: ${error?.message}\n`)
      continue
    }
    const book = data as unknown as BookRow
    const bGaps = bookGaps(book)
    const authors = (book.book_authors ?? []).map(ba => ba.authors).filter((a): a is AuthorRow => !!a)
    const aGaps = authors.map(a => ({ a, gaps: authorGaps(a) }))
    const totalGaps = bGaps.length + aGaps.reduce((n, x) => n + x.gaps.length, 0)

    const birthday = pick.birthday ? ` 🎂 birthday: ${pick.birthday.name}` : ''
    const header = `## ${dates[i]} — “${book.title}” by ${pick.author} (/books/${book.slug}, id ${book.id})${birthday}${dup ? ' ⚠ DUPLICATE within window' : ''}`

    if (totalGaps === 0) {
      clean++
      console.log(`${header}\n✓ clean (${pick.banCount} bans, ${pick.countryCount} countries)\n`)
      continue
    }
    console.log(header)
    console.log(`bans: ${pick.banCount} in ${pick.countryCount} countries — ${pick.countries.join(', ')}`)
    if (bGaps.length) console.log(`- BOOK: ${bGaps.join(' | ')}`)
    for (const { a, gaps } of aGaps) {
      if (gaps.length) console.log(`- AUTHOR ${a.display_name} (/authors/${a.slug}, id ${a.id}): ${gaps.join(' | ')}`)
      else console.log(`- AUTHOR ${a.display_name} (/authors/${a.slug}, id ${a.id}): ✓ clean`)
    }
    console.log('')
  }

  console.log(`---\n${clean}/${dates.length} picks fully clean.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
