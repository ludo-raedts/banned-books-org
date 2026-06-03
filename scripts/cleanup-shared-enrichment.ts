/**
 * Clean up the "most-popular hit" enrichment contamination flagged by
 * scripts/_audit_shared_enrichment.ts: cover images and book descriptions that
 * a title-search fallback copied onto the WRONG book before the source guard
 * (src/lib/enrich/title-match.ts) existed.
 *
 * Doctrine: for every SUSPECT shared group (titles inside don't match → at
 * least one wrong asset), null the asset on ALL members. The now-guarded
 * enrichers restore the rightful owner via its ISBN/title-match on the next
 * run, while the wrongly-grouped siblings are correctly rejected. A missing
 * asset that gets re-derived is strictly safer than a confidently-wrong one.
 *
 * After --apply, re-run the enrichers:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --once
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-shared-enrichment.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/cleanup-shared-enrichment.ts --apply    # write
 *   npx tsx --env-file=.env.local scripts/cleanup-shared-enrichment.ts --apply --covers-only
 *   npx tsx --env-file=.env.local scripts/cleanup-shared-enrichment.ts --apply --descriptions-only
 */

import { adminClient } from '../src/lib/supabase'
import { titlesMatch, titleTokens } from '../src/lib/enrich/title-match'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const COVERS_ONLY = process.argv.includes('--covers-only')
const DESCS_ONLY = process.argv.includes('--descriptions-only')
const DO_COVERS = !DESCS_ONLY
const DO_DESCS = !COVERS_ONLY

type Book = {
  id: number
  title: string
  isbn13: string | null
  cover_url: string | null
  cover_status: string | null
  description_book: string | null
  description_source_type: string | null
  description_source_url: string | null
}

const db = adminClient()

async function fetchAll(): Promise<Book[]> {
  const rows: Book[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('books')
      .select('id,title,isbn13,cover_url,cover_status,description_book,description_source_type,description_source_url')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as Book[]))
    if (data.length < PAGE) break
  }
  return rows
}

function coverKey(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/[?&]id=([A-Za-z0-9_-]+)/)
  return m ? `gb:${m[1]}` : url
}

const numsOf = (t: string) => new Set([...titleTokens(t)].filter((x) => /^\d+$/.test(x)))
const wordsOf = (t: string) => new Set([...titleTokens(t)].filter((x) => !/^\d+$/.test(x)))
const setEq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
const subset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x))
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const inter = [...a].filter((x) => b.has(x)).length
  return inter / (a.size + b.size - inter)
}

/**
 * Are two titles the same underlying work (so they may legitimately share an
 * asset)? Yes when they don't carry CONFLICTING volume numbers and their
 * non-numeric words either contain one another or overlap strongly. This
 * keeps editions/translations together ("Maus" / "Maus I"; "House on Mango
 * Street" / "La Casa en Mango Street") while splitting series volumes that
 * differ only by number ("Vol. 3" vs "Vol. 5") and unrelated namesakes.
 */
function sameWork(a: string, b: string): boolean {
  const na = numsOf(a), nb = numsOf(b)
  if (na.size > 0 && nb.size > 0 && !setEq(na, nb)) return false // conflicting volume numbers
  const wa = wordsOf(a), wb = wordsOf(b)
  if (wa.size === 0 || wb.size === 0) return false
  return subset(wa, wb) || subset(wb, wa) || jaccard(wa, wb) >= 0.5
}

// Connected-components clustering of a group's members by sameWork().
function clusters(books: Book[]): Book[][] {
  const parent = books.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < books.length; i++)
    for (let j = i + 1; j < books.length; j++)
      if (sameWork(books[i].title, books[j].title)) parent[find(i)] = find(j)
  const byRoot = new Map<number, Book[]>()
  books.forEach((b, i) => {
    const r = find(i)
    if (!byRoot.has(r)) byRoot.set(r, [])
    byRoot.get(r)!.push(b)
  })
  return [...byRoot.values()]
}

/**
 * Which members of a shared-asset group to null. Keep the asset on the single
 * largest "same work" cluster (the rightful edition family); null the rest.
 * If no cluster has a clear majority (all scattered, or a tie for largest),
 * the asset can't be attributed — null everyone and let the now-guarded
 * enrichers restore whatever is genuinely resolvable (ISBN owners come back).
 */
function toNull(group: Book[]): Book[] {
  const cs = clusters(group).sort((a, b) => b.length - a.length)
  const top = cs[0]
  const clearMajority = top.length >= 2 && (cs.length < 2 || cs[1].length < top.length)
  if (!clearMajority) return group
  return group.filter((b) => !top.includes(b))
}

function suspectGroups(books: Book[], keyOf: (b: Book) => string | null): Book[][] {
  const m = new Map<string, Book[]>()
  for (const b of books) {
    const k = keyOf(b)
    if (!k) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(b)
  }
  // A group needs cleanup when it has members we'd null (i.e. not all one work).
  return [...m.values()].filter((v) => v.length > 1 && toNull(v).length > 0)
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const all = await fetchAll()
  console.log(`Scanned ${all.length} books — mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} (covers=${DO_COVERS} descriptions=${DO_DESCS})\n`)

  const coverBooks = DO_COVERS ? suspectGroups(all, (b) => coverKey(b.cover_url)).flatMap(toNull) : []
  const descBooks = DO_DESCS
    ? suspectGroups(all.filter((b) => (b.description_book ?? '').trim().length >= 40), (b) => (b.description_book ?? '').trim()).flatMap(toNull)
    : []

  console.log(`Covers to null:       ${coverBooks.length} books`)
  console.log(`Descriptions to null: ${descBooks.length} books`)

  // Backup the values we're about to wipe — re-enrichment is the intended
  // restore path, but keep a record in case a manual revert is needed.
  const stamp = new Date().toISOString().slice(0, 10)
  if (coverBooks.length) {
    const lines = ['id,title,cover_url,cover_status']
    for (const b of coverBooks) lines.push([b.id, b.title, b.cover_url ?? '', b.cover_status ?? ''].map((x) => csvEscape(String(x))).join(','))
    writeFileSync(`data/cleanup-covers-backup-${stamp}.csv`, lines.join('\n') + '\n')
    console.log(`  backup → data/cleanup-covers-backup-${stamp}.csv`)
  }
  if (descBooks.length) {
    const lines = ['id,title,description_book,description_source_type,description_source_url']
    for (const b of descBooks) lines.push([b.id, b.title, b.description_book ?? '', b.description_source_type ?? '', b.description_source_url ?? ''].map((x) => csvEscape(String(x))).join(','))
    writeFileSync(`data/cleanup-descriptions-backup-${stamp}.csv`, lines.join('\n') + '\n')
    console.log(`  backup → data/cleanup-descriptions-backup-${stamp}.csv`)
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN — nothing written. Sample covers:`)
    for (const b of coverBooks.slice(0, 8)) console.log(`  #${b.id} ${b.title}`)
    console.log(`Sample descriptions:`)
    for (const b of descBooks.slice(0, 8)) console.log(`  #${b.id} ${b.title}`)
    console.log(`\nRe-run with --apply to write.`)
    return
  }

  if (DO_COVERS && coverBooks.length) {
    const ids = coverBooks.map((b) => b.id)
    for (const ids2 of chunk(ids, 300)) {
      const up = await db.from('books')
        .update({ cover_url: null, cover_status: null, cover_checked_at: null })
        .in('id', ids2)
      if (up.error) throw up.error
      // Drop prior search attempts so enrich-covers-continuous re-searches them
      // (it skips books that already have an attempt row).
      const del = await db.from('cover_search_attempts').delete().in('book_id', ids2)
      if (del.error) throw del.error
    }
    console.log(`\nNulled ${ids.length} covers + cleared their cover_search_attempts.`)
  }

  if (DO_DESCS && descBooks.length) {
    const ids = descBooks.map((b) => b.id)
    for (const ids2 of chunk(ids, 300)) {
      const up = await db.from('books')
        .update({ description_book: null, description_source_type: null, description_source_url: null })
        .in('id', ids2)
      if (up.error) throw up.error
    }
    console.log(`Nulled ${ids.length} description_book values (+ source provenance).`)
  }

  console.log(`\nDone. Re-run the enrichers to restore the rightful owners:`)
  console.log(`  npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --once`)
  console.log(`  npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm`)
}

main()
