// Reading Club data layer — fetch helpers and theme-tag mapping.
//
// The Reading Club has four tracks. Three of them (international, classics,
// theme) are book-driven and join with the books table; one (currently
// challenged) stores ALA OIF entries verbatim because the ALA list isn't
// always matchable to our books DB. All four use the same draft/publish
// convention as BBW: `published_at IS NULL` means draft.

import { adminClient, serverClient } from './supabase'
import type { SuggesterBook } from './bbw-suggester'

// ── Theme → reason-slug mapping ──────────────────────────────────────────────
//
// Maps the five Reading Club theme slugs to the reason slugs already in use
// in our `reasons` table (see scripts/enrich-reasons.ts and
// src/components/reason-badge.tsx for the canonical list:
//   lgbtq, sexual, racial, political, religious, violence, language, drugs,
//   obscenity, moral, blasphemy, other).
//
// Books matching any of the listed reasons are auto-pulled into the theme.
// Admins can override the featured set per theme via the admin UI.

export const THEME_REASON_MAP: Record<string, readonly string[]> = {
  'lgbtq':                 ['lgbtq'],
  'political-dissent':     ['political'],
  'religious-censorship':  ['religious', 'blasphemy'],
  'race-and-racism':       ['racial'],
  'sexuality':             ['sexual', 'obscenity', 'moral'],
} as const

export type ThemeSlug = keyof typeof THEME_REASON_MAP

// ── Common card shape used on every public track page ───────────────────────

export type ReadingClubCard = {
  bookId: number | null
  position: number
  title: string
  authors: string[]
  isbn13?: string | null
  bookshopIsbn13?: string | null
  bookshopStatus?: 'valid' | 'not_found' | null
  customBlurb: string | null
  discussionQuestions: string[]
  bookSlug: string | null
  coverUrl: string | null
  description: string | null
  countries: string[]
  reasons: string[]
  banCount: number
  // Currently-challenged-only fields:
  challengeCount?: number | null
  bookshopUrl?: string | null
  sourceUrl?: string | null
  publishedAt: string | null
}

// Shared join used wherever we render a track row that points at a real book.
const BOOK_JOIN = `
  books(
    id, title, slug, cover_url, description_book, isbn13, bookshop_status, bookshop_isbn13,
    book_authors(authors(display_name)),
    bans(country_code, ban_reason_links(reasons(slug)))
  )
`

type JoinedBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description_book: string | null
  isbn13: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bookshop_isbn13: string | null
  book_authors: { authors: { display_name: string } | null }[] | null
  bans: { country_code: string; ban_reason_links: { reasons: { slug: string } | null }[] | null }[] | null
} | null

function projectJoinedBook(b: JoinedBook): {
  authors: string[]
  countries: string[]
  reasons: string[]
  banCount: number
} {
  if (!b) return { authors: [], countries: [], reasons: [], banCount: 0 }
  const authors = (b.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
  const countries = Array.from(new Set((b.bans ?? []).map(x => x.country_code)))
  const reasons = Array.from(new Set(
    (b.bans ?? []).flatMap(x => (x.ban_reason_links ?? []).map(l => l.reasons?.slug).filter((s): s is string => !!s)),
  ))
  return { authors, countries, reasons, banCount: (b.bans ?? []).length }
}

// ── Currently Challenged ────────────────────────────────────────────────────

export async function getCurrentlyChallenged(year: number, opts?: { admin?: boolean }): Promise<ReadingClubCard[]> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  let q = supabase
    .from('reading_club_currently_challenged')
    .select(`year, position, title, author, challenge_count, bookshop_url, discussion_questions, source_url, published_at, ${BOOK_JOIN}`)
    .eq('year', year)
    .order('position')
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q
  type Row = {
    year: number
    position: number
    title: string
    author: string
    challenge_count: number | null
    bookshop_url: string | null
    discussion_questions: string[] | null
    source_url: string | null
    published_at: string | null
    books: JoinedBook
  }
  return ((data ?? []) as unknown as Row[]).map(r => {
    const b = r.books
    const proj = projectJoinedBook(b)
    return {
      bookId: b?.id ?? null,
      position: r.position,
      title: b?.title ?? r.title,
      authors: b ? proj.authors : [r.author],
      isbn13: b?.isbn13 ?? null,
      bookshopIsbn13: b?.bookshop_isbn13 ?? null,
      bookshopStatus: b?.bookshop_status ?? null,
      customBlurb: null,
      discussionQuestions: r.discussion_questions ?? [],
      bookSlug: b?.slug ?? null,
      coverUrl: b?.cover_url ?? null,
      description: b?.description_book ?? null,
      countries: proj.countries,
      reasons: proj.reasons,
      banCount: proj.banCount,
      challengeCount: r.challenge_count,
      bookshopUrl: r.bookshop_url,
      sourceUrl: r.source_url,
      publishedAt: r.published_at,
    }
  })
}

// ── International ────────────────────────────────────────────────────────────

export async function getInternationalTrack(opts?: { admin?: boolean }): Promise<ReadingClubCard[]> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  let q = supabase
    .from('reading_club_international')
    .select(`book_id, position, custom_blurb, discussion_questions, pinned, published_at, ${BOOK_JOIN}`)
    .order('position')
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q
  return ((data ?? []) as unknown as Array<{
    book_id: number; position: number; custom_blurb: string | null;
    discussion_questions: string[] | null; pinned: boolean; published_at: string | null;
    books: JoinedBook
  }>).map(r => {
    const proj = projectJoinedBook(r.books)
    return {
      bookId: r.book_id,
      position: r.position,
      title: r.books?.title ?? `Book ${r.book_id}`,
      authors: proj.authors,
      isbn13: r.books?.isbn13 ?? null,
      bookshopIsbn13: r.books?.bookshop_isbn13 ?? null,
      bookshopStatus: r.books?.bookshop_status ?? null,
      customBlurb: r.custom_blurb,
      discussionQuestions: r.discussion_questions ?? [],
      bookSlug: r.books?.slug ?? null,
      coverUrl: r.books?.cover_url ?? null,
      description: r.books?.description_book ?? null,
      countries: proj.countries,
      reasons: proj.reasons,
      banCount: proj.banCount,
      publishedAt: r.published_at,
    }
  })
}

// ── Classics ─────────────────────────────────────────────────────────────────

export async function getClassicsTrack(opts?: { admin?: boolean }): Promise<ReadingClubCard[]> {
  const supabase = opts?.admin ? adminClient() : serverClient()
  let q = supabase
    .from('reading_club_classics')
    .select(`book_id, position, custom_blurb, discussion_questions, published_at, ${BOOK_JOIN}`)
    .order('position')
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data } = await q
  return ((data ?? []) as unknown as Array<{
    book_id: number; position: number; custom_blurb: string | null;
    discussion_questions: string[] | null; published_at: string | null;
    books: JoinedBook
  }>).map(r => {
    const proj = projectJoinedBook(r.books)
    return {
      bookId: r.book_id,
      position: r.position,
      title: r.books?.title ?? `Book ${r.book_id}`,
      authors: proj.authors,
      isbn13: r.books?.isbn13 ?? null,
      bookshopIsbn13: r.books?.bookshop_isbn13 ?? null,
      bookshopStatus: r.books?.bookshop_status ?? null,
      customBlurb: r.custom_blurb,
      discussionQuestions: r.discussion_questions ?? [],
      bookSlug: r.books?.slug ?? null,
      coverUrl: r.books?.cover_url ?? null,
      description: r.books?.description_book ?? null,
      countries: proj.countries,
      reasons: proj.reasons,
      banCount: proj.banCount,
      publishedAt: r.published_at,
    }
  })
}

// ── Themes ───────────────────────────────────────────────────────────────────

export type ThemeRow = { slug: string; display_name: string; sort_order: number }

export async function getThemes(): Promise<ThemeRow[]> {
  const { data } = await serverClient()
    .from('reading_club_themes')
    .select('slug, display_name, sort_order')
    .order('sort_order')
  return (data ?? []) as ThemeRow[]
}

// Theme books: prefer admin overrides; fall back to auto-pull via tag-matching.
// "Auto-pull" returns books whose any-ban includes a reason in the theme's
// mapping, ranked by ban count desc. The admin can override by inserting rows
// into reading_club_theme_books — those take precedence.
export async function getThemeBooks(themeSlug: string, opts?: { admin?: boolean }): Promise<ReadingClubCard[]> {
  const supabase = opts?.admin ? adminClient() : serverClient()

  // 1. Admin overrides (if any).
  let q = supabase
    .from('reading_club_theme_books')
    .select(`book_id, position, custom_blurb, discussion_questions, published_at, ${BOOK_JOIN}`)
    .eq('theme_slug', themeSlug)
    .order('position')
  if (!opts?.admin) q = q.not('published_at', 'is', null)
  const { data: overrideRows } = await q
  const overrides = ((overrideRows ?? []) as unknown as Array<{
    book_id: number; position: number; custom_blurb: string | null;
    discussion_questions: string[] | null; published_at: string | null;
    books: JoinedBook
  }>).map(r => {
    const proj = projectJoinedBook(r.books)
    return {
      bookId: r.book_id,
      position: r.position,
      title: r.books?.title ?? `Book ${r.book_id}`,
      authors: proj.authors,
      isbn13: r.books?.isbn13 ?? null,
      bookshopIsbn13: r.books?.bookshop_isbn13 ?? null,
      bookshopStatus: r.books?.bookshop_status ?? null,
      customBlurb: r.custom_blurb,
      discussionQuestions: r.discussion_questions ?? [],
      bookSlug: r.books?.slug ?? null,
      coverUrl: r.books?.cover_url ?? null,
      description: r.books?.description_book ?? null,
      countries: proj.countries,
      reasons: proj.reasons,
      banCount: proj.banCount,
      publishedAt: r.published_at,
    } as ReadingClubCard
  })

  if (overrides.length > 0) return overrides

  // 2. Auto-pull from books table by reason match.
  const reasonSlugs = THEME_REASON_MAP[themeSlug as ThemeSlug] ?? []
  if (reasonSlugs.length === 0) return []

  // Two-step query: first find ban_ids whose reasons match, then books for those bans.
  const reasonsClient = adminClient()
  const { data: reasonIds } = await reasonsClient
    .from('reasons')
    .select('id, slug')
    .in('slug', reasonSlugs as string[])
  const reasonIdSet = new Set((reasonIds ?? []).map(r => r.id))
  if (reasonIdSet.size === 0) return []

  const { data: links } = await reasonsClient
    .from('ban_reason_links')
    .select('ban_id, reason_id')
    .in('reason_id', Array.from(reasonIdSet))
  const banIds = Array.from(new Set((links ?? []).map(l => l.ban_id))).slice(0, 1000)
  if (banIds.length === 0) return []

  const { data: bans } = await reasonsClient
    .from('bans')
    .select('book_id')
    .in('id', banIds)
  const bookIds = Array.from(new Set((bans ?? []).map(b => b.book_id))).slice(0, 200)
  if (bookIds.length === 0) return []

  const { data: books } = await reasonsClient
    .from('books')
    .select(`id, title, slug, cover_url, description_book, isbn13, bookshop_status, bookshop_isbn13,
             book_authors(authors(display_name)),
             bans(country_code, ban_reason_links(reasons(slug)))`)
    .in('id', bookIds)

  // Rank by ban count desc, take top 12.
  return ((books ?? []) as unknown as NonNullable<JoinedBook>[])
    .map(b => {
      const proj = projectJoinedBook(b)
      return {
        bookId: b.id,
        position: 0,
        title: b.title,
        authors: proj.authors,
        isbn13: b.isbn13,
        bookshopIsbn13: b.bookshop_isbn13,
        bookshopStatus: b.bookshop_status,
        customBlurb: null,
        discussionQuestions: [],
        bookSlug: b.slug,
        coverUrl: b.cover_url,
        description: b.description_book,
        countries: proj.countries,
        reasons: proj.reasons,
        banCount: proj.banCount,
        publishedAt: null, // auto-pulled (not via the override table)
      } as ReadingClubCard
    })
    .sort((a, b) => b.banCount - a.banCount)
    .slice(0, 12)
    .map((c, i) => ({ ...c, position: i + 1 }))
}

// ── Suggester corpus (international) ─────────────────────────────────────────
// Reuses the same shape as the BBW suggester input. The international engine
// itself filters out US-only books, but we still gather everything so the
// admin can preview the full ranking.

export async function buildIntlCorpus(): Promise<SuggesterBook[]> {
  const supabase = adminClient()
  type RawBook = {
    id: number
    bans: { country_code: string; year_started: number | null;
            ban_reason_links: { reasons: { slug: string } | null }[] | null }[] | null
    book_authors: { author_id: number }[] | null
  }
  const all: RawBook[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select(`id,
               book_authors(author_id),
               bans(country_code, year_started, ban_reason_links(reasons(slug)))`)
      .order('id')
      .range(offset, offset + PAGE - 1)
    all.push(...((data ?? []) as unknown as RawBook[]))
    if (!data || data.length < PAGE) break
    offset += PAGE
  }

  const [{ data: topWeek }, { data: topAll }] = await Promise.all([
    supabase.from('v_top_books_this_week').select('entity_id').limit(50),
    supabase.from('v_top_books_all_time').select('entity_id').limit(200),
  ])
  const topWeekIds = new Set((topWeek ?? []).map(r => Number(r.entity_id)))
  const topAllIds  = new Set((topAll  ?? []).map(r => Number(r.entity_id)))

  const FIVE_YEARS_AGO = new Date().getFullYear() - 5

  return all
    .filter(b => (b.bans ?? []).length > 0)
    .map<SuggesterBook>(b => {
      const bans = b.bans ?? []
      const banCount = bans.length
      const countries = bans.map(x => x.country_code)
      const reasons = Array.from(new Set(
        bans.flatMap(x => (x.ban_reason_links ?? []).map(l => l.reasons?.slug).filter((s): s is string => !!s)),
      ))
      const recent = bans.filter(x => (x.year_started ?? 0) >= FIVE_YEARS_AGO).length
      return {
        id: b.id,
        authorIds: (b.book_authors ?? []).map(x => x.author_id),
        banCount,
        recentBanScore: banCount === 0 ? 0 : recent / banCount,
        countryCount: new Set(countries).size,
        countries,
        reasons,
        topListPresence: topWeekIds.has(b.id) ? 1 : topAllIds.has(b.id) ? 0.5 : 0,
        pinned: false,
        inPreviousYears: false,
      }
    })
}
