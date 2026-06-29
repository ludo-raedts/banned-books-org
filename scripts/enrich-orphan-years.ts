/**
 * Verify the publication year of "placeholder-year" orphan books against
 * OpenLibrary's work-level first_publish_year (the true first-publication year,
 * not an edition date).
 *
 * Target set (Class C, see data/placeholder-year-review-2026-06-29.md):
 *   first_published_year == earliest ban year  AND  no isbn13  AND  no
 *   openlibrary_work_id  — i.e. the importer likely defaulted the publication
 *   year to the ban year, and we have no key to verify it.
 *
 * For each, search OpenLibrary and accept a candidate ONLY when BOTH guards
 * pass (this is the namesake / same-title protection the project doctrine
 * requires):
 *   • author agreement — a candidate author-name token overlaps ours
 *   • bidirectional title match — our title's tokens ⊆ candidate's OR vice
 *     versa (handles OL returning the short main-title "Pride" for our
 *     "Pride: The Celebration and the Struggle")
 *
 * On a guarded match we backfill openlibrary_work_id + isbn13 (UNIQUE-safe)
 * and set first_published_year to OL's verified value:
 *   • confirmed  — OL year == our placeholder → year was actually correct;
 *                  we only backfill the keys (now enrichable)
 *   • corrected  — OL year != placeholder → placeholder was wrong; year fixed
 * No match → left untouched (stays on the watchlist).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-orphan-years.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/enrich-orphan-years.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-orphan-years.ts --limit=30
 */

import { adminClient } from '../src/lib/supabase'
import { titlesMatch } from '../src/lib/enrich/title-match'

const APPLY = process.argv.includes('--apply')
// Year corrections (overwriting the placeholder) are REVIEW-GATED: even with
// both guards (author+title match, year <= ban year) OpenLibrary can carry a
// junk first_publish_year that's earlier than the ban (e.g. "I Knew Hitler"
// catalogued as 1770), which no automated invariant can distinguish from a
// genuinely old book banned later. Backfilling keys is safe under --apply;
// changing the year additionally requires --write-year-corrections after a
// human has read the printed CORRECTED list.
const WRITE_CORRECTIONS = process.argv.includes('--write-year-corrections')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : Infinity
const UA = 'banned-books.org/1.0 (contact@banned-books.org)'

const sb = adminClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function nameTokens(s: string): Set<string> {
  return new Set(
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length > 1),
  )
}
function authorAgrees( our: string, cands: string[]): boolean {
  const o = nameTokens(our)
  if (!o.size) return false
  for (const c of cands) {
    const ct = nameTokens(c)
    for (const t of o) if (ct.has(t)) return true
  }
  return false
}
function biTitleMatch(our: string, cand: string): boolean {
  return titlesMatch(our, cand) || titlesMatch(cand, our)
}

type Doc = { title?: string; author_name?: string[]; first_publish_year?: number; key?: string; isbn?: string[] }

async function olSearch(title: string, author: string): Promise<Doc[]> {
  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('q', `${title} ${author}`)
  url.searchParams.set('fields', 'title,author_name,first_publish_year,key,isbn')
  url.searchParams.set('limit', '5')
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) return []
  const j: any = await r.json()
  return j.docs ?? []
}

async function isbnTaken(isbn: string, selfId: number): Promise<boolean> {
  const { data } = await sb.from('books').select('id').eq('isbn13', isbn).neq('id', selfId).maybeSingle()
  return !!data
}

async function loadTargets(): Promise<any[]> {
  const out: any[] = []; const P = 1000
  for (let f = 0; ; f += P) {
    const { data } = await sb.from('books')
      .select('id, slug, title, first_published_year, isbn13, openlibrary_work_id, book_authors(authors(display_name)), bans(year_started)')
      .order('id', { ascending: true }).range(f, f + P - 1)
    out.push(...(data ?? [])); if (!data || data.length < P) break
  }
  return out.filter((b) => {
    if (!b.first_published_year || b.isbn13 || b.openlibrary_work_id) return false
    const ys = (b.bans ?? []).map((x: any) => x.year_started).filter(Boolean)
    return ys.length && b.first_published_year === Math.min(...ys)
  })
}

async function main() {
  const targets = (await loadTargets()).slice(0, LIMIT)
  console.log(`── enrich-orphan-years (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${targets.length} targets ──\n`)

  let confirmed = 0, corrected = 0, noMatch = 0, noYear = 0, isbnSkipped = 0
  const correctedRows: string[] = []
  const confirmedRows: string[] = []

  for (const b of targets) {
    const author = (b.book_authors ?? []).map((x: any) => x.authors?.display_name).filter(Boolean)[0] ?? ''
    if (!author) { noMatch++; continue }
    // Invariant: a book cannot have been first published AFTER it was banned.
    // OL sometimes returns a later reprint's date (or junk) as first_publish_year;
    // capping at the earliest ban year rejects those impossible matches.
    const earliestBan = Math.min(...(b.bans ?? []).map((x: any) => x.year_started).filter(Boolean))
    let docs: Doc[] = []
    try { docs = await olSearch(b.title, author) } catch { /* net */ }
    await sleep(250)

    const matches = docs.filter((d) =>
      d.key && d.title && typeof d.first_publish_year === 'number' &&
      d.first_publish_year >= 1400 && d.first_publish_year <= 2026 &&
      d.first_publish_year <= earliestBan &&
      authorAgrees(author, d.author_name ?? []) && biTitleMatch(b.title, d.title),
    )
    if (!matches.length) {
      if (docs.some((d) => d.title && authorAgrees(author, d.author_name ?? []) && biTitleMatch(b.title, d.title))) noYear++
      else noMatch++
      continue
    }
    // earliest guarded year = true first publication
    const best = matches.reduce((a, c) => (c.first_publish_year! < a.first_publish_year! ? c : a))
    const olYear = best.first_publish_year!
    const workId = best.key!.replace('/works/', '')
    let isbn: string | null = (best.isbn ?? []).find((x) => /^\d{13}$/.test(x)) ?? null
    if (isbn && (await isbnTaken(isbn, b.id))) { isbn = null; isbnSkipped++ }

    const update: any = { openlibrary_work_id: workId }
    if (isbn) update.isbn13 = isbn

    if (olYear === b.first_published_year) {
      confirmed++
      confirmedRows.push(`  = [${b.id}] ${b.title} — OL confirms ${olYear}; backfill work_id${isbn ? '+isbn' : ''}`)
    } else {
      corrected++
      // year-correction is review-gated; only include the year when explicitly allowed
      if (WRITE_CORRECTIONS) update.first_published_year = olYear
      correctedRows.push(`  ~ [${b.id}] ${b.title} (${author}) — ${b.first_published_year} → ${olYear}  [${workId}]${WRITE_CORRECTIONS ? '' : '  (year NOT written — needs --write-year-corrections)'}`)
    }
    if (APPLY) {
      const { error } = await sb.from('books').update(update).eq('id', b.id)
      if (error) throw error
    }
  }

  console.log('CORRECTED (placeholder → OL verified year):')
  correctedRows.forEach((r) => console.log(r))
  console.log('\nCONFIRMED (year was right; keys backfilled):')
  confirmedRows.slice(0, 40).forEach((r) => console.log(r))
  if (confirmedRows.length > 40) console.log(`  …+${confirmedRows.length - 40} more`)
  console.log('\n── Summary ──')
  console.log(`Corrected (year fixed) : ${corrected}`)
  console.log(`Confirmed (keys added) : ${confirmed}`)
  console.log(`Match but no OL year   : ${noYear}`)
  console.log(`No guarded match       : ${noMatch}`)
  console.log(`ISBN collisions skipped: ${isbnSkipped}`)
  if (!APPLY) console.log('\nDRY-RUN — re-run with --apply to write.')
}

main()
