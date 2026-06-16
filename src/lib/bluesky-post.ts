// Picks the daily "banned book of the day" for Bluesky and builds the post
// payload (text + richtext link facet + external link card).
//
// Pool: deliberately NOT the homepage's book-of-the-day pool. That one draws
// from `v_top_banned_books`, which is a top-100 view — only ~96 books survive
// its synopsis/Latin-script filter, so a daily feed would repeat every ~3
// months and only ever show canonical giants (1984, Lolita, …). Here we draw
// from the full catalogue of postable books (~8.6k), so the feed never repeats
// within ~20 years and surfaces lesser-known bans.
//
// Text doctrine: built from RELIABLE structured fields only (title, author,
// year, reason labels, ban/country counts). We do NOT use `description_book`
// (the synopsis) — it suffers from title-collision contamination (a banned
// title can carry a different work's synopsis). No generative AI: zero
// confabulation risk.

import { adminClient } from './supabase'
import { LATIN_SCRIPT_LANGS } from './top-list-data'

const SITE = 'https://www.banned-books.org'
const MAX_GRAPHEMES = 300 // Bluesky's hard post limit

// Reason slug → label, mirroring the `reasons.label_en` column. Hardcoded so
// the picker needs no extra round-trip; keep in sync if labels change.
const REASON_LABELS: Record<string, string> = {
  drugs: 'drug use',
  language: 'offensive language',
  lgbtq: 'LGBTQ+ content',
  moral: 'immorality',
  obscenity: 'obscenity',
  other: 'unspecified reasons',
  political: 'political content',
  racial: 'race / colonialism',
  religious: 'religious or blasphemous content',
  sexual: 'sexual content',
  violence: 'violence',
}

export type DailyBook = {
  id: number
  title: string
  slug: string
  author: string
  year: number | null
  coverUrl: string | null
  descriptionBan: string | null
  reasons: string[]
  /** Distinct country names (name_en), for naming them when few enough. */
  countries: string[]
  countryCount: number
  banCount: number
}

/**
 * Prefix the definite article for country names that take "the" in English
 * ("the United States", "the Netherlands"). Most names don't ("France").
 */
function withArticle(name: string): string {
  return /\b(United|Republic|Kingdom|Emirates|Netherlands|Philippines|Islands?|Bahamas|Gambia|Congo|Comoros|Maldives|Sudan)\b/.test(name)
    ? `the ${name}`
    : name
}

/** Stable day index since the Unix epoch for a given YYYY-MM-DD date string. */
export function dayNumber(dateYmd: string): number {
  return Math.floor(Date.parse(`${dateYmd}T00:00:00Z`) / 86_400_000)
}

/**
 * Deterministically pick the book id for a given day from the eligible pool.
 * Striding by a large prime spreads consecutive days across the (id-ordered)
 * pool so adjacent days don't land on adjacent import rows. Coprime with any
 * realistic pool size, so it walks the whole pool before repeating.
 */
function pickIndex(day: number, poolSize: number): number {
  return ((day * 7919) % poolSize + poolSize) % poolSize
}

/** Fetch the eligible book ids (postable + grounded ban context), id-ordered. */
async function eligibleBookIds(): Promise<number[]> {
  const supabase = adminClient()
  const ids: number[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, original_language, book_authors!inner(author_id)')
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`eligibleBookIds: ${error.message}`)
    const rows = data ?? []
    for (const r of rows) ids.push(Number((r as { id: number }).id))
    if (rows.length < PAGE) break
  }
  // Dedup: the !inner join multiplies rows for multi-author books.
  return [...new Set(ids)].sort((a, b) => a - b)
}

type RichRow = {
  id: number
  title: string
  slug: string
  first_published_year: number | null
  cover_url: string | null
  description_ban: string | null
  book_authors: Array<{ authors: { display_name: string } | null }> | null
  bans: Array<{ country_code: string | null; ban_reason_links: Array<{ reasons: { slug: string } | null }> | null }> | null
}

/** Hydrate one chosen book with the fields the post needs. */
async function hydrate(id: number): Promise<DailyBook | null> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('books')
    .select(
      'id, title, slug, first_published_year, cover_url, description_ban, ' +
        'book_authors(authors(display_name)), ' +
        'bans(country_code, ban_reason_links(reasons(slug)))',
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as RichRow
  const author = row.book_authors?.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') || 'Unknown'
  const bans = row.bans ?? []
  const codes = [...new Set(bans.map(b => b.country_code).filter((c): c is string => !!c))]
  const reasons = new Set<string>()
  for (const b of bans) for (const l of b.ban_reason_links ?? []) if (l.reasons?.slug) reasons.add(l.reasons.slug)

  // Resolve country codes → English names (one cheap lookup for the few codes
  // on this book). Falls back to the raw code if a name is missing.
  let countries: string[] = codes
  if (codes.length > 0) {
    const { data: cRows } = await supabase.from('countries').select('code, name_en').in('code', codes)
    const nameByCode = new Map((cRows ?? []).map(c => [(c as { code: string }).code, (c as { name_en: string }).name_en]))
    countries = codes.map(c => nameByCode.get(c) ?? c)
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    author,
    year: row.first_published_year,
    coverUrl: row.cover_url,
    descriptionBan: row.description_ban,
    reasons: [...reasons],
    countries,
    countryCount: codes.length,
    banCount: bans.length,
  }
}

/** Pick the book of the day for the given date (defaults to today, UTC). */
export async function pickDailyBook(dateYmd?: string): Promise<DailyBook | null> {
  const ymd = dateYmd ?? new Date().toISOString().slice(0, 10)
  return (await pickForDates([ymd]))[0]
}

/**
 * Pick the book for several dates at once — fetches the eligible-id list a
 * single time and hydrates each day's pick (cheap vs. one id-scan per date).
 * Used by the admin "upcoming" view. Returns one entry per input date, in order.
 */
export async function pickForDates(datesYmd: string[]): Promise<(DailyBook | null)[]> {
  const ids = await eligibleBookIds()
  if (ids.length === 0) return datesYmd.map(() => null)
  return Promise.all(datesYmd.map(ymd => hydrate(ids[pickIndex(dayNumber(ymd), ids.length)])))
}

function graphemeLength(s: string): number {
  return Array.from(s).length
}

/** Human list join: "a", "a and b", "a, b and c". */
function joinReasons(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export type BuiltPost = {
  text: string
  facet: { uri: string; display: string; byteStart: number; byteEnd: number }
  card: { uri: string; title: string; description: string; coverUrl: string | null }
}

/**
 * Build the post text, link facet, and link-card metadata for a book.
 * Trims the reason list (then drops the ban-count clause) until the whole post
 * fits inside Bluesky's 300-grapheme limit.
 */
export function buildPost(book: DailyBook): BuiltPost {
  // The clickable target (facet + card) carries UTM so Bluesky traffic is
  // attributable in our analytics; the displayed text stays clean (no query).
  const url = `${SITE}/books/${book.slug}?utm_source=bluesky&utm_medium=social&utm_campaign=book-of-the-day`
  const display = `banned-books.org/books/${book.slug}`
  const yearPart = book.year ? ` (${book.year})` : ''
  const head = `📚 Banned book of the day\n\n${book.title} — ${book.author}${yearPart}`

  const reasonLabels = book.reasons.map(s => REASON_LABELS[s] ?? s).filter(s => s !== 'unspecified reasons')

  // Counted form ("in 3 countries") and, when few enough, a named form ("in
  // the United States", "in France and Iran"). The named form is preferred but
  // falls back to counted when it would blow the 300-char budget.
  const countedClause =
    book.countryCount > 0 ? ` in ${book.countryCount} ${book.countryCount === 1 ? 'country' : 'countries'}` : ''
  const named = book.countries.map(withArticle)
  const namedClause =
    named.length === 1 ? ` in ${named[0]}`
      : named.length === 2 ? ` in ${named[0]} and ${named[1]}`
        : countedClause

  // Only surface the ban count when it tells you more than the country count
  // (i.e. multiple bans in the same place); otherwise it just echoes it.
  const banClause =
    book.banCount > book.countryCount
      ? ` · ${book.banCount.toLocaleString('en')} recorded ${book.banCount === 1 ? 'ban' : 'bans'}`
      : ''

  const assemble = (maxReasons: number, withBanClause: boolean, useNamed: boolean): string => {
    const countryClause = useNamed ? namedClause : countedClause
    let why = ''
    if (reasonLabels.length > 0) {
      why = `\n\nBanned for ${joinReasons(reasonLabels.slice(0, maxReasons))}${countryClause}${withBanClause ? banClause : ''}.`
    } else if (countryClause) {
      why = `\n\nBanned${countryClause}${withBanClause ? banClause : ''}.`
    }
    return `${head}${why}\n\n${display}`
  }

  // Step down detail until it fits: named countries → counted → fewer reasons
  // → drop ban count.
  let text = assemble(3, true, true)
  for (const [n, ban, named_] of [[3, true, true], [2, true, true], [3, true, false], [2, true, false], [1, true, false], [1, false, false], [0, false, false]] as Array<[number, boolean, boolean]>) {
    text = assemble(n, ban, named_)
    if (graphemeLength(text) <= MAX_GRAPHEMES) break
  }

  // Byte offsets of the display URL for the clickable richtext facet.
  const enc = new TextEncoder()
  const byteStart = enc.encode(text.slice(0, text.lastIndexOf(display))).length
  const byteEnd = byteStart + enc.encode(display).length

  const cardDesc = reasonLabels.length
    ? `Banned for ${joinReasons(reasonLabels.slice(0, 3))}. See the full censorship record.`
    : 'See the full censorship record.'

  return {
    text,
    facet: { uri: url, display, byteStart, byteEnd },
    card: { uri: url, title: `${book.title} by ${book.author}`, description: cardDesc.slice(0, 300), coverUrl: book.coverUrl },
  }
}
