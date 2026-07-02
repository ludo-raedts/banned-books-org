/**
 * Generate Bookshop.org curated-list payloads (CSV upload + suggested
 * title / header / footer / layout) for our affiliate storefront.
 *
 * Bookshop's affiliate dashboard accepts up to 50 ISBNs per list as a
 * CSV upload (one ISBN per line). For each themed list we produce:
 *
 *   data/bookshop-lists/{slug}/isbns.csv       — ready to upload
 *   data/bookshop-lists/{slug}/metadata.md     — copy-paste fields
 *
 * Ranking rule: for unfiltered lists we sort on total ban count; for
 * filtered lists (reasons / scopes / countries / year range) we sort on
 * the number of bans that match the filter, so a thematic list reflects
 * the theme rather than overall fame. `bookshop_status='valid'` is
 * always a hard filter.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/export-bookshop-lists.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const OUT_DIR = join(process.cwd(), 'data', 'bookshop-lists')
const PER_LIST_LIMIT = 50

type ListSpec = {
  slug: string
  title: string
  header: string
  footer: string
  // A book qualifies if it has ≥1 ban matching ALL specified filters.
  reasonsAny?: readonly string[]
  scopesAny?: readonly string[]
  countriesAny?: readonly string[]   // ISO-2, uppercase
  yearStartedMin?: number             // inclusive
  yearStartedMax?: number             // inclusive
  // Source override — selection driven by an external dataset instead
  // of `bans`. When set, the in-DB ban filters above are ignored.
  fromSource?: 'pen-america-2024-25'
}

const LISTS: readonly ListSpec[] = [
  // ── Existing 6 (already live on bookshop.org/shop/Banned-books) ────────
  {
    slug: 'most-banned',
    title: 'The Most Banned Books in the World',
    header: 'The most-banned and most-challenged books on Earth, ranked by total documented ban events. Every title here has been formally banned, restricted, or removed somewhere — most of them in many places at once. Drawn from PEN America, the American Library Association, and national censorship registries across more than 90 countries.',
    footer: 'Compiled by banned-books.org — a global database of banned and challenged books. Buying through this list supports independent bookstores. For every country, decade, and stated reason behind each title, visit https://banned-books.org.',
  },
  {
    slug: 'banned-lgbtq',
    title: 'Banned LGBTQ+ Books',
    header: 'Books banned, challenged, or restricted because they include LGBTQ+ characters, themes, or experiences. Since 2021 this has been by far the largest single category of school-library challenges in the United States — but the pattern reaches back decades and stretches across continents.',
    footer: 'Compiled by banned-books.org from PEN America, the American Library Association, and global censorship registries. See every documented LGBTQ+ book ban at https://banned-books.org/reasons/lgbtq.',
    reasonsAny: ['lgbtq'],
  },
  {
    slug: 'banned-political',
    title: 'Banned Political Books',
    header: 'Books banned for political content — dissent, criticism of governments, exiled voices, accounts of authoritarianism. Documented across democracies and autocracies alike, from Cold War prosecutions to contemporary national-security bans.',
    footer: 'Compiled by banned-books.org from court records, government registries, and international press-freedom monitors. The full record of political bans is at https://banned-books.org/reasons/political.',
    reasonsAny: ['political'],
  },
  {
    slug: 'banned-religious',
    title: 'Banned for Religion or Blasphemy',
    header: 'Books banned for religious content or charges of blasphemy — heretical doctrines, depictions of sacred figures, critiques of established faiths. Some of the longest-running censorship cases in publishing history sit in this category, from the Catholic Index to twentieth-century blasphemy prosecutions.',
    footer: 'Compiled by banned-books.org from religious indexes, prosecution records, and contemporary censorship monitors. Full case histories at https://banned-books.org/reasons/religious.',
    reasonsAny: ['religious', 'blasphemy'],
  },
  {
    slug: 'banned-race',
    title: 'Books Banned for Race and Racism',
    header: 'Books banned, challenged, or removed because they engage with race, racism, slavery, or racial justice. Targeted across centuries — and dominant once again in the current U.S. school-library wave. Toni Morrison, James Baldwin, Ibram X. Kendi, and Ta-Nehisi Coates appear repeatedly in the record below.',
    footer: 'Compiled by banned-books.org from PEN America, the ALA, and global censorship records. Full record — districts, dates, decisions — at https://banned-books.org/reasons/racial.',
    reasonsAny: ['racial'],
  },
  {
    slug: 'banned-sexuality',
    title: 'Books Banned for Sexual Content',
    header: 'Books banned on charges of sexual content, obscenity, or moral concern — a category that has long absorbed challenges to literature about bodies, desire, and adolescence. From the Comstock-era obscenity prosecutions and the Lady Chatterley trial to today\'s school-library wave.',
    footer: 'Compiled by banned-books.org from court records, school-district decisions, and global censorship monitors. Full case file at https://banned-books.org/reasons/sexual.',
    reasonsAny: ['sexual', 'obscenity', 'moral'],
  },

  // ── New 6 (2026-05-21) ──────────────────────────────────────────────────
  {
    slug: 'banned-in-us-schools',
    title: 'Banned in U.S. Schools',
    header: 'Books pulled from classrooms or school libraries in the United States — the dominant front in contemporary book banning. PEN America has tracked a sharp escalation since 2021, with Florida, Texas, and Tennessee leading the removals. These are the titles most frequently named in those records.',
    footer: 'Compiled by banned-books.org from PEN America\'s Index of School Book Bans and ALA challenge reports. Every district, state, and decision is documented at https://banned-books.org/scope/school.',
    scopesAny: ['school'],
    countriesAny: ['US'],
  },
  {
    slug: 'banned-by-the-church',
    title: 'Banned by the Church',
    header: 'Books prohibited by religious authority — most famously the Catholic Church\'s Index Librorum Prohibitorum, maintained from 1559 until 1966. The Index encompassed much of the intellectual foundation of the modern world. Galileo, Descartes, Spinoza, Locke, Kant, and Voltaire all appear in the record below.',
    footer: 'Compiled by banned-books.org from the Index Librorum Prohibitorum and related religious-authority records. Full set of religious-authority bans at https://banned-books.org/scope/church.',
    scopesAny: ['church'],
  },
  {
    slug: 'banned-classics',
    title: 'Banned Classics',
    header: 'Literary classics whose first documented ban dates from 1950 or earlier — Ulysses, Tropic of Cancer, Lady Chatterley\'s Lover, Candide, On the Origin of Species, The Metamorphosis. The books that helped define what censorship in the modern era looked like, and shaped the legal precedents we still live under.',
    footer: 'Compiled by banned-books.org. Full ban history for every title — courts, statutes, decades — at https://banned-books.org.',
    yearStartedMax: 1950,
  },
  {
    slug: 'most-banned-2020s',
    title: 'Most Banned in the 2020s',
    header: 'The books at the centre of the current wave. Every title here has documented ban events from 2020 onward — overwhelmingly in U.S. school districts, but also in national policies elsewhere. The titles most frequently named in this decade\'s removals so far.',
    footer: 'Compiled by banned-books.org. Live tracking of the contemporary book-banning wave at https://banned-books.org/trending-banned-books.',
    yearStartedMin: 2020,
  },
  {
    slug: 'pen-america-2024-25',
    title: 'PEN America Index 2024–25',
    header: 'The books most frequently banned in U.S. school districts during the 2024–25 academic year, drawn from PEN America\'s Index of School Book Bans. Ranked by total district-level removals. A near-realtime snapshot of the contemporary censorship landscape.',
    footer: 'Compiled by banned-books.org from PEN America\'s Index of School Book Bans (2024–25). For every district, state, and stated reason behind each title, visit https://banned-books.org.',
    fromSource: 'pen-america-2024-25',
  },
  {
    slug: 'banned-for-violence',
    title: 'Banned for Violent Content',
    header: 'Books challenged or removed on grounds of violent content — war, abuse, conflict, depictions of cruelty. The category ranges from anti-war literature to graphic novels about historical atrocities to YA fiction grappling with trauma.',
    footer: 'Compiled by banned-books.org. Full record of violence-related bans at https://banned-books.org/reasons/violence.',
    reasonsAny: ['violence'],
  },
] as const

// ── Raw shapes from Supabase ──────────────────────────────────────────────

type RawBan = {
  scope_id: number | null
  country_code: string | null
  year_started: number | null
  ban_reason_links: { reasons: { slug: string } | null }[] | null
}

type RawAuthor = { authors: { display_name: string } | null }

type RawBook = {
  id: number
  title: string
  isbn13: string | null
  bookshop_isbn13: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bans: RawBan[] | null
  book_authors: RawAuthor[] | null
}

type FlatBan = {
  scopeSlug: string | null
  countryCode: string | null
  yearStarted: number | null
  reasonSlugs: Set<string>
}

type EnrichedBook = {
  id: number
  title: string
  authorDisplay: string | null
  bookshopIsbn: string
  bans: FlatBan[]
}

// ── Data loaders ──────────────────────────────────────────────────────────

async function fetchScopeMap(): Promise<Map<number, string>> {
  const supabase = adminClient()
  const { data, error } = await supabase.from('scopes').select('id, slug')
  if (error) { console.error('Scopes fetch failed:', error.message); process.exit(1) }
  const m = new Map<number, string>()
  for (const r of data ?? []) m.set(r.id as number, r.slug as string)
  return m
}

async function fetchAllValidBooks(scopeMap: Map<number, string>): Promise<EnrichedBook[]> {
  const supabase = adminClient()
  const all: RawBook[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, isbn13, bookshop_isbn13, bookshop_status,
        bans(scope_id, country_code, year_started, ban_reason_links(reasons(slug))),
        book_authors(authors(display_name))
      `)
      .eq('bookshop_status', 'valid')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    all.push(...(data as unknown as RawBook[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
    .map(b => {
      const bookshopIsbn = b.bookshop_isbn13 ?? b.isbn13
      if (!bookshopIsbn) return null
      const bans: FlatBan[] = (b.bans ?? []).map(raw => {
        const slugs = new Set<string>()
        for (const link of raw.ban_reason_links ?? []) {
          if (link.reasons?.slug) slugs.add(link.reasons.slug)
        }
        return {
          scopeSlug: raw.scope_id != null ? scopeMap.get(raw.scope_id) ?? null : null,
          countryCode: raw.country_code ? raw.country_code.toUpperCase() : null,
          yearStarted: raw.year_started ?? null,
          reasonSlugs: slugs,
        }
      })
      const authorDisplay = b.book_authors?.[0]?.authors?.display_name ?? null
      return {
        id: b.id,
        title: b.title,
        authorDisplay,
        bookshopIsbn,
        bans,
      }
    })
    .filter((b): b is EnrichedBook => b != null)
}

// ── Filter + ranking (DB-driven lists) ────────────────────────────────────

function banMatches(ban: FlatBan, spec: ListSpec): boolean {
  if (spec.reasonsAny) {
    let ok = false
    for (const r of spec.reasonsAny) if (ban.reasonSlugs.has(r)) { ok = true; break }
    if (!ok) return false
  }
  if (spec.scopesAny) {
    if (!ban.scopeSlug || !spec.scopesAny.includes(ban.scopeSlug)) return false
  }
  if (spec.countriesAny) {
    if (!ban.countryCode || !spec.countriesAny.includes(ban.countryCode)) return false
  }
  if (spec.yearStartedMin != null) {
    if (ban.yearStarted == null || ban.yearStarted < spec.yearStartedMin) return false
  }
  if (spec.yearStartedMax != null) {
    if (ban.yearStarted == null || ban.yearStarted > spec.yearStartedMax) return false
  }
  return true
}

function hasAnyFilter(spec: ListSpec): boolean {
  return Boolean(
    spec.reasonsAny || spec.scopesAny || spec.countriesAny ||
    spec.yearStartedMin != null || spec.yearStartedMax != null
  )
}

type Pick = { book: EnrichedBook; rankCount: number }

function pickList(books: EnrichedBook[], spec: ListSpec): Pick[] {
  const filterActive = hasAnyFilter(spec)
  const picks: Pick[] = []
  for (const b of books) {
    if (!filterActive) {
      picks.push({ book: b, rankCount: b.bans.length })
      continue
    }
    let count = 0
    for (const ban of b.bans) if (banMatches(ban, spec)) count++
    if (count > 0) picks.push({ book: b, rankCount: count })
  }
  return picks
    .sort((a, b) => b.rankCount - a.rankCount || a.book.id - b.book.id)
    .slice(0, PER_LIST_LIMIT)
}

// ── PEN America 2024–25 (title+author matched against books) ─────────────

type PenRecord = { title?: string; author?: string }

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// PEN authors are "Last, First [Middle]" — normalize to the last-name token
// only so we tolerate middle-name and ordering variations on our side.
function lastNameKey(authorRaw: string | null | undefined): string {
  if (!authorRaw) return ''
  const trimmed = authorRaw.trim()
  // "Last, First" → "Last"
  if (trimmed.includes(',')) {
    return normTitle(trimmed.split(',')[0])
  }
  // "First Last" → "Last"
  const parts = trimmed.split(/\s+/)
  return normTitle(parts[parts.length - 1] ?? '')
}

function bookKey(title: string, author: string | null): string {
  return `${normTitle(title)}|${lastNameKey(author)}`
}

function loadPenCounts(): Map<string, number> {
  const path = join(process.cwd(), 'data', 'pen-america-2024-25.json')
  const raw = readFileSync(path, 'utf8')
  const records: PenRecord[] = JSON.parse(raw)
  const counts = new Map<string, number>()
  for (const r of records) {
    if (!r.title || !r.author) continue
    const key = bookKey(r.title, r.author)
    if (!key.startsWith('|')) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function pickPenList(books: EnrichedBook[], penCounts: Map<string, number>): Pick[] {
  const picks: Pick[] = []
  for (const b of books) {
    const key = bookKey(b.title, b.authorDisplay)
    const count = penCounts.get(key)
    if (count && count > 0) picks.push({ book: b, rankCount: count })
  }
  return picks
    .sort((a, b) => b.rankCount - a.rankCount || a.book.id - b.book.id)
    .slice(0, PER_LIST_LIMIT)
}

// ── Writers ───────────────────────────────────────────────────────────────

function rankLabel(spec: ListSpec): string {
  if (spec.fromSource === 'pen-america-2024-25') return 'PEN America 2024–25 records'
  if (hasAnyFilter(spec)) return 'matching ban events'
  return 'total ban events'
}

function writeList(spec: ListSpec, picks: Pick[]): void {
  const dir = join(OUT_DIR, spec.slug)
  mkdirSync(dir, { recursive: true })

  const csv = picks.map(p => p.book.bookshopIsbn).join('\n') + '\n'
  writeFileSync(join(dir, 'isbns.csv'), csv)

  const md = `# ${spec.title}

**Layout:** Linear
**Show on shop page:** yes
**Books in list:** ${picks.length}

## Title
\`\`\`
${spec.title}
\`\`\`

## Header text
\`\`\`
${spec.header}
\`\`\`

## Footer text
\`\`\`
${spec.footer}
\`\`\`

## Books (top ${picks.length} by ${rankLabel(spec)})
${picks.map((p, i) => `${i + 1}. ${p.book.bookshopIsbn} — ${p.book.title} (${p.rankCount})`).join('\n')}
`
  writeFileSync(join(dir, 'metadata.md'), md)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── export-bookshop-lists ──\n')
  const scopeMap = await fetchScopeMap()
  console.log(`Scopes loaded: ${scopeMap.size}`)
  const books = await fetchAllValidBooks(scopeMap)
  console.log(`Books with bookshop_status='valid': ${books.length}`)

  const penCounts = loadPenCounts()
  console.log(`PEN America 2024–25 unique title+author keys: ${penCounts.size}\n`)

  for (const spec of LISTS) {
    const picks = spec.fromSource === 'pen-america-2024-25'
      ? pickPenList(books, penCounts)
      : pickList(books, spec)
    writeList(spec, picks)
    const warn = picks.length < 15 ? '  ⚠ small list' : ''
    console.log(`  ${spec.slug.padEnd(22)} → ${String(picks.length).padStart(2)} ISBNs${warn}`)
  }

  console.log(`
Output written to ${OUT_DIR}

Next: log in to https://bookshop.org/affiliates/lists, click "Create A New
Book List", paste the title + header + footer from each metadata.md, then
upload the matching isbns.csv via the "Upload CSV" button.
`)
}

main().catch(e => { console.error(e); process.exit(1) })
