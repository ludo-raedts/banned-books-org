#!/usr/bin/env tsx
// READ-ONLY standing audit: same-work-different-language duplicate BOOK rows,
// found via the author-sibling method. Writes a three-bucket review worklist;
// never touches the DB. Confirmed pairs are merged by hand, case-by-case, in
// merge-cross-language-dupes.ts (Doctrine: foreign DROP contributes only its
// ban + URL alias + language-neutral fields).
//
// Why this exists (2026-07-03/04, Cases C & D found BY HAND):
//   C. "The Anarchist Cook Book" #16302 (lang=fr) vs "The Anarchist Cookbook"
//      #558 — token detectors miss it ("cook book" ≠ "cookbook").
//   D. Manuel Humbert #14825 (Liste Otto, short title) vs #22275 (Berlin-1938,
//      "Adolf Hitlers Mein Kampf — Dichtung und Wahrheit").
// Title-token detectors structurally miss this class ("Mon Combat" never
// matches "Mein Kampf"), and _audit_spanish_edition_dupes.ts only covers
// Spanish-looking titles. This detector is language-agnostic: it pairs every
// foreign/NULL-language book with same-author English/NULL-language books and
// scores the pair on (a) normalised + SPACELESS title equality, (b)
// title_english_meaningful match, (c) first_published_year ±2.
//
// Buckets (→ data/cross-language-dupes-review-<date>.md):
//   STRONG  — title/TEM-identical after normalisation, no year conflict.
//             Auto-merge CANDIDATE; still verify per pair before adding a case.
//   WEAK    — containment / high token overlap / year-conflicted strong titles.
//             Review only.
//   WARNING — same SUBJECT, different WORK: the shared phrase is itself a
//             different author's book title (e.g. «Mein Kampf» inside the
//             Appuhn/Morvilliers/Lichtenberg critique titles = Hitler's #557).
//             NEVER merge these — see merge-cross-language-dupes.ts Case D
//             comment and memory "Cross-language (cross-script) dupes".
//
//   pnpm tsx --env-file=.env.local scripts/_audit_cross_language_dupes.ts

import { writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

type Book = {
  id: number
  title: string
  slug: string
  original_language: string | null
  title_english_meaningful: string | null
  first_published_year: number | null
  isbn13: string | null
  openlibrary_work_id: string | null
  cover_status: string | null
  description_book: string | null
  is_blanket_works: boolean
}

const PAGE = 1000

// Same placeholder set as _audit_same_author_title_dupes.ts: collective
// "authors" shared by many unrelated books produce false sibling pairs.
const PLACEHOLDER_AUTHORS = new Set([
  'anonymous', 'unknown', 'various', 'various authors', 'anon', 'n/a', 'collective',
])

// Supabase pagination doctrine: .order() + .range(), plain select caps at 1000.
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

// Same normalisation as _audit_same_author_title_dupes.ts…
function normTitle(t: string): string {
  return t
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip Latin combining diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// …plus the SPACELESS view that catches Case C ("cook book" ≡ "cookbook").
const spaceless = (n: string) => n.replace(/ /g, '')

const tokens = (n: string) => new Set(n.split(' ').filter(Boolean))

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

const isSubset = (small: Set<string>, big: Set<string>) => {
  for (const x of small) if (!big.has(x)) return false
  return small.size > 0
}

// Levenshtein capped at `max` (early-exit) — catches spelling-variant dupes the
// token view misses ("Teresa"↔"Tereza" Batista, "Verschwörer"↔"Verschwœrer").
function editDistanceCapped(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// Volume/series markers: when two titles differ ONLY in these tokens they are
// almost certainly different VOLUMES of one work, not the same work twice
// ("Psicología recreativa Volumen I" vs "… Volumen II"). Roman numerals, plain
// numbers (incl. Portuguese 1º/2o), and vol/part/series words.
const VOLSERIES = /^([ivxlcdm]+|\d+[ºo°]?|vol|volume|volumen|part|parte|tome|tomo|deel|series|serie)$/
function volumeSeriesDiff(ta: Set<string>, tb: Set<string>): boolean {
  const diff: string[] = []
  for (const t of ta) if (!tb.has(t)) diff.push(t)
  for (const t of tb) if (!ta.has(t)) diff.push(t)
  return diff.length > 0 && diff.every(t => VOLSERIES.test(t))
}

// Richer-metadata row is the proposed KEEP (same rubric as the same-author audit).
function score(b: Book): number {
  return (
    (b.isbn13 ? 2 : 0) +
    (b.description_book ? 2 : 0) +
    (b.openlibrary_work_id ? 1 : 0) +
    (b.cover_status === 'valid' ? 1 : 0) +
    (b.first_published_year ? 0.5 : 0)
  )
}

const isEnish = (l: string | null) => l === 'en' || l == null
const isForeignish = (l: string | null) => l !== 'en' // includes NULL

async function main() {
  console.log('Fetching books, book_authors, bans, authors…')
  const [books, bookAuthors, banRows, authors] = await Promise.all([
    fetchAll<Book>('books', 'id, title, slug, original_language, title_english_meaningful, first_published_year, isbn13, openlibrary_work_id, cover_status, description_book, is_blanket_works'),
    fetchAll<{ book_id: number; author_id: number }>('book_authors', 'book_id, author_id', ['book_id', 'author_id']),
    fetchAll<{ id: number; book_id: number }>('bans', 'id, book_id'),
    fetchAll<{ id: number; display_name: string | null }>('authors', 'id, display_name'),
  ])
  console.log(`  ${books.length} books, ${bookAuthors.length} book_authors, ${banRows.length} bans, ${authors.length} authors`)

  const placeholderAuthorIds = new Set(
    authors.filter(a => a.display_name && PLACEHOLDER_AUTHORS.has(a.display_name.trim().toLowerCase())).map(a => a.id),
  )
  const authorName = new Map(authors.map(a => [a.id, a.display_name ?? `#${a.id}`]))

  const bookById = new Map(books.map(b => [b.id, b]))
  const banCount = new Map<number, number>()
  for (const r of banRows) banCount.set(r.book_id, (banCount.get(r.book_id) ?? 0) + 1)

  const authorsOfBook = new Map<number, Set<number>>()
  const byAuthor = new Map<number, Set<number>>()
  for (const ba of bookAuthors) {
    if (!authorsOfBook.has(ba.book_id)) authorsOfBook.set(ba.book_id, new Set())
    authorsOfBook.get(ba.book_id)!.add(ba.author_id)
    if (placeholderAuthorIds.has(ba.author_id)) continue
    if (!byAuthor.has(ba.author_id)) byAuthor.set(ba.author_id, new Set())
    byAuthor.get(ba.author_id)!.add(ba.book_id)
  }

  // Precompute normalised forms + the WARNING lookup: normalised full title →
  // owning author ids, across the WHOLE catalogue. When a pair's shared phrase
  // is itself somebody ELSE's complete book title, the overlap is subject
  // citation, not identity (the Mein-Kampf-critique class).
  const norm = new Map<number, string>()
  const titleOwners = new Map<string, Set<number>>()
  for (const b of books) {
    const n = normTitle(b.title)
    norm.set(b.id, n)
    if (b.is_blanket_works || n.length < 2) continue
    if (!titleOwners.has(n)) titleOwners.set(n, new Set())
    for (const a of authorsOfBook.get(b.id) ?? []) titleOwners.get(n)!.add(a)
  }

  type Tier = 'strong' | 'weak' | 'warning'
  type Hit = { authorId: number; keep: Book; drop: Book; tier: Tier; signals: string[] }
  const hits: Hit[] = []
  const seenPair = new Set<string>()

  for (const [authorId, bookIds] of byAuthor) {
    const list = [...bookIds].map(id => bookById.get(id)).filter((x): x is Book => !!x && !x.is_blanket_works)
    if (list.length < 2) continue

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i], y = list[j]
        const pairKey = x.id < y.id ? `${x.id}-${y.id}` : `${y.id}-${x.id}`
        if (seenPair.has(pairKey)) continue

        // Cross-language gate: one side foreign-or-NULL, the other en-or-NULL.
        // Same non-NULL language on both sides is _audit_same_author_title_dupes
        // territory, not this class.
        const lx = x.original_language, ly = y.original_language
        const qualifies = (isForeignish(lx) && isEnish(ly)) || (isForeignish(ly) && isEnish(lx))
        if (!qualifies || (lx != null && lx === ly)) continue

        const nx = norm.get(x.id)!, ny = norm.get(y.id)!
        if (nx.length < 2 || ny.length < 2) continue
        const tx = tokens(nx), ty = tokens(ny)

        // Different-volume guard: titles differing only in volume/series tokens
        // are sibling volumes, never merge candidates.
        const volDiff = volumeSeriesDiff(tx, ty)

        const [shortB, longB] = tx.size <= ty.size ? [x, y] : [y, x]
        const shortN = norm.get(shortB.id)!, longT = tokens(norm.get(longB.id)!)
        const normEq = nx === ny
        const contained = !normEq && isSubset(tokens(shortN), longT) && tokens(shortN).size >= 2

        // (a) title similarity, incl. spaceless ("cook book" ≡ "cookbook") and
        // near-identical spelling (edit ≤2 on the spaceless form). Guards: not
        // volume-siblings, and not containment — a 1–2 char APPENDED suffix is a
        // sequel tell ("Tokyo Ghoul" vs "Tokyo Ghoul: re"), not a spelling variant.
        const spacelessEq = spaceless(nx) === spaceless(ny)
        const sx0 = spaceless(nx), sy0 = spaceless(ny)
        const nearEdit = !normEq && !spacelessEq && !volDiff && !contained && Math.min(sx0.length, sy0.length) >= 10
          ? editDistanceCapped(sx0, sy0, 2) : 99
        const nearIdentical = nearEdit <= 2
        // (b) title_english_meaningful: vs the other side's title (both
        // directions) AND tem-vs-tem (both rows carrying the same English
        // work-title is as strong as title equality).
        const temPairs: Array<[string, string]> = []
        if (x.title_english_meaningful) temPairs.push([normTitle(x.title_english_meaningful), ny])
        if (y.title_english_meaningful) temPairs.push([normTitle(y.title_english_meaningful), nx])
        if (x.title_english_meaningful && y.title_english_meaningful)
          temPairs.push([normTitle(x.title_english_meaningful), normTitle(y.title_english_meaningful)])
        const temEq = temPairs.some(([a, b]) =>
          a.length >= 2 && b.length >= 2 && (a === b || spaceless(a) === spaceless(b)))
        const temNear = !temEq && temPairs.some(([a, b]) => jaccard(tokens(a), tokens(b)) >= 0.6)
        // (c) publication year ±2
        const yearBoth = x.first_published_year != null && y.first_published_year != null
        const yearDiff = yearBoth ? Math.abs(x.first_published_year! - y.first_published_year!) : null
        const yearClose = yearDiff != null && yearDiff <= 2
        const yearConflict = yearDiff != null && yearDiff > 2

        const jac = jaccard(tx, ty)

        const titleStrong = normEq || spacelessEq || temEq || nearIdentical
        if (!titleStrong && !contained && jac < 0.6 && !temNear) continue

        // WARNING gate: containment where the shared short title is a DIFFERENT
        // author's complete work (title cites/critiques another book).
        let warning: string | null = null
        if (contained && !titleStrong) {
          const owners = titleOwners.get(shortN)
          const pairAuthors = new Set([...(authorsOfBook.get(x.id) ?? []), ...(authorsOfBook.get(y.id) ?? [])])
          const foreignOwner = owners ? [...owners].find(a => !pairAuthors.has(a)) : undefined
          if (foreignOwner != null) {
            warning = `shared phrase "${shortN}" is a complete work by ${authorName.get(foreignOwner)} — likely commentary/critique ABOUT that work, not the work itself`
          }
        }

        const signals: string[] = []
        if (normEq) signals.push('title normalised-identical')
        else if (spacelessEq) signals.push('title spaceless-identical')
        else if (nearIdentical) signals.push(`title near-identical spelling (edit distance ${nearEdit})`)
        if (temEq) signals.push('title_english_meaningful match')
        if (temNear) signals.push('title_english_meaningful near-match (jaccard ≥0.6)')
        if (contained) signals.push('shorter title contained in longer')
        if (!titleStrong && !contained && jac >= 0.6) signals.push(`token jaccard ${jac.toFixed(2)}`)
        if (volDiff) signals.push('⚠ differs only in volume/series tokens — likely SIBLING VOLUMES, not a dupe')
        if (yearClose) signals.push(`year match (${x.first_published_year} vs ${y.first_published_year})`)
        if (yearConflict) signals.push(`⚠ YEAR CONFLICT (${x.first_published_year} vs ${y.first_published_year})`)
        if (lx == null && ly == null) signals.push('both original_language NULL (language unconfirmed)')

        let tier: Tier
        if (warning) { tier = 'warning'; signals.unshift(warning) }
        else if (titleStrong && !yearConflict) tier = 'strong'
        else tier = 'weak'

        // KEEP = richer metadata; prefer the English-language row on a tie-ish
        // score (canonical record is the English work row). Proposal only.
        const sx = score(x) + (lx === 'en' ? 1 : 0), sy = score(y) + (ly === 'en' ? 1 : 0)
        let keep = x, drop = y
        if (sy > sx) { keep = y; drop = x }
        else if (sy === sx) {
          const cx = banCount.get(x.id) ?? 0, cy = banCount.get(y.id) ?? 0
          if (cy > cx || (cy === cx && y.id < x.id)) { keep = y; drop = x }
        }

        seenPair.add(pairKey)
        hits.push({ authorId, keep, drop, tier, signals })
      }
    }
  }

  const strong = hits.filter(h => h.tier === 'strong')
  const weak = hits.filter(h => h.tier === 'weak')
  const warn = hits.filter(h => h.tier === 'warning')
  const byAuthorName = (a: Hit, b: Hit) =>
    (authorName.get(a.authorId) ?? '').localeCompare(authorName.get(b.authorId) ?? '')
  strong.sort(byAuthorName); weak.sort(byAuthorName); warn.sort(byAuthorName)

  const date = new Date().toISOString().slice(0, 10)
  const fmt = (b: Book) =>
    `#${b.id} "${b.title}" [${b.slug}] lang=${b.original_language ?? '∅'} tem=${b.title_english_meaningful ? `"${b.title_english_meaningful}"` : '∅'} yr=${b.first_published_year ?? '∅'} isbn=${b.isbn13 ? 'y' : '∅'} desc=${b.description_book ? 'y' : '∅'} bans=${banCount.get(b.id) ?? 0}`

  const lines: string[] = []
  lines.push(`# Cross-language same-work dupes — ${date}`)
  lines.push('')
  lines.push('Read-only worklist from `scripts/_audit_cross_language_dupes.ts` (author-sibling')
  lines.push('method). NOTHING here is merged automatically: confirmed pairs are added as a')
  lines.push('numbered case to `scripts/merge-cross-language-dupes.ts` and applied there.')
  lines.push('')
  lines.push(`- **STRONG** (${strong.length}): title/TEM-identical after normalisation, no year conflict — merge candidates.`)
  lines.push(`- **WEAK** (${weak.length}): partial title overlap or year conflict — review per pair.`)
  lines.push(`- **WARNING** (${warn.length}): same subject, different work (title cites another author's work) — NEVER merge; see the Mein-Kampf-critique doctrine in merge-cross-language-dupes.ts Case D.`)
  lines.push('')

  const section = (title: string, rows: Hit[], keepDrop: boolean) => {
    lines.push(`## ${title}`)
    lines.push('')
    for (const h of rows) {
      lines.push(`- **${authorName.get(h.authorId)}** (author #${h.authorId}) — ${h.signals.join('; ')}`)
      lines.push(`  - ${keepDrop ? 'KEEP ' : ''}${fmt(h.keep)}`)
      lines.push(`  - ${keepDrop ? 'DROP ' : ''}${fmt(h.drop)}`)
    }
    if (!rows.length) lines.push('_none_')
    lines.push('')
  }
  section('STRONG (auto-merge candidates — still verify each pair)', strong, true)
  section('WEAK (review only)', weak, false)
  section('WARNING (same subject, DIFFERENT work — never merge)', warn, false)

  const out = `data/cross-language-dupes-review-${date}.md`
  writeFileSync(out, lines.join('\n'))
  console.log(`\nSTRONG: ${strong.length}   WEAK: ${weak.length}   WARNING: ${warn.length}`)
  console.log(`Wrote ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
