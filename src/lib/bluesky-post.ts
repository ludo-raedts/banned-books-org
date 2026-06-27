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
// Trailing tag so each post is picked up by the BookSky feed (booksky.club),
// which aggregates posts containing 📚💙 (or #booksky). Counted in the limit.
const FEED_TAG = '\n\n📚💙'

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
 * Deterministically pick the book id for a day, skipping excluded books.
 * The k=0 index strides by a large prime so consecutive days land far apart in
 * the (id-ordered) pool. If that book is excluded, a second prime rerolls to
 * another book — so excluding one title only changes its own day, leaving the
 * rest of the queue stable. Falls back to the k=0 pick if everything is
 * excluded (shouldn't happen).
 */
function pickIdForDate(ids: number[], excluded: Set<number>, day: number): number {
  const n = ids.length
  for (let k = 0; k < n; k++) {
    const id = ids[((day * 7919 + k * 104729) % n + n) % n]
    if (!excluded.has(id)) return id
  }
  return ids[((day * 7919) % n + n) % n]
}

/** Book ids an editor has removed from the rotation. Empty if none / on error
 *  (incl. before the migration is applied), so posting never breaks. */
export async function loadExcludedIds(): Promise<Set<number>> {
  try {
    const { data, error } = await adminClient().from('bluesky_excluded_books').select('book_id')
    if (error || !data) return new Set()
    return new Set(data.map(r => Number((r as { book_id: number }).book_id)))
  } catch {
    return new Set()
  }
}

/** Today's UTC date as YYYY-MM-DD. */
function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Frozen picks for the given dates (date → book_id). The plan lives in
 * `bluesky_daily_picks`; once a date is frozen its pick never changes, even if
 * the eligible pool later shifts. Empty map on error / missing table, so the
 * picker falls back to the deterministic compute and nothing breaks before the
 * migration is applied.
 */
async function loadStoredPicks(datesYmd: string[]): Promise<Map<string, number>> {
  if (datesYmd.length === 0) return new Map()
  try {
    const { data, error } = await adminClient()
      .from('bluesky_daily_picks')
      .select('pick_date, book_id')
      .in('pick_date', datesYmd)
    if (error || !data) return new Map()
    return new Map(data.map(r => [(r as { pick_date: string }).pick_date, Number((r as { book_id: number }).book_id)]))
  } catch {
    return new Map()
  }
}

/**
 * Freeze picks (insert one row per date). `ignoreDuplicates` makes it a no-op
 * for dates already frozen, so concurrent renders can't clobber an existing
 * pick — the first writer wins. Best-effort: a failure (e.g. table not yet
 * migrated) is swallowed so it never breaks a render or a post.
 */
export async function freezePicks(rows: Array<{ pick_date: string; book_id: number; source?: string }>): Promise<void> {
  if (rows.length === 0) return
  try {
    await adminClient()
      .from('bluesky_daily_picks')
      .upsert(
        rows.map(r => ({ pick_date: r.pick_date, book_id: r.book_id, source: r.source ?? 'auto' })),
        { onConflict: 'pick_date', ignoreDuplicates: true },
      )
  } catch {
    /* non-fatal: freezing is best-effort */
  }
}

/**
 * Resolve the book id for each date: a frozen pick wins; otherwise compute the
 * deterministic pick and (for today/future dates) freeze it so it stays put.
 * Past dates that were never frozen are left unfrozen — we don't manufacture a
 * retroactive history. Returns ids aligned to the input dates plus the freshly
 * frozen rows (already written).
 */
async function resolvePickIds(
  datesYmd: string[],
  ids: number[],
  excluded: Set<number>,
  stored: Map<string, number>,
): Promise<number[]> {
  const today = todayUtcYmd()
  const toFreeze: Array<{ pick_date: string; book_id: number }> = []
  const chosen = datesYmd.map(ymd => {
    const frozen = stored.get(ymd)
    if (frozen != null) return frozen
    const id = pickIdForDate(ids, excluded, dayNumber(ymd))
    if (ymd >= today) toFreeze.push({ pick_date: ymd, book_id: id })
    return id
  })
  await freezePicks(toFreeze)
  return chosen
}

/**
 * Deterministic pick ids per date WITHOUT touching the frozen plan — used by the
 * backfill to compute the current rotation before pinning it. Returns date → id.
 */
export async function computePickIds(datesYmd: string[]): Promise<Map<string, number>> {
  const [ids, excluded] = await Promise.all([eligibleBookIds(), loadExcludedIds()])
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  for (const ymd of datesYmd) out.set(ymd, pickIdForDate(ids, excluded, dayNumber(ymd)))
  return out
}

// Notability gate: a book enters the pool if it has multiple recorded bans
// (MIN_BANS) OR at least one non-US ban. This drops the long tail of single-
// event US school removals (often niche/educational one-offs) while keeping
// every international case — even single-ban ones — so the feed stays globally
// varied rather than collapsing into US-only school-board bans (~91% if gated
// on ban count alone; ~58% US with this hybrid).
const MIN_BANS = 2

/** Fetch the eligible book ids (postable + grounded ban context), id-ordered. */
async function eligibleBookIds(): Promise<number[]> {
  const supabase = adminClient()
  const ids: number[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, book_authors!inner(author_id), bans(country_code)')
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`eligibleBookIds: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: number; bans: Array<{ country_code: string | null }> | null }>
    for (const r of rows) {
      const bans = r.bans ?? []
      const hasNonUs = bans.some(b => b.country_code && b.country_code !== 'US')
      if (bans.length >= MIN_BANS || hasNonUs) ids.push(Number(r.id))
    }
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
  const [ids, excluded, stored] = await Promise.all([
    eligibleBookIds(),
    loadExcludedIds(),
    loadStoredPicks(datesYmd),
  ])
  if (ids.length === 0) return datesYmd.map(() => null)
  const chosen = await resolvePickIds(datesYmd, ids, excluded, stored)
  return Promise.all(chosen.map(id => hydrate(id)))
}

/** Excluded books with display fields, newest exclusion first — for the admin view. */
export async function listExcludedBooks(): Promise<Array<{ id: number; title: string; author: string }>> {
  const { data, error } = await adminClient()
    .from('bluesky_excluded_books')
    .select('book_id, books(title, book_authors(authors(display_name)))')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.flatMap(r => {
    const row = r as unknown as { book_id: number; books: { title: string; book_authors: Array<{ authors: { display_name: string } | null }> | null } | null }
    if (!row.books) return []
    const author = row.books.book_authors?.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') || 'Unknown'
    return [{ id: Number(row.book_id), title: row.books.title, author }]
  })
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
  const head = '📚 Banned book of the day'

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

  // The "Banned for …" line. An empty sliced reason list (e.g. maxReasons=0 or
  // a book with no reason links) falls through to the reason-less form rather
  // than emitting a dangling "Banned for  in …".
  const whyLineFor = (maxReasons: number, withBanClause: boolean, useNamed: boolean): string => {
    const countryClause = useNamed ? namedClause : countedClause
    const picked = reasonLabels.slice(0, maxReasons)
    if (picked.length > 0) return `\n\nBanned for ${joinReasons(picked)}${countryClause}${withBanClause ? banClause : ''}.`
    if (countryClause) return `\n\nBanned${countryClause}${withBanClause ? banClause : ''}.`
    return ''
  }
  const compose = (titleLine: string, why: string): string => `${head}\n\n${titleLine}${why}\n\n${display}${FEED_TAG}`

  const fullTitleLine = `${book.title} — ${book.author}${yearPart}`

  // Step down detail until it fits: named countries → counted → fewer reasons
  // → drop ban count.
  let why = whyLineFor(3, true, true)
  for (const [n, ban, named_] of [[3, true, true], [2, true, true], [3, true, false], [2, true, false], [1, true, false], [1, false, false], [0, false, false]] as Array<[number, boolean, boolean]>) {
    why = whyLineFor(n, ban, named_)
    if (graphemeLength(compose(fullTitleLine, why)) <= MAX_GRAPHEMES) break
  }

  // Hard guarantee: if a very long title/slug still blows the limit (the fixed
  // URL + tag can't be trimmed), truncate the title line with an ellipsis. The
  // full title remains on the linked page and the card.
  let titleLine = fullTitleLine
  if (graphemeLength(compose(titleLine, why)) > MAX_GRAPHEMES) {
    const budget = MAX_GRAPHEMES - graphemeLength(compose('', why))
    const chars = Array.from(fullTitleLine)
    titleLine = budget > 1 ? chars.slice(0, budget - 1).join('').trimEnd() + '…' : chars.slice(0, 1).join('')
  }
  const text = compose(titleLine, why)

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
