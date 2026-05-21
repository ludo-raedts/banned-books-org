// Single-entry data layer for the Reading Club. Powers the per-book HTML
// detail page (/reading-club/<track>/<slug>) and the per-book PDF download.
// Each track has its own override table; the shared part is the book +
// bans + reasons join and the universal-questions content block.

import { adminClient, serverClient } from './supabase'
import { reasonPhrase } from './reason-phrases'

// ── Public shape ────────────────────────────────────────────────────────────

export type ReadingClubBanRow = {
  countryCode: string
  countryName: string
  yearStarted: number | null
  yearEnded: number | null
  status: string
  description: string | null
  reasons: string[]      // slugs
  reasonPhrases: string[] // human noun phrases
  // Upstream citations for this ban (PEN America, Wikipedia, etc.).
  sources: { name: string; url: string }[]
}

export type ReadingClubAuthor = {
  displayName: string
  bio: string | null
  birthYear: number | null
  deathYear: number | null
  birthCountry: string | null
  photoUrl: string | null
}

export type ReadingClubDetail = {
  track: 'international' | 'classics' | 'by-theme' | 'currently-challenged'
  trackLabel: string
  trackHref: string
  themeSlug?: string
  themeName?: string

  book: {
    id: number | null
    slug: string | null
    title: string
    authors: string[]
    description: string | null
    coverUrl: string | null
    isbn13: string | null
    firstPublishedYear: number | null
  }

  // Full author records (bio, dates, country, photo) — surfaced as an
  // "About the author" section on the detail page + PDF. Comes from the
  // `authors` table; empty when the book has no curated author records.
  authorRecords: ReadingClubAuthor[]

  customBlurb: string | null
  discussionQuestions: string[]
  bans: ReadingClubBanRow[]
  banSummary: string | null

  universalQuestions: string[]

  // Currently-Challenged-only: surfaced on the detail page so book-club
  // groups can see the ALA challenge total and link back to the source.
  challengeCount?: number | null
  sourceUrl?: string | null
  year?: number
  position?: number
}

// ── Shared joins ────────────────────────────────────────────────────────────

const BOOK_DETAIL_JOIN = `
  books(
    id, title, slug, cover_url, description_book, isbn13, first_published_year,
    book_authors(authors(display_name, bio, birth_year, death_year, birth_country, photo_url)),
    bans(
      country_code, year_started, year_ended, status, description,
      countries(name_en),
      ban_reason_links(reasons(slug)),
      ban_source_links(ban_sources(source_name, source_url))
    )
  )
`

type AuthorRow = {
  display_name: string
  bio: string | null
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  photo_url: string | null
}

type JoinedBookDetail = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description_book: string | null
  isbn13: string | null
  first_published_year: number | null
  book_authors: { authors: AuthorRow | null }[] | null
  bans: Array<{
    country_code: string
    year_started: number | null
    year_ended: number | null
    status: string
    description: string | null
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[] | null
    ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[] | null
  }> | null
} | null

function projectAuthors(b: JoinedBookDetail): ReadingClubAuthor[] {
  if (!b?.book_authors) return []
  return b.book_authors
    .map(ba => ba.authors)
    .filter((a): a is AuthorRow => !!a)
    .map(a => ({
      displayName: a.display_name,
      bio: a.bio?.trim() || null,
      birthYear: a.birth_year,
      deathYear: a.death_year,
      birthCountry: a.birth_country?.trim() || null,
      photoUrl: a.photo_url,
    }))
}

function projectBook(b: JoinedBookDetail): ReadingClubDetail['book'] {
  if (!b) {
    return {
      id: null, slug: null, title: '', authors: [], description: null,
      coverUrl: null, isbn13: null, firstPublishedYear: null,
    }
  }
  const authors = (b.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    authors,
    description: b.description_book,
    coverUrl: b.cover_url,
    isbn13: b.isbn13,
    firstPublishedYear: b.first_published_year,
  }
}

function pickLonger(a: string | null, b: string | null): string | null {
  const sa = a?.trim() ?? ''
  const sb = b?.trim() ?? ''
  if (sa.length >= sb.length) return sa || null
  return sb || null
}

function dedupeSources(arr: { name: string; url: string }[]): { name: string; url: string }[] {
  const seen = new Set<string>()
  const out: { name: string; url: string }[] = []
  for (const s of arr) {
    const key = `${s.name}|${s.url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

// Aggregate every unique source across a ban list — used for the
// citation/attribution block at the bottom of the detail page + PDF.
export function aggregateSources(bans: ReadingClubBanRow[]): { name: string; url: string }[] {
  return dedupeSources(bans.flatMap(b => b.sources))
}

function projectBans(b: JoinedBookDetail): ReadingClubBanRow[] {
  if (!b?.bans) return []
  const raw = b.bans.map(r => {
    const slugs = Array.from(new Set(
      (r.ban_reason_links ?? [])
        .map(l => l.reasons?.slug)
        .filter((s): s is string => !!s),
    ))
    const sources = (r.ban_source_links ?? [])
      .map(l => l.ban_sources)
      .filter((s): s is { source_name: string; source_url: string } => !!s)
      .map(s => ({ name: s.source_name, url: s.source_url }))
    return {
      countryCode: r.country_code,
      countryName: r.countries?.name_en ?? r.country_code,
      yearStarted: r.year_started,
      yearEnded: r.year_ended,
      status: r.status,
      description: r.description,
      reasons: slugs,
      reasonPhrases: slugs.map(s => reasonPhrase(s)),
      sources,
    } satisfies ReadingClubBanRow
  })
  // Dedupe entries that share country + start-year + status. PEN America's
  // per-district feed produces dozens of near-identical rows for a single
  // book in the same school year; for a book-club PDF we just want one
  // representative per (country, year) bucket. We keep the row with the
  // richest description / most reasons so context isn't lost.
  const groups = new Map<string, ReadingClubBanRow>()
  for (const row of raw) {
    const key = `${row.countryCode}|${row.yearStarted ?? ''}|${row.status}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, row)
      continue
    }
    const merged: ReadingClubBanRow = {
      ...existing,
      description: pickLonger(existing.description, row.description),
      reasons: Array.from(new Set([...existing.reasons, ...row.reasons])),
      reasonPhrases: Array.from(new Set([
        ...existing.reasonPhrases,
        ...row.reasonPhrases,
      ])),
      sources: dedupeSources([...existing.sources, ...row.sources]),
    }
    groups.set(key, merged)
  }
  return Array.from(groups.values())
}

// Some editor-pasted question lists already carry a "1. " / "1) " prefix.
// Strip it so the rendered <ol> / PDF numbered list don't show "1. 1. …".
export function normalizeQuestion(q: string): string {
  return q.replace(/^\s*\d+\s*[.)]\s+/, '').trim()
}

// Human-readable one-paragraph summary of the ban context, mirroring the
// lead sentence on the /books/<slug> detail page but without the FAQ list.
function buildBanSummary(book: ReadingClubDetail['book'], bans: ReadingClubBanRow[]): string | null {
  if (bans.length === 0) return null
  const author = book.authors.join(', ')
  const baseTitle = author ? `${book.title} by ${author}` : book.title

  const countries = Array.from(new Set(bans.map(b => b.countryName)))
  const dated = bans.filter(b => b.yearStarted != null).map(b => b.yearStarted!)
  const earliest = dated.length > 0 ? Math.min(...dated) : null

  const reasonCount = new Map<string, number>()
  for (const b of bans) for (const r of b.reasons) {
    reasonCount.set(r, (reasonCount.get(r) ?? 0) + 1)
  }
  const topSlug = [...reasonCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topPhrase = topSlug ? reasonPhrase(topSlug) : null

  let lead: string
  if (countries.length === 1 && earliest && topPhrase) {
    lead = `${baseTitle} has been banned in ${countries[0]} since ${earliest} for ${topPhrase}.`
  } else if (countries.length === 1 && topPhrase) {
    lead = `${baseTitle} has been banned in ${countries[0]} for ${topPhrase}.`
  } else if (countries.length === 1 && earliest) {
    lead = `${baseTitle} has been banned in ${countries[0]} since ${earliest}.`
  } else if (countries.length === 1) {
    lead = `${baseTitle} has been banned in ${countries[0]}.`
  } else if (earliest && topPhrase) {
    lead = `${baseTitle} has been banned in ${countries.length} countries since ${earliest}, most often for ${topPhrase}.`
  } else if (earliest) {
    lead = `${baseTitle} has been banned in ${countries.length} countries since ${earliest}.`
  } else if (topPhrase) {
    lead = `${baseTitle} has been banned in ${countries.length} countries, most often for ${topPhrase}.`
  } else {
    lead = `${baseTitle} has been banned in ${countries.length} countries.`
  }
  if (countries.length >= 3) {
    lead += ` Documented bans include ${countries.slice(0, 3).join(', ')}, among others.`
  }
  const activeCount = bans.filter(b => b.status === 'active').length
  if (activeCount > 0 && bans.length > activeCount) {
    lead += ` ${activeCount} ${activeCount === 1 ? 'ban remains' : 'bans remain'} active today.`
  }
  return lead
}

// ── Universal questions ────────────────────────────────────────────────────
// The "discussion questions for any banned book" block is stored as HTML
// (typically a <ul><li>…</li></ul>). For both the HTML detail page and the
// PDF we want the items as plain strings.

export async function getUniversalQuestions(): Promise<string[]> {
  const { data } = await serverClient()
    .from('content_blocks')
    .select('body_html, status')
    .eq('slug', 'reading-club-universal-questions')
    .maybeSingle()
  if (!data || data.status !== 'published' || !data.body_html) return []
  return extractListItems(data.body_html)
}

function extractListItems(html: string): string[] {
  const items: string[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const text = m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    if (text) items.push(text)
  }
  return items
}

// ── Per-track fetchers ─────────────────────────────────────────────────────

type EntryFetcherOpts = { admin?: boolean }

export async function getInternationalEntry(
  bookSlug: string,
  opts?: EntryFetcherOpts,
): Promise<ReadingClubDetail | null> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  // Find the book by slug first so we can match on its id in the override
  // table. Two-step keeps the supabase typegen happy with the nested join.
  const { data: bookRow } = await supabase
    .from('books')
    .select('id')
    .eq('slug', bookSlug)
    .maybeSingle()
  if (!bookRow) return null

  let q = supabase
    .from('reading_club_international')
    .select(`book_id, custom_blurb, discussion_questions, published_at, ${BOOK_DETAIL_JOIN}`)
    .eq('book_id', bookRow.id)
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q.maybeSingle()
  if (!data) return null

  type Row = {
    book_id: number
    custom_blurb: string | null
    discussion_questions: string[] | null
    published_at: string | null
    books: JoinedBookDetail
  }
  const row = data as unknown as Row
  const book = projectBook(row.books)
  const bans = projectBans(row.books)
  const authorRecords = projectAuthors(row.books)
  const universalQuestions = await getUniversalQuestions()

  return {
    track: 'international',
    trackLabel: 'International cases',
    trackHref: '/reading-club/international',
    book,
    authorRecords,
    customBlurb: row.custom_blurb,
    discussionQuestions: (row.discussion_questions ?? []).map(normalizeQuestion),
    bans,
    banSummary: buildBanSummary(book, bans),
    universalQuestions,
  }
}

export async function getClassicsEntry(
  bookSlug: string,
  opts?: EntryFetcherOpts,
): Promise<ReadingClubDetail | null> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  const { data: bookRow } = await supabase
    .from('books')
    .select('id')
    .eq('slug', bookSlug)
    .maybeSingle()
  if (!bookRow) return null

  let q = supabase
    .from('reading_club_classics')
    .select(`book_id, custom_blurb, discussion_questions, published_at, ${BOOK_DETAIL_JOIN}`)
    .eq('book_id', bookRow.id)
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q.maybeSingle()
  if (!data) return null

  type Row = {
    book_id: number
    custom_blurb: string | null
    discussion_questions: string[] | null
    published_at: string | null
    books: JoinedBookDetail
  }
  const row = data as unknown as Row
  const book = projectBook(row.books)
  const bans = projectBans(row.books)
  const authorRecords = projectAuthors(row.books)
  const universalQuestions = await getUniversalQuestions()

  return {
    track: 'classics',
    trackLabel: 'Banned classics',
    trackHref: '/reading-club/classics',
    book,
    authorRecords,
    customBlurb: row.custom_blurb,
    discussionQuestions: (row.discussion_questions ?? []).map(normalizeQuestion),
    bans,
    banSummary: buildBanSummary(book, bans),
    universalQuestions,
  }
}

// Currently-Challenged uses (year, position) as the natural key because the
// row may not have a linked book in our DB. When the book IS linked we still
// pull the same book/bans context as the other tracks; when it isn't, we
// fall back to the row's own title + author and skip ban context entirely.
export async function getCurrentlyChallengedEntry(
  year: number,
  position: number,
  opts?: EntryFetcherOpts,
): Promise<ReadingClubDetail | null> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  let q = supabase
    .from('reading_club_currently_challenged')
    .select(`year, position, title, author, challenge_count, source_url,
             discussion_questions, published_at, ${BOOK_DETAIL_JOIN}`)
    .eq('year', year)
    .eq('position', position)
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q.maybeSingle()
  if (!data) return null

  type Row = {
    year: number
    position: number
    title: string
    author: string
    challenge_count: number | null
    source_url: string | null
    discussion_questions: string[] | null
    published_at: string | null
    books: JoinedBookDetail
  }
  const row = data as unknown as Row
  let book: ReadingClubDetail['book']
  let bans: ReadingClubBanRow[]
  let authorRecords: ReadingClubAuthor[]
  if (row.books) {
    book = projectBook(row.books)
    bans = projectBans(row.books)
    authorRecords = projectAuthors(row.books)
  } else {
    // No matching record in our books table — render from the ALA row's
    // own title + author strings. Slug stays null so the layout omits any
    // "View full ban record" link.
    book = {
      id: null, slug: null, title: row.title, authors: row.author ? [row.author] : [],
      description: null, coverUrl: null, isbn13: null, firstPublishedYear: null,
    }
    bans = []
    authorRecords = []
  }
  const universalQuestions = await getUniversalQuestions()

  return {
    track: 'currently-challenged',
    trackLabel: `Currently challenged (${year})`,
    trackHref: '/reading-club/currently-challenged',
    book,
    authorRecords,
    customBlurb: null,
    discussionQuestions: (row.discussion_questions ?? []).map(normalizeQuestion),
    bans,
    banSummary: buildBanSummary(book, bans),
    universalQuestions,
    challengeCount: row.challenge_count,
    sourceUrl: row.source_url,
    year: row.year,
    position: row.position,
  }
}

export async function getThemeEntry(
  themeSlug: string,
  bookSlug: string,
  opts?: EntryFetcherOpts,
): Promise<ReadingClubDetail | null> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  const { data: bookRow } = await supabase
    .from('books')
    .select('id')
    .eq('slug', bookSlug)
    .maybeSingle()
  if (!bookRow) return null

  const { data: theme } = await supabase
    .from('reading_club_themes')
    .select('slug, display_name')
    .eq('slug', themeSlug)
    .maybeSingle()
  if (!theme) return null

  // Prefer an admin override row; fall back to a bare book read so auto-pull
  // theme books still get a detail page even without curator-provided blurb.
  let q = supabase
    .from('reading_club_theme_books')
    .select(`book_id, custom_blurb, discussion_questions, published_at, ${BOOK_DETAIL_JOIN}`)
    .eq('theme_slug', themeSlug)
    .eq('book_id', bookRow.id)
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data: override } = await q.maybeSingle()

  let customBlurb: string | null = null
  let discussionQuestions: string[] = []
  let joinedBook: JoinedBookDetail = null
  if (override) {
    type Row = {
      custom_blurb: string | null
      discussion_questions: string[] | null
      books: JoinedBookDetail
    }
    const row = override as unknown as Row
    customBlurb = row.custom_blurb
    discussionQuestions = (row.discussion_questions ?? []).map(normalizeQuestion)
    joinedBook = row.books
  } else {
    // No override — pull the book directly so we still have something to render.
    const { data: bookOnly } = await supabase
      .from('books')
      .select(`id, title, slug, cover_url, description_book, isbn13, first_published_year,
               book_authors(authors(display_name, bio, birth_year, death_year, birth_country, photo_url)),
               bans(country_code, year_started, year_ended, status, description,
                    countries(name_en),
                    ban_reason_links(reasons(slug)),
                    ban_source_links(ban_sources(source_name, source_url)))`)
      .eq('id', bookRow.id)
      .maybeSingle()
    joinedBook = (bookOnly as unknown as JoinedBookDetail) ?? null
  }
  if (!joinedBook) return null

  const book = projectBook(joinedBook)
  const bans = projectBans(joinedBook)
  const authorRecords = projectAuthors(joinedBook)
  const universalQuestions = await getUniversalQuestions()

  return {
    track: 'by-theme',
    trackLabel: theme.display_name,
    trackHref: `/reading-club/by-theme/${themeSlug}`,
    themeSlug,
    themeName: theme.display_name,
    book,
    authorRecords,
    customBlurb,
    discussionQuestions,
    bans,
    banSummary: buildBanSummary(book, bans),
    universalQuestions,
  }
}
