#!/usr/bin/env tsx
/**
 * Populate the `awards` JSONB columns on authors (Nobel) and books (Pulitzer)
 * from the hand-verified overlap — see data/award-overlap.md and the
 * migration 20260613100000_books_authors_awards.sql.
 *
 * Sources (deterministic, re-fetched each run):
 *   - Nobel Prize in Literature: api.nobelprize.org/2.1 (CC0). Author-level →
 *     written to authors.awards as {award:"Nobel Prize in Literature", year}.
 *   - Pulitzer Fiction (Q833633) + Novel (Q1155483): Wikidata SPARQL.
 *     Work-level → written to books.awards as {award:"Pulitzer Prize",
 *     category:"Fiction"|"Novel", year}.
 *   - Maus (Pulitzer Special Citation 1992): added by hand, not in the SPARQL
 *     category entities.
 *
 * Matching is normalized title+author string equality (no ISBNs on Wikidata).
 * Hand-verification findings baked in:
 *   - EXCLUDE book id 1286 ("Fable" by Adrienne Young) — title collision with
 *     Faulkner's "A Fable", NOT the same book.
 *   - Lonesome Dove matches despite the DB author typo "Larry McMurty".
 *
 * Writes are idempotent: existing award entries with the same (award,category)
 * key are replaced, others preserved. Default is a dry-run.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-awards.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/enrich-awards.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const UA = 'banned-books-org-research/1.0 (award enrichment; ludo.raedts@voys.nl)'

// Book ids that title-matched a Pulitzer work but are a DIFFERENT book.
const EXCLUDE_BOOK_IDS = new Set<number>([1286]) // "Fable" (Adrienne Young) vs Faulkner's "A Fable"

type Award = { award: string; year: number; category?: string }
const awardKey = (a: Award) => `${a.award}|${a.category || ''}`

function mergeAward(existing: Award[], next: Award): Award[] {
  const kept = (existing || []).filter((a) => awardKey(a) !== awardKey(next))
  return [...kept, next].sort((a, b) => a.year - b.year)
}

// ---------- normalization ----------
function norm(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const normTitle = (s: string) => norm(s).replace(/^(the|a|an) /, '')
function lastName(s: string): string {
  const n = norm(s).split(' ').filter(Boolean)
  return n[n.length - 1] || ''
}

// ---------- sources ----------
async function fetchNobel(): Promise<{ year: number; name: string }[]> {
  const out: { year: number; name: string }[] = []
  let offset = 0
  for (;;) {
    const r = await fetch(
      `https://api.nobelprize.org/2.1/laureates?nobelPrizeCategory=lit&limit=100&offset=${offset}`,
      { headers: { 'User-Agent': UA } },
    )
    const j: any = await r.json()
    const batch: any[] = j.laureates || []
    if (batch.length === 0) break
    for (const l of batch) {
      const prize =
        (l.nobelPrizes || []).find((p: any) => (p.category?.en || '').toLowerCase() === 'literature') ||
        l.nobelPrizes?.[0]
      const name = l.knownName?.en || l.fullName?.en
      if (name && prize?.awardYear) out.push({ year: Number(prize.awardYear), name })
    }
    offset += batch.length
    if (batch.length < 100) break
  }
  return out
}

async function fetchPulitzer(): Promise<{ year: number; title: string; author: string; category: string }[]> {
  const query = `
    SELECT ?awardLabel ?workLabel ?authorLabel ?year WHERE {
      VALUES ?award { wd:Q833633 wd:Q1155483 }
      ?work p:P166 ?st . ?st ps:P166 ?award .
      OPTIONAL { ?st pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
      OPTIONAL { ?work wdt:P50 ?author }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`
  const r = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  })
  const j: any = await r.json()
  return (j.results?.bindings || [])
    .filter((b: any) => b.year?.value)
    .map((b: any) => ({
      year: Number(b.year.value),
      title: b.workLabel?.value || '',
      author: b.authorLabel?.value || '',
      category: /Novel/.test(b.awardLabel?.value || '') ? 'Novel' : 'Fiction',
    }))
}

// ---------- DB ----------
async function loadAll<T>(table: string, cols: string, orderBy = 'id'): Promise<T[]> {
  const db = adminClient()
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(cols).order(orderBy, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  const apply = isApply()
  const db = adminClient()

  const [nobel, pulitzer] = await Promise.all([fetchNobel(), fetchPulitzer()])
  console.error(`Nobel laureates: ${nobel.length}, Pulitzer statements: ${pulitzer.length}`)

  const authors = await loadAll<{ id: number; display_name: string; awards: Award[] }>('authors', 'id,display_name,awards')
  const books = await loadAll<{ id: number; title: string; awards: Award[] }>('books', 'id,title,awards')
  const links = await loadAll<{ book_id: number; author_id: number }>('book_authors', 'book_id,author_id', 'book_id')

  const authorsByNorm = new Map<string, typeof authors>()
  for (const a of authors) {
    const k = norm(a.display_name)
    ;(authorsByNorm.get(k) || authorsByNorm.set(k, []).get(k)!).push(a)
  }
  const booksByTitle = new Map<string, typeof books>()
  for (const b of books) {
    const k = normTitle(b.title)
    ;(booksByTitle.get(k) || booksByTitle.set(k, []).get(k)!).push(b)
  }
  const authorsOfBook = new Map<number, string[]>()
  const authorById = new Map(authors.map((a) => [a.id, a]))
  for (const l of links) (authorsOfBook.get(l.book_id) || authorsOfBook.set(l.book_id, []).get(l.book_id)!).push(authorById.get(l.author_id)?.display_name || '')

  // Build the target award-sets.
  const authorTargets = new Map<number, Award>() // author id -> Nobel award
  for (const n of nobel) {
    for (const a of authorsByNorm.get(norm(n.name)) || []) {
      authorTargets.set(a.id, { award: 'Nobel Prize in Literature', year: n.year })
    }
  }

  const bookTargets = new Map<number, Award>() // book id -> Pulitzer award
  const pulSeen = new Set<string>()
  for (const p of pulitzer) {
    for (const b of booksByTitle.get(normTitle(p.title)) || []) {
      if (EXCLUDE_BOOK_IDS.has(b.id)) continue
      const dbAuthors = authorsOfBook.get(b.id) || []
      const pulLast = lastName(p.author)
      const authorMatch = !!pulLast && dbAuthors.some((nm) => norm(nm).split(' ').includes(pulLast) || norm(nm) === norm(p.author))
      // Title-only matches are dropped UNLESS allowlisted (DB author typo).
      const allowTitleOnly = b.id === 2800 // Lonesome Dove — DB typo "Larry McMurty"
      if (!authorMatch && !allowTitleOnly) {
        console.error(`  skip (author mismatch): "${p.title}" → book ${b.id}, DB authors: ${dbAuthors.join(', ')}`)
        continue
      }
      const key = `${b.id}`
      if (pulSeen.has(key)) continue
      pulSeen.add(key)
      bookTargets.set(b.id, { award: 'Pulitzer Prize', category: p.category, year: p.year })
    }
  }

  // Maus — Pulitzer Special Citation 1992 (not in the category entities).
  const maus = books.find((b) => normTitle(b.title) === 'maus' || normTitle(b.title).startsWith('maus '))
  if (maus) bookTargets.set(maus.id, { award: 'Pulitzer Prize', category: 'Special Citation', year: 1992 })
  else console.error('  note: Maus not found by title — add manually if present under another slug')

  console.error(`\nTargets: ${authorTargets.size} authors (Nobel), ${bookTargets.size} books (Pulitzer)`)

  if (!apply) {
    console.error('\nDRY RUN — re-run with --apply to write. Sample:')
    for (const b of books.filter((b) => bookTargets.has(b.id)).slice(0, 5)) console.error(`  book "${b.title}" ← ${JSON.stringify(bookTargets.get(b.id))}`)
    return
  }

  let aWrites = 0
  for (const [id, award] of authorTargets) {
    const cur = authorById.get(id)!.awards || []
    const next = mergeAward(cur, award)
    const { error } = await db.from('authors').update({ awards: next }).eq('id', id)
    if (error) throw error
    aWrites++
  }
  let bWrites = 0
  const bookById = new Map(books.map((b) => [b.id, b]))
  for (const [id, award] of bookTargets) {
    const cur = bookById.get(id)!.awards || []
    const next = mergeAward(cur, award)
    const { error } = await db.from('books').update({ awards: next }).eq('id', id)
    if (error) throw error
    bWrites++
  }
  console.error(`\nApplied: ${aWrites} authors, ${bWrites} books.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
