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
  /** Set when this pick is a featured author's birthday — drives the 🎂 note. */
  birthday?: { name: string; bornYear: number | null } | null
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

// ── Birthday pushes ───────────────────────────────────────────────────────
// On a curated (birthday_featured) author's birthday we override that day's pick
// with one of their banned books, for topical relevance. The override lives in
// bluesky_daily_picks with source='birthday' (priority: manual > birthday >
// auto). See scripts/enrich-author-birthdays.ts for how the featured set is
// chosen and scripts/apply-birthday-picks.ts / the daily cron for pinning.

type FeaturedAuthor = { id: number; name: string; bornYear: number | null }

const mmdd = (month: number, day: number): string => `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Featured authors keyed by "MM-DD" birthday. Empty on error / missing column. */
export async function loadFeaturedBirthdays(): Promise<Map<string, FeaturedAuthor[]>> {
  const out = new Map<string, FeaturedAuthor[]>()
  try {
    const { data, error } = await adminClient()
      .from('authors')
      .select('id, display_name, birth_year, birth_month, birth_day')
      .eq('birthday_featured', true)
    if (error || !data) return out
    for (const r of data as Array<{ id: number; display_name: string; birth_year: number | null; birth_month: number | null; birth_day: number | null }>) {
      if (r.birth_month == null || r.birth_day == null) continue
      const key = mmdd(r.birth_month, r.birth_day)
      out.set(key, [...(out.get(key) ?? []), { id: Number(r.id), name: r.display_name, bornYear: r.birth_year }])
    }
  } catch {
    /* empty map → no birthday overrides */
  }
  return out
}

/** Case-insensitive: is `name` one of the (comma-joined) authors of `bookAuthor`? */
function authorInList(name: string, bookAuthor: string): boolean {
  const a = name.toLowerCase()
  const b = bookAuthor.toLowerCase()
  return b.includes(a) || a.includes(b)
}

/** The author's most-banned postable book id (same gate as the rotation), or null. */
export async function bestPostableBookForAuthor(authorId: number): Promise<number | null> {
  const { data, error } = await adminClient()
    .from('books')
    .select('id, bans(country_code), book_authors!inner(author_id)')
    .eq('book_authors.author_id', authorId)
    .eq('is_gated', false)
    .eq('is_blanket_works', false)
    .not('cover_url', 'is', null)
    .not('description_ban', 'is', null)
    .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
  if (error || !data) return null
  let best: { id: number; bans: number } | null = null
  for (const r of data as Array<{ id: number; bans: Array<{ country_code: string | null }> | null }>) {
    const bans = r.bans ?? []
    const hasNonUs = bans.some(b => b.country_code && b.country_code !== 'US')
    if (!(bans.length >= MIN_BANS || hasNonUs)) continue
    if (!best || bans.length > best.bans) best = { id: Number(r.id), bans: bans.length }
  }
  return best?.id ?? null
}

/** Attach birthday context to a hydrated pick when its date is a featured
 *  author's birthday AND that author actually wrote the picked book (guards
 *  against a manual override having swapped in a different author's book). */
function attachBirthday(book: DailyBook | null, ymd: string, featured: Map<string, FeaturedAuthor[]>): DailyBook | null {
  if (!book) return book
  const authors = featured.get(ymd.slice(5))
  if (!authors) return book
  const match = authors.find(a => authorInList(a.name, book.author))
  if (match) book.birthday = { name: match.name, bornYear: match.bornYear }
  return book
}

/**
 * Pin featured-author birthdays across a rolling window (default ~13 months) so
 * the override is "live" immediately and stays ahead of the lazy auto-freeze.
 * Overwrites auto picks on birthday dates, never touches a manual override, and
 * clears stale birthday rows (e.g. an author that was un-featured) so they fall
 * back to the deterministic rotation. Idempotent — safe to run daily (cron).
 */
export async function planBirthdayPicks(windowDays = 400): Promise<{ pinned: number; cleared: number }> {
  const featured = await loadFeaturedBirthdays()
  const start = dayNumber(todayUtcYmd())
  const dates = Array.from({ length: windowDays }, (_, i) => new Date((start + i) * 86_400_000).toISOString().slice(0, 10))

  const { data: existing } = await adminClient().from('bluesky_daily_picks').select('pick_date, source').in('pick_date', dates)
  const srcByDate = new Map((existing ?? []).map(r => [(r as { pick_date: string }).pick_date, (r as { source: string }).source]))

  const bookCache = new Map<number, number | null>()
  const toPin: Array<{ pick_date: string; book_id: number; source: string }> = []
  const toClear: string[] = []
  for (const ymd of dates) {
    const authors = featured.get(ymd.slice(5))
    const src = srcByDate.get(ymd)
    if (authors?.length) {
      if (src === 'manual') continue // editor override always wins
      let bookId: number | null = null
      for (const a of authors) {
        if (!bookCache.has(a.id)) bookCache.set(a.id, await bestPostableBookForAuthor(a.id))
        const bid = bookCache.get(a.id) ?? null
        if (bid != null) { bookId = bid; break }
      }
      if (bookId != null) toPin.push({ pick_date: ymd, book_id: bookId, source: 'birthday' })
    } else if (src === 'birthday') {
      toClear.push(ymd) // no longer a featured birthday → revert to auto
    }
  }

  if (toPin.length) await adminClient().from('bluesky_daily_picks').upsert(toPin, { onConflict: 'pick_date' })
  if (toClear.length) await adminClient().from('bluesky_daily_picks').delete().in('pick_date', toClear)
  return { pinned: toPin.length, cleared: toClear.length }
}

// Notability gate: a book enters the pool if it has multiple recorded bans
// (MIN_BANS) OR at least one non-US ban. This drops the long tail of single-
// event US school removals (often niche/educational one-offs) while keeping
// every international case — even single-ban ones — so the feed stays globally
// varied rather than collapsing into US-only school-board bans (~91% if gated
// on ban count alone; ~58% US with this hybrid).
const MIN_BANS = 2

/** Fetch the eligible book ids (postable + grounded ban context), id-ordered.
 *
 * Split into three light queries instead of one per-book `bans` embed paginated
 * across ~20 pages. The embed was ~2s/page and, run concurrently by 3 build
 * workers for the homepage / /share / /embed / badge, saturated Supabase and
 * tripped the statement timeout (57014) at prerender. Now: (1) paginate
 * candidate ids with column filters only — no embed; (2) batch total_bans from
 * v_book_ban_counts; (3) batch the has-a-non-US-ban set. keep = total_bans >=
 * MIN_BANS OR has-non-US — byte-identical to the old row-by-row predicate.
 * The old `book_authors!inner` filter is dropped: every book has >=1 author
 * (audit-integrity invariant), so it only ever multiplied rows (hence the
 * dedup this version no longer needs). */
async function eligibleBookIds(): Promise<number[]> {
  const supabase = adminClient()

  // 1. Candidate ids — column filters only, id-ordered, no embed.
  const candidates: number[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`eligibleBookIds: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: number }>
    candidates.push(...rows.map(r => Number(r.id)))
    if (rows.length < PAGE) break
  }

  // 2 & 3. Ban signals, batched over the candidate ids (v_book_ban_counts for
  //        the total, a country_code<>'US' scan for the non-US flag).
  const banCount = new Map<number, number>()
  const hasNonUs = new Set<number>()
  const BATCH = 1000
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH)
    const [counts, nonUs] = await Promise.all([
      supabase.from('v_book_ban_counts').select('entity_id, total_bans').in('entity_id', slice),
      supabase.from('bans').select('book_id').in('book_id', slice).neq('country_code', 'US'),
    ])
    if (counts.error) throw new Error(`eligibleBookIds counts: ${counts.error.message}`)
    if (nonUs.error) throw new Error(`eligibleBookIds non-us: ${nonUs.error.message}`)
    for (const r of (counts.data ?? []) as Array<{ entity_id: number; total_bans: number }>) {
      banCount.set(Number(r.entity_id), r.total_bans)
    }
    for (const r of (nonUs.data ?? []) as Array<{ book_id: number }>) hasNonUs.add(Number(r.book_id))
  }

  // keep = >= MIN_BANS bans OR at least one non-US ban. Candidates are already
  // unique and id-ordered, so the result is too.
  return candidates.filter(id => (banCount.get(id) ?? 0) >= MIN_BANS || hasNonUs.has(id))
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

/** Hydrate chosen books with the fields the post needs — one batched query
 *  for all ids plus one countries lookup, instead of a query per pick (the
 *  admin "upcoming" view hydrates 14 dates at once). */
async function hydrateMany(ids: number[]): Promise<Map<number, DailyBook>> {
  const out = new Map<number, DailyBook>()
  const unique = [...new Set(ids)]
  if (unique.length === 0) return out

  const supabase = adminClient()
  const { data } = await supabase
    .from('books')
    .select(
      'id, title, slug, first_published_year, cover_url, description_ban, ' +
        'book_authors(authors(display_name)), ' +
        'bans(country_code, ban_reason_links(reasons(slug)))',
    )
    .in('id', unique)
  const rows = (data ?? []) as unknown as RichRow[]

  // Resolve country codes → English names in one lookup across all books.
  // Falls back to the raw code if a name is missing.
  const allCodes = new Set<string>()
  for (const row of rows) for (const b of row.bans ?? []) if (b.country_code) allCodes.add(b.country_code)
  const nameByCode = new Map<string, string>()
  if (allCodes.size > 0) {
    const { data: cRows } = await supabase.from('countries').select('code, name_en').in('code', [...allCodes])
    for (const c of (cRows ?? []) as Array<{ code: string; name_en: string }>) nameByCode.set(c.code, c.name_en)
  }

  for (const row of rows) {
    const author = row.book_authors?.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') || 'Unknown'
    const bans = row.bans ?? []
    const codes = [...new Set(bans.map(b => b.country_code).filter((c): c is string => !!c))]
    const reasons = new Set<string>()
    for (const b of bans) for (const l of b.ban_reason_links ?? []) if (l.reasons?.slug) reasons.add(l.reasons.slug)

    out.set(Number(row.id), {
      id: row.id,
      title: row.title,
      slug: row.slug,
      author,
      year: row.first_published_year,
      coverUrl: row.cover_url,
      descriptionBan: row.description_ban,
      reasons: [...reasons],
      countries: codes.map(c => nameByCode.get(c) ?? c),
      countryCount: codes.length,
      banCount: bans.length,
    })
  }
  return out
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
  const [excluded, stored, featured] = await Promise.all([
    loadExcludedIds(),
    loadStoredPicks(datesYmd),
    loadFeaturedBirthdays(),
  ])

  // The eligible pool is only needed to roll a pick for dates that aren't
  // frozen yet. On the normal path (all dates frozen — e.g. every admin page
  // view after the daily cron ran) this skips the ~20-query books scan.
  const needsPool = datesYmd.some(ymd => !stored.has(ymd))
  const ids = needsPool ? await eligibleBookIds() : []
  if (needsPool && ids.length === 0) return datesYmd.map(() => null)

  const chosen = await resolvePickIds(datesYmd, ids, excluded, stored)
  const byId = await hydrateMany(chosen)
  // Clone per date: attachBirthday mutates, and the same book can serve
  // multiple dates.
  return chosen.map((id, i) => {
    const b = byId.get(id)
    return attachBirthday(b ? { ...b } : null, datesYmd[i], featured)
  })
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
  const head = book.birthday ? '🎂 Banned book of the day' : '📚 Banned book of the day'
  // On a featured author's birthday, name the occasion right under the title.
  const bdayLine = book.birthday
    ? `\n\n🎂 ${book.birthday.name} was born on this day${book.birthday.bornYear ? ` in ${book.birthday.bornYear}` : ''}.`
    : ''

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
  const compose = (titleLine: string, why: string): string => `${head}\n\n${titleLine}${bdayLine}${why}\n\n${display}${FEED_TAG}`

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
