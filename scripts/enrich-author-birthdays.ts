/**
 * Fill authors.birth_month / birth_day from Wikidata P569 (date of birth, CC-0)
 * for the most-banned + award-winning authors, then mark a curated ~30 with
 * birthday_featured so their birthday triggers a Bluesky book-of-the-day push.
 *
 * Candidate set (broad, so the curated 30 has room): the top authors by number
 * of POSTABLE banned books (same gate as the Bluesky picker) UNION authors with
 * any literary award (Nobel/Pulitzer). Enriching wide is cheap and keeps the
 * final featured selection a pure curation step.
 *
 * Match gate (namesake-safe): wbsearchentities by name → the entity must be a
 * human (P31 = Q5) AND its P569 year must equal the author's stored birth_year
 * (the strong disambiguator), AND P569 precision must reach day level. Anything
 * that fails lands in the review file, never the DB. Authors with no stored
 * birth_year are routed to review (can't disambiguate a namesake safely).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-birthdays.ts                 # dry-run dates
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-birthdays.ts --apply         # write dates
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-birthdays.ts --feature       # curate the 30 (after dates)
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-birthdays.ts --feature --apply
 *   flags: --candidates=70  --data-slots=22  --award-slots=8
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { LATIN_SCRIPT_LANGS } from '../src/lib/top-list-data'
import { isApply, intFlag } from './lib/cli'

const APPLY = isApply()
const FEATURE = process.argv.includes('--feature')
const N_CANDIDATES = intFlag('candidates', 70)
const DATA_SLOTS = intFlag('data-slots', 15)
const LIT_SLOTS = intFlag('lit-slots', 15)

// Canonical, instantly-recognisable banned authors. They tend to have few
// distinct *postable* titles (so they miss the data top) and most never won a
// Nobel/Pulitzer (so they miss the award slots) — yet for a banned-books site
// they're the iconic names. We add them to the enrichment candidate set and
// give them first claim on the literary slots. Matched by case-insensitive
// substring on display_name; only featured if they have a postable book + a
// resolved birthday.
const CURATED_GIANTS = [
  'George Orwell', 'Margaret Atwood', 'Ray Bradbury', 'Kurt Vonnegut', 'Aldous Huxley',
  'Harper Lee', 'Salinger', 'Maya Angelou', 'Salman Rushdie', 'Vladimir Nabokov',
  'Judy Blume', 'Alice Walker', 'Mark Twain', 'Toni Morrison', 'John Steinbeck',
]
const isGiant = (name: string) => CURATED_GIANTS.some(g => name.toLowerCase().includes(g.toLowerCase()))

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData'
const UA = 'banned-books.org author-birthday enrichment (https://www.banned-books.org; ludo.raedts@voys.nl)'
const MIN_BANS = 2
const HUMAN = 'Q5'
const NON_PERSON = new Set(['Anonymous', 'Unknown', 'Various', 'Various Authors'])

const sb = adminClient()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type AuthorStat = {
  id: number
  name: string
  slug: string
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
  awarded: boolean
  books: number
  bans: number
}

/** All authors with >=1 postable banned book, with their current birth fields. */
async function loadAuthorStats(): Promise<AuthorStat[]> {
  const byAuthor = new Map<number, AuthorStat>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select(
        'id, bans(country_code), book_authors!inner(authors!inner(id, display_name, slug, birth_year, birth_month, birth_day, awards))',
      )
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      id: number
      bans: Array<{ country_code: string | null }> | null
      book_authors: Array<{ authors: { id: number; display_name: string; slug: string; birth_year: number | null; birth_month: number | null; birth_day: number | null; awards: unknown } | null }> | null
    }>
    for (const r of rows) {
      const bans = r.bans ?? []
      const hasNonUs = bans.some(b => b.country_code && b.country_code !== 'US')
      if (!(bans.length >= MIN_BANS || hasNonUs)) continue
      for (const ba of r.book_authors ?? []) {
        const a = ba.authors
        if (!a) continue
        const cur = byAuthor.get(a.id) ?? {
          id: a.id, name: a.display_name, slug: a.slug,
          birthYear: a.birth_year, birthMonth: a.birth_month, birthDay: a.birth_day,
          awarded: Array.isArray(a.awards) && a.awards.length > 0,
          books: 0, bans: 0,
        }
        cur.books += 1
        cur.bans += bans.length
        byAuthor.set(a.id, cur)
      }
    }
    if (rows.length < PAGE) break
  }
  return [...byAuthor.values()]
}

// ── Wikidata ────────────────────────────────────────────────────────────────
interface WdEntity {
  id: string
  labels: Record<string, { value: string }>
  claims: Record<string, Array<{ mainsnak: { datavalue?: { value: unknown } } }>>
}

async function wdSearch(name: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=7&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const json = (await res.json()) as { search?: Array<{ id: string }> }
  return (json.search ?? []).map(s => s.id)
}

async function wdEntity(qid: string): Promise<WdEntity | null> {
  const res = await fetch(`${WD_ENTITY}/${qid}.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const json = (await res.json()) as { entities: Record<string, WdEntity> }
  return json.entities[qid] ?? null
}

function claimQids(e: WdEntity, prop: string): string[] {
  return (e.claims[prop] ?? [])
    .map(c => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x)
}

/** Parse P569 → {year, month, day} only when precision reaches day level. */
function p569DayPrecise(e: WdEntity): { year: number; month: number; day: number } | null {
  const c = e.claims['P569']?.[0]
  const v = c?.mainsnak?.datavalue?.value as { time?: string; precision?: number } | undefined
  if (!v?.time || (v.precision ?? 0) < 11) return null
  const m = /^[+-](\d{4,})-(\d{2})-(\d{2})T/.exec(v.time)
  if (!m) return null
  const year = +m[1], month = +m[2], day = +m[3]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

type Resolved =
  | { ok: true; qid: string; month: number; day: number; year: number }
  | { ok: false; reason: string; triedQids: string[] }

async function resolveBirthday(a: AuthorStat): Promise<Resolved> {
  if (a.birthYear == null) return { ok: false, reason: 'no-birth-year-to-disambiguate', triedQids: [] }
  let qids: string[] = []
  try { qids = await wdSearch(a.name) } catch { return { ok: false, reason: 'search-error', triedQids: [] } }
  if (qids.length === 0) return { ok: false, reason: 'no-search-hit', triedQids: [] }

  const tried: string[] = []
  for (const qid of qids) {
    tried.push(qid)
    await delay(120)
    const e = await wdEntity(qid)
    if (!e) continue
    if (!claimQids(e, 'P31').includes(HUMAN)) continue // must be a person
    const dob = p569DayPrecise(e)
    if (!dob) continue
    if (dob.year !== a.birthYear) continue // namesake guard: birth year must match
    return { ok: true, qid, month: dob.month, day: dob.day, year: dob.year }
  }
  return { ok: false, reason: 'no-human-with-matching-birth-year-and-day', triedQids: tried }
}

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Curation: pick the featured ~30 (data-driven core + award-winners) ────────
function pickFeatured(stats: AuthorStat[]): AuthorStat[] {
  const haveBday = stats.filter(a => a.birthMonth != null && a.birthDay != null && !NON_PERSON.has(a.name))
  const byBooks = [...haveBday].sort((a, b) => b.books - a.books || b.bans - a.bans)
  const chosen = new Map<number, AuthorStat>()
  // Data-driven core: the most-banned postable authors.
  for (const a of byBooks) { if (chosen.size >= DATA_SLOTS) break; chosen.set(a.id, a) }
  // Literary slots: curated banned icons first (in list order), then any
  // remaining award-winners by book count — a deliberate mix of timeless names
  // alongside the contemporary data core.
  const giantOrder = (a: AuthorStat) => {
    const i = CURATED_GIANTS.findIndex(g => a.name.toLowerCase().includes(g.toLowerCase()))
    return i === -1 ? Infinity : i
  }
  const literary = [
    ...byBooks.filter(a => isGiant(a.name)).sort((a, b) => giantOrder(a) - giantOrder(b)),
    ...byBooks.filter(a => a.awarded && !isGiant(a.name)),
  ]
  for (const a of literary) { if (chosen.size >= DATA_SLOTS + LIT_SLOTS) break; chosen.set(a.id, a) }
  return [...chosen.values()]
}

async function runFeature() {
  const stats = await loadAuthorStats()
  const featured = pickFeatured(stats)
  console.log(`\nCurated featured set (${featured.length}) — data top ${DATA_SLOTS} + ${LIT_SLOTS} literary slots:\n`)
  console.log('books bans  tag    birthday   author')
  for (const a of [...featured].sort((x, y) => y.books - x.books)) {
    const bd = `${String(a.birthMonth).padStart(2, '0')}-${String(a.birthDay).padStart(2, '0')}`
    const tag = isGiant(a.name) ? ' icon' : a.awarded ? ' ★   ' : '     '
    console.log(`${String(a.books).padStart(5)} ${String(a.bans).padStart(4)}  ${tag}  ${bd}      ${a.name}  (#${a.id})`)
  }
  if (!APPLY) { console.log('\nDry-run. Re-run with --feature --apply to set birthday_featured.'); return }

  const ids = featured.map(a => a.id)
  // Reset then set, so the curated set is authoritative (idempotent).
  await sb.from('authors').update({ birthday_featured: false }).eq('birthday_featured', true)
  const { error } = await sb.from('authors').update({ birthday_featured: true }).in('id', ids)
  if (error) throw new Error(error.message)
  console.log(`\nApplied. ${ids.length} authors now birthday_featured.`)
}

async function runEnrich() {
  const stats = await loadAuthorStats()
  const ranked = [...stats].sort((a, b) => b.books - a.books || b.bans - a.bans)
  // Candidate set: top N by postable books + every awarded author + the curated
  // banned icons (so they're enriched even with few titles / no award).
  const candidates = new Map<number, AuthorStat>()
  for (const a of ranked.slice(0, N_CANDIDATES)) candidates.set(a.id, a)
  for (const a of ranked.filter(x => x.awarded || isGiant(x.name))) candidates.set(a.id, a)
  // Skip non-person bylines and authors already enriched.
  const todo = [...candidates.values()].filter(a => !NON_PERSON.has(a.name) && (a.birthMonth == null || a.birthDay == null))

  console.log(`Candidates: ${candidates.size}   Already have birthday: ${candidates.size - todo.length}   To resolve: ${todo.length}\n`)

  const ok: Array<AuthorStat & { qid: string; month: number; day: number }> = []
  const failed: Array<{ author: AuthorStat; reason: string; triedQids: string[] }> = []
  for (const a of todo) {
    const r = await resolveBirthday(a)
    if (r.ok) {
      ok.push({ ...a, qid: r.qid, month: r.month, day: r.day })
      console.log(`  ✓ ${a.name} → ${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')} (${r.year}) ${r.qid}`)
    } else {
      failed.push({ author: a, reason: r.reason, triedQids: r.triedQids })
      console.log(`  · ${a.name} — ${r.reason}`)
    }
    await delay(120)
  }

  const date = ymdToday()
  const jsonPath = `data/author-birthday-enrichment-${date}.json`
  const mdPath = `data/author-birthday-enrichment-${date}.md`
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: date, applied: APPLY, resolved: ok, failed }, null, 2))
  const md = [
    `# Author birthday enrichment — ${date}`,
    ``,
    `Resolved **${ok.length}**, unresolved **${failed.length}** (of ${todo.length} attempted).`,
    ``,
    `## Resolved (birth_month-birth_day, Wikidata)`,
    ``,
    `| author | birthday | year | books | qid |`,
    `| --- | --- | --- | --- | --- |`,
    ...ok.sort((a, b) => b.books - a.books).map(a => `| ${a.name} | ${String(a.month).padStart(2, '0')}-${String(a.day).padStart(2, '0')} | ${a.year ?? ''} | ${a.books} | [${a.qid}](https://www.wikidata.org/wiki/${a.qid}) |`),
    ``,
    `## Unresolved (left null, for review)`,
    ``,
    `| author | reason | birth_year | books |`,
    `| --- | --- | --- | --- |`,
    ...failed.map(f => `| ${f.author.name} | ${f.reason} | ${f.author.birthYear ?? ''} | ${f.author.books} |`),
    ``,
  ].join('\n')
  writeFileSync(mdPath, md)
  console.log(`\nReview files: ${jsonPath} , ${mdPath}`)

  if (!APPLY) { console.log('\nDry-run. Re-run with --apply to write birth_month/birth_day.'); return }
  let written = 0
  for (const a of ok) {
    const { error } = await sb.from('authors').update({ birth_month: a.month, birth_day: a.day }).eq('id', a.id)
    if (error) { console.error(`  ! ${a.name}: ${error.message}`); continue }
    written++
  }
  console.log(`\nApplied. Wrote birthday to ${written} authors.`)
}

async function main() {
  if (FEATURE) await runFeature()
  else await runEnrich()
}

main().catch(e => { console.error(e); process.exit(1) })
