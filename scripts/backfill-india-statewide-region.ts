/**
 * Backfill `bans.region` (the state-name field) for existing India bans whose
 * upstream Wikipedia row came from the Statewide section of
 * https://en.wikipedia.org/wiki/List_of_books_banned_in_India.
 *
 * The May 14 Wikipedia bulk-importer correctly parsed 37 Statewide rows but
 * the ban-write path threw away the state cell — those bans now sit in DB
 * with `region=NULL`. This script re-fetches the Wikipedia page, parses the
 * Statewide table, matches each row to existing IN bans by (slugified title
 * + year_started), and populates `region` with the state value.
 *
 * Per-row natural key: (book_slug, year_started). When a row matches multiple
 * IN bans, prefer the one with the same year_started; fall back to the single
 * IN ban for that book if year_started is NULL on either side; skip if
 * ambiguous.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-india-statewide-region.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-india-statewide-region.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')
const WIKI_PAGE = 'List_of_books_banned_in_India'

// Strip [[wikilinks|display]] → "display", remove <ref>…</ref>, drop italics ''…''.
function cleanCell(s: string): string {
  return s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')   // [[A|B]] → B
    .replace(/\[\[([^\]]+)\]\]/g, '$1')             // [[A]] → A
    .replace(/''([^']+)''/g, '$1')
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Wikipedia's "Punjab, India" / "[[Punjab, India|Punjab]]" / "Punjab" all
// canonicalise to "Punjab" — drop the disambiguating " India" suffix because
// every state on this page is in India by definition.
function canonicalState(raw: string): string {
  let s = cleanCell(raw)
  // Drop ", India" suffix (e.g. "Punjab, India" → "Punjab")
  s = s.replace(/,\s*India$/i, '').trim()
  // Multi-state cells: "Maharashtra, Tamil Nadu" stays as-is
  return s
}

interface WikiRow {
  year: number | null
  title: string
  author: string
  state: string
  notes: string
}

function parseStatewide(wikitext: string): WikiRow[] {
  const idx = (() => {
    const a = wikitext.indexOf('==Statewide==')
    const b = wikitext.indexOf('== Statewide ==')
    return a >= 0 ? a : b
  })()
  if (idx < 0) throw new Error('parseStatewide: section not found')

  // Locate next H2 to bound the section
  const after = wikitext.slice(idx + 10)
  const nextH2 = after.search(/\n==[^=]/)
  const end = nextH2 >= 0 ? idx + 10 + nextH2 : wikitext.length
  const section = wikitext.slice(idx, end)

  // Extract the wikitable
  const tStart = section.indexOf('{|')
  const tEnd = section.indexOf('|}', tStart)
  const table = section.slice(tStart, tEnd)

  // Split on row separators
  const rawRows = table.split(/\n\|-/).map(r => r.trim())
  // First entry is the table opener + header row; skip
  const dataRows = rawRows.slice(1)

  const rows: WikiRow[] = []
  for (const raw of dataRows) {
    // Each row's cells are separated by `\n|` (or `||` inline). We use `\n|`
    // because every cell is on its own line in this table.
    const cells = raw.split('\n|').map(c => c.replace(/^\s*\|?\s*/, '').trim()).filter(Boolean)
    if (cells.length < 4) continue   // header or malformed
    const [dateRaw, workRaw, authorRaw, stateRaw, ...rest] = cells
    const yearMatch = dateRaw.match(/\d{4}/)
    rows.push({
      year: yearMatch ? parseInt(yearMatch[0]) : null,
      title: cleanCell(workRaw),
      author: cleanCell(authorRaw),
      state: canonicalState(stateRaw),
      notes: cleanCell(rest.join(' ')),
    })
  }
  return rows
}

async function fetchWikipediaWikitext(page: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`
  const res = await fetch(url, { headers: { 'User-Agent': 'banned-books.org-research/1.0' } })
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`)
  const json = await res.json() as { parse?: { wikitext?: string } }
  const wt = json.parse?.wikitext
  if (!wt) throw new Error('Wikipedia returned no wikitext')
  return wt
}

async function main() {
  console.log(`\n── backfill-india-statewide-region — ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  console.log('Fetching Wikipedia page...')
  const wikitext = await fetchWikipediaWikitext(WIKI_PAGE)
  const rows = parseStatewide(wikitext)
  console.log(`Statewide rows parsed: ${rows.length}`)

  const supabase = adminClient()

  // Pull all IN bans + book slugs
  const { data: banData, error: banErr } = await supabase
    .from('bans')
    .select('id, book_id, year_started, region, books(title, slug)')
    .eq('country_code', 'IN')
  if (banErr) throw banErr

  type BanRow = {
    id: number; book_id: number; year_started: number | null
    region: string | null
    books: { title: string; slug: string } | null
  }
  const inBans = (banData as unknown as BanRow[]) ?? []
  // Index by book slug
  const bansBySlug = new Map<string, BanRow[]>()
  for (const b of inBans) {
    if (!b.books) continue
    const list = bansBySlug.get(b.books.slug) ?? []
    list.push(b)
    bansBySlug.set(b.books.slug, list)
  }

  console.log(`IN bans in DB:       ${inBans.length}`)
  console.log(`IN ban-slug groups:  ${bansBySlug.size}`)

  type Plan =
    | { kind: 'will_update'; ban_id: number; book_slug: string; old_region: string | null; new_region: string; wiki_year: number | null; wiki_title: string }
    | { kind: 'noop_already_set'; ban_id: number; book_slug: string; region: string; wiki_title: string }
    | { kind: 'no_book'; wiki_title: string; wiki_state: string; wiki_year: number | null }
    | { kind: 'ambiguous'; book_slug: string; candidate_ban_ids: number[]; wiki_title: string; wiki_state: string; wiki_year: number | null }

  const plans: Plan[] = []

  for (const row of rows) {
    const slug = slugify(row.title)
    const candidateBans = bansBySlug.get(slug) ?? []

    if (candidateBans.length === 0) {
      plans.push({ kind: 'no_book', wiki_title: row.title, wiki_state: row.state, wiki_year: row.year })
      continue
    }

    // Prefer the ban with matching year_started, else fall back to the single ban
    let target: BanRow | undefined
    if (row.year != null) {
      target = candidateBans.find(b => b.year_started === row.year)
    }
    if (!target) {
      if (candidateBans.length === 1) target = candidateBans[0]
      else {
        plans.push({
          kind: 'ambiguous', book_slug: slug,
          candidate_ban_ids: candidateBans.map(b => b.id),
          wiki_title: row.title, wiki_state: row.state, wiki_year: row.year,
        })
        continue
      }
    }

    if (target.region != null && target.region.trim().length > 0) {
      plans.push({
        kind: 'noop_already_set', ban_id: target.id, book_slug: slug,
        region: target.region, wiki_title: row.title,
      })
      continue
    }

    plans.push({
      kind: 'will_update', ban_id: target.id, book_slug: slug,
      old_region: target.region, new_region: row.state,
      wiki_year: row.year, wiki_title: row.title,
    })
  }

  const willUpdate = plans.filter(p => p.kind === 'will_update')
  const noopAlreadySet = plans.filter(p => p.kind === 'noop_already_set')
  const noBook = plans.filter(p => p.kind === 'no_book')
  const ambiguous = plans.filter(p => p.kind === 'ambiguous')

  console.log(`\n── Plan summary`)
  console.log(`  will update region:    ${willUpdate.length}`)
  console.log(`  already set (no-op):   ${noopAlreadySet.length}`)
  console.log(`  no matching book:      ${noBook.length}`)
  console.log(`  ambiguous (skipped):   ${ambiguous.length}`)

  console.log(`\n── Will-update sample (first 15)`)
  for (const p of willUpdate.slice(0, 15) as Extract<Plan, { kind: 'will_update' }>[]) {
    console.log(`  ban ${String(p.ban_id).padStart(5)}  yr=${p.wiki_year ?? '????'}  → region="${p.new_region}"  (${p.wiki_title})`)
  }

  if (noBook.length) {
    console.log(`\n── No matching book (slug not in IN-bans). First 15:`)
    for (const p of noBook.slice(0, 15) as Extract<Plan, { kind: 'no_book' }>[]) {
      console.log(`  yr=${p.wiki_year ?? '????'}  "${p.wiki_title}"  → state="${p.wiki_state}"`)
    }
  }

  if (ambiguous.length) {
    console.log(`\n── Ambiguous (multiple bans, no year match). First 10:`)
    for (const p of ambiguous.slice(0, 10) as Extract<Plan, { kind: 'ambiguous' }>[]) {
      console.log(`  "${p.wiki_title}" (${p.wiki_state})  yr=${p.wiki_year ?? '????'}  candidate_ban_ids=${p.candidate_ban_ids.join(',')}`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply to write. ──\n`)
    return
  }

  // ── APPLY ──
  console.log(`\n── Applying ${willUpdate.length} region updates ──`)
  let updated = 0
  let errors = 0
  for (const p of willUpdate as Extract<Plan, { kind: 'will_update' }>[]) {
    const { error } = await supabase.from('bans').update({ region: p.new_region }).eq('id', p.ban_id)
    if (error) {
      console.error(`  ! ban ${p.ban_id}: ${error.message}`)
      errors++
    } else {
      updated++
    }
  }
  console.log(`\nDone. ${updated} bans updated, ${errors} errors.`)
}

main().catch(err => { console.error(err); process.exit(1) })
