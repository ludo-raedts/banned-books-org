// Register layer — very large historical ban lists kept as lean entries
// (register_lists / register_entries, migration 20261110100000) instead of
// thousands of thin book pages. Counts are denormalised on register_lists and
// are NEVER summed into the distinct-books metric: pages show them next to it.
//
// Every read here is bounded and runs only at ISR time (pages revalidate daily):
// letter pages are one index range scan on (list_id, letter, sort_key).

import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'

export type RegisterList = {
  id: number
  slug: string
  title: string
  title_en: string | null
  issuer: string
  country_code: string
  year_start: number
  year_end: number | null
  framing: 'denazification' | 'repression' | 'religious' | 'other'
  intro_md: string | null
  source_name: string
  source_url: string
  licence_note: string | null
  page_url_template: string | null
  entry_count: number
  book_count: number
  matched_count: number
}

export type RegisterEntry = {
  id: number
  edition: string
  kind: 'book' | 'blanket' | 'group' | 'periodical' | 'rescission'
  printed_author: string | null
  author_display: string | null
  title: string
  imprint: string | null
  pub_year: number | null
  ban_year: number | null
  note: string | null
  source_url: string | null
  printed_page: number | null
  locator: string | null
  book: { slug: string } | null
}

const LIST_COLS =
  'id, slug, title, title_en, issuer, country_code, year_start, year_end, framing, intro_md, source_name, source_url, licence_note, page_url_template, entry_count, book_count, matched_count'

/** Rows per letter page. 1,000 made a ~1.6 MB page (the S page of the SBZ list
 *  alone holds 4,700 entries); 250 keeps the HTML around 400 KB. */
export const REGISTER_PAGE_SIZE = 250

export const REGISTER_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'] as const

/** URL segment for a letter: 'a'…'z', '0' for the '#' bucket (digits, symbols). */
export const letterToSegment = (l: string) => (l === '#' ? '0' : l.toLowerCase())

/** 's' → { letter: 'S', page: 1 }, 's-2' → { letter: 'S', page: 2 }; null if malformed. */
export function parseLetterSegment(seg: string): { letter: string; page: number } | null {
  const m = /^([a-z0])(?:-(\d{1,2}))?$/.exec(seg)
  if (!m) return null
  const page = m[2] ? Number(m[2]) : 1
  if (page < 2 && m[2]) return null // 's-1' is not canonical; 's' is
  return { letter: m[1] === '0' ? '#' : m[1].toUpperCase(), page }
}

export const pageSegment = (letter: string, page: number) =>
  page <= 1 ? letterToSegment(letter) : `${letterToSegment(letter)}-${page}`

/** Human labels for the editions of a list (falls back to the raw edition). */
const EDITION_LABELS: Record<string, Record<string, string>> = {
  'sbz-1946': {
    '1946': '1946',
    '1947': 'Suppl. I · 1947',
    '1948': 'Suppl. II · 1948',
    '1953': 'Suppl. III · 1953 (GDR)',
  },
}
export const editionLabel = (listSlug: string, edition: string) =>
  EDITION_LABELS[listSlug]?.[edition] ?? edition

export async function getRegisterLists(): Promise<RegisterList[]> {
  const { data, error } = await adminClient().from('register_lists').select(LIST_COLS).order('year_start')
  if (error) throw error
  return (data ?? []) as RegisterList[]
}

export async function getRegisterList(slug: string): Promise<RegisterList | null> {
  const { data, error } = await adminClient().from('register_lists').select(LIST_COLS).eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data as RegisterList | null) ?? null
}

/** Lists for one country — for the "X documented books · Y titles on official lists" line. */
export async function getRegisterListsForCountry(code: string): Promise<Pick<RegisterList, 'slug' | 'title' | 'title_en' | 'entry_count' | 'year_start' | 'year_end'>[]> {
  const { data, error } = await adminClient()
    .from('register_lists')
    .select('slug, title, title_en, entry_count, year_start, year_end')
    .eq('country_code', code.toUpperCase())
    .order('year_start')
  if (error) throw error
  return data ?? []
}

export type RegisterTotal = {
  slug: string
  title: string
  title_en: string | null
  country_code: string
  year_start: number
  year_end: number | null
  /** Book entries on the list that have no page in our catalogue. */
  furtherTitles: number
}

/** Per list: the book entries NOT linked to a catalogue book — the honest
 *  "further titles" figure. `entry_count` overstates it: that also holds
 *  periodicals, rescissions, category bans and entries we already document as
 *  books. One HEAD count per list, in the data cache for a day (the lists only
 *  change on an import, which busts the 'registers' tag). */
export const getRegisterTotals = unstable_cache(
  async (): Promise<RegisterTotal[]> => {
    const sb = adminClient()
    const { data, error } = await sb
      .from('register_lists')
      .select('id, slug, title, title_en, country_code, year_start, year_end')
      .order('year_start')
    if (error) throw error
    return Promise.all(
      (data ?? []).map(async (l) => {
        const { count, error: e } = await sb
          .from('register_entries')
          .select('id', { count: 'exact', head: true })
          .eq('list_id', l.id)
          .eq('kind', 'book')
          .is('matched_book_id', null)
        if (e) throw e
        if (count == null) throw new Error(`getRegisterTotals: no count for ${l.slug}`)
        const { id: _id, ...rest } = l
        return { ...rest, furtherTitles: count } as RegisterTotal
      }),
    )
  },
  ['register-totals-v1'],
  { revalidate: 86400, tags: ['registers'] },
)

/** Entries per letter (all kinds): 27 index-only HEAD counts. Shared by every
 *  letter page of a list through the data cache (TTL = the pages' revalidate),
 *  so an uncached letter page costs one range scan instead of 28 round trips —
 *  firing all 27 at once per page exhausted the PostgREST pool under crawl. */
const _letterCounts = unstable_cache(
  async (listId: number): Promise<[string, number][]> => {
    const sb = adminClient()
    const results = await Promise.all(
      REGISTER_LETTERS.map(async (l) => {
        const { count, error } = await sb
          .from('register_entries')
          .select('id', { count: 'exact', head: true })
          .eq('list_id', listId)
          .eq('letter', l)
        if (error) throw error
        return [l, count ?? 0] as [string, number]
      }),
    )
    return results.filter(([, n]) => n > 0)
  },
  ['register-letter-counts'],
  { revalidate: 86400, tags: ['registers'] },
)

export async function getLetterCounts(listId: number): Promise<Map<string, number>> {
  return new Map(await _letterCounts(listId))
}

export async function getLetterEntries(listId: number, letter: string, page: number): Promise<RegisterEntry[]> {
  const from = (page - 1) * REGISTER_PAGE_SIZE
  const { data, error } = await adminClient()
    .from('register_entries')
    .select(
      'id, edition, kind, printed_author, author_display, title, imprint, pub_year, ban_year, note, source_url, printed_page, locator, book:books(slug)',
    )
    .eq('list_id', listId)
    .eq('letter', letter)
    .order('sort_key')
    .order('id')
    .range(from, from + REGISTER_PAGE_SIZE - 1)
  if (error) throw error
  return (data ?? []) as unknown as RegisterEntry[]
}

/** Where an entry's "source" link goes: scan page → entry deep link → list source. */
export function entrySourceUrl(list: Pick<RegisterList, 'page_url_template' | 'source_url'>, e: Pick<RegisterEntry, 'printed_page' | 'source_url'>): string {
  if (list.page_url_template && e.printed_page != null) {
    return list.page_url_template.replace('{page}', String(e.printed_page))
  }
  return e.source_url ?? list.source_url
}

const foldTokens = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(' ')

/** The normalised name, only when it says something the printed form doesn't. */
export function extraAuthorName(e: Pick<RegisterEntry, 'printed_author' | 'author_display'>): string | null {
  if (!e.author_display) return null
  if (!e.printed_author) return e.author_display
  return foldTokens(e.author_display) === foldTokens(e.printed_author) ? null : e.author_display
}

export const FRAMING_LABEL: Record<RegisterList['framing'], string> = {
  denazification: 'Denazification list',
  repression: 'Censorship list',
  religious: 'Religious index',
  other: 'Official list',
}
