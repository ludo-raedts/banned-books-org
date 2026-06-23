#!/usr/bin/env tsx
// Detect duplicate BOOKS that share an author and have effectively the same
// title once normalised — the "Pride: Celebrating Diversity & Community" vs
// "...and Community" class that the paren-suffix / cross-language detectors
// miss. Read-only: produces a merge worklist + a human-review markdown.
//
// Route (as suggested): group every author's books, normalise each title,
// and flag books that collapse to the same (or near-same) normalised string.
//
//   exact  — titles identical after normalisation (&↔and, punctuation, case,
//            diacritics, whitespace). High confidence; emitted to the JSON
//            worklist for merge-paren-suffix-dupes.ts.
//   near   — one normalised title is a prefix of the other, OR token-set
//            Jaccard ≥ 0.92. Review-only (subtitle/edition differences, but
//            also series volumes — NOT auto-merged).
//
// KEEP is the row with the richer metadata (isbn13, description_book,
// work id, valid cover, year); DROP is migrated into it. The audit only
// PROPOSES keep/drop — verify before applying the merge.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/_audit_same_author_title_dupes.ts
//   (writes data/same-author-title-dupes.json + .md)

import { writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

type Book = {
  id: number
  title: string
  slug: string
  isbn13: string | null
  first_published_year: number | null
  openlibrary_work_id: string | null
  cover_url: string | null
  cover_status: string | null
  description_book: string | null
}

const PAGE = 1000

// Placeholder/collective "authors" that are shared across many unrelated books
// — grouping by them produces false matches (e.g. several distinct Malaysian
// gazette documents all titled "Chetusan" under "Anonymous"). Skip them.
const PLACEHOLDER_AUTHORS = new Set([
  'anonymous', 'unknown', 'various', 'various authors', 'anon', 'n/a', 'collective',
])

async function fetchAll<T>(table: string, columns: string, orderBy: string[] = ['id']): Promise<T[]> {
  const db = adminClient()
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns)
    for (const col of orderBy) q = q.order(col, { ascending: true })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as unknown as T[]))
    if (data.length < PAGE) break
  }
  return out
}

function normTitle(t: string): string {
  return t
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip Latin combining diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // keep ALL unicode letters/digits; rest → space
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(n: string): Set<string> {
  return new Set(n.split(' ').filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

// Higher = better KEEP candidate.
function score(b: Book): number {
  return (
    (b.isbn13 ? 2 : 0) +
    (b.description_book ? 2 : 0) +
    (b.openlibrary_work_id ? 1 : 0) +
    (b.cover_status === 'valid' ? 1 : 0) +
    (b.first_published_year ? 0.5 : 0)
  )
}

async function main() {
  console.log('Fetching books, book_authors, bans…')
  const [books, bookAuthors, banRows, authors] = await Promise.all([
    fetchAll<Book>('books', 'id, title, slug, isbn13, first_published_year, openlibrary_work_id, cover_url, cover_status, description_book'),
    fetchAll<{ book_id: number; author_id: number }>('book_authors', 'book_id, author_id', ['book_id', 'author_id']),
    fetchAll<{ id: number; book_id: number }>('bans', 'id, book_id'),
    fetchAll<{ id: number; display_name: string | null }>('authors', 'id, display_name'),
  ])
  console.log(`  ${books.length} books, ${bookAuthors.length} book_authors, ${banRows.length} bans, ${authors.length} authors`)

  const placeholderAuthorIds = new Set(
    authors.filter(a => a.display_name && PLACEHOLDER_AUTHORS.has(a.display_name.trim().toLowerCase())).map(a => a.id),
  )
  if (placeholderAuthorIds.size) console.log(`  skipping ${placeholderAuthorIds.size} placeholder author(s)`)

  const bookById = new Map(books.map(b => [b.id, b]))
  const banCount = new Map<number, number>()
  for (const r of banRows) banCount.set(r.book_id, (banCount.get(r.book_id) ?? 0) + 1)

  // author_id → set of book_ids
  const byAuthor = new Map<number, Set<number>>()
  for (const ba of bookAuthors) {
    if (placeholderAuthorIds.has(ba.author_id)) continue
    if (!byAuthor.has(ba.author_id)) byAuthor.set(ba.author_id, new Set())
    byAuthor.get(ba.author_id)!.add(ba.book_id)
  }

  type Hit = {
    a: Book; b: Book; tier: 'exact' | 'near'; detail: string
  }
  const hits: Hit[] = []
  const seenPair = new Set<string>()

  for (const [, bookIds] of byAuthor) {
    const list = [...bookIds].map(id => bookById.get(id)).filter((x): x is Book => !!x)
    if (list.length < 2) continue
    const norm = new Map<number, string>()
    for (const b of list) norm.set(b.id, normTitle(b.title))

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i], y = list[j]
        const pairKey = x.id < y.id ? `${x.id}-${y.id}` : `${y.id}-${x.id}`
        if (seenPair.has(pairKey)) continue
        const nx = norm.get(x.id)!, ny = norm.get(y.id)!
        if (nx.length < 2 || ny.length < 2) continue

        if (nx === ny) {
          seenPair.add(pairKey)
          hits.push({ a: x, b: y, tier: 'exact', detail: `normalised identical: "${nx}"` })
          continue
        }
        // near: prefix or high token overlap
        const isPrefix = nx.startsWith(ny + ' ') || ny.startsWith(nx + ' ')
        const jac = jaccard(tokens(nx), tokens(ny))
        if (isPrefix || jac >= 0.92) {
          seenPair.add(pairKey)
          hits.push({
            a: x, b: y, tier: 'near',
            detail: isPrefix ? `one title is a prefix of the other` : `token Jaccard ${jac.toFixed(2)}`,
          })
        }
      }
    }
  }

  const exact = hits.filter(h => h.tier === 'exact')
  const near = hits.filter(h => h.tier === 'near')

  // Build merge worklist for the EXACT tier (keep = higher score; tiebreak
  // more bans, then lower id).
  const worklist = exact.map(h => {
    const sa = score(h.a), sb = score(h.b)
    let keep = h.a, drop = h.b
    if (sb > sa) { keep = h.b; drop = h.a }
    else if (sb === sa) {
      const ca = banCount.get(h.a.id) ?? 0, cb = banCount.get(h.b.id) ?? 0
      if (cb > ca || (cb === ca && h.b.id < h.a.id)) { keep = h.b; drop = h.a }
    }
    return {
      keep: keep.id,
      drop: drop.id,
      keep_title: keep.title,
      drop_title: drop.title,
      confidence: 'high' as const,
      reasons: ['same author', `normalised title identical`],
      flags: [] as string[],
    }
  })

  writeFileSync('data/same-author-title-dupes.json', JSON.stringify(worklist, null, 2))

  // Markdown review
  const lines: string[] = []
  lines.push(`# Same-author title dupes — ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')
  lines.push(`Exact-normalised pairs: **${exact.length}** (→ data/same-author-title-dupes.json, merge-ready)`)
  lines.push(`Near pairs (review-only): **${near.length}**`)
  lines.push('')
  const fmt = (b: Book) =>
    `#${b.id} "${b.title}" [${b.slug}] isbn=${b.isbn13 ?? '–'} yr=${b.first_published_year ?? '–'} cover=${b.cover_status ?? '–'} desc=${b.description_book ? 'y' : 'n'} bans=${banCount.get(b.id) ?? 0}`

  lines.push('## EXACT (merge candidates)')
  lines.push('')
  for (const w of worklist) {
    const k = bookById.get(w.keep)!, d = bookById.get(w.drop)!
    lines.push(`- KEEP ${fmt(k)}`)
    lines.push(`  DROP ${fmt(d)}`)
  }
  lines.push('')
  lines.push('## NEAR (review only — subtitle/series differences)')
  lines.push('')
  for (const h of near) {
    lines.push(`- ${h.detail}`)
    lines.push(`  - ${fmt(h.a)}`)
    lines.push(`  - ${fmt(h.b)}`)
  }
  writeFileSync('data/same-author-title-dupes.md', lines.join('\n'))

  console.log(`\nEXACT: ${exact.length}   NEAR: ${near.length}`)
  console.log('Wrote data/same-author-title-dupes.json (exact, merge-ready)')
  console.log('Wrote data/same-author-title-dupes.md (full review)')
}

main().catch(e => { console.error(e); process.exit(1) })
