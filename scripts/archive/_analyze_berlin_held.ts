/**
 * Read-only analysis of the 64 rows held by import-berlin-verbannte.ts.
 *
 * Reproduces the importer's hold logic:
 *   1. intra-batch slug collisions (group seed rows on slugify(title))
 *   2. HOLD_GENERIC_MATCH (8 ambiguous existing-book matches)
 *
 * For (1): prints each collision cluster with row title/authors/year so we can
 *          decide distinct-works (disambiguate + import all) vs same-work dupe.
 * For (2): fetches the existing matched book (id/title/authors/year) and the
 *          Berlin row side-by-side to decide attach-ban vs create-new.
 *
 * Writes NOTHING. Read-only DB queries only.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import { matchExistingBook } from '../src/lib/imports/verifier'

const HOLD_GENERIC_MATCH: Record<number, number> = {
  513: 10548, 839: 10270, 1321: 4089, 2313: 7451,
  3053: 13676, 3151: 14626, 3420: 10720, 4877: 13952,
}

interface SeedRow {
  source_row_id: number
  title: string
  title_english_meaningful: string | null
  authors: string[]
  publication_year: number | null
  source_name: string
  source_url: string
}

function findSeed(): string {
  const files = readdirSync('data').filter(f => /^berlin-verbannte-1938-.*\.json$/.test(f)).sort()
  return `data/${files[files.length - 1]}`
}

async function main() {
  const seedPath = findSeed()
  const all = JSON.parse(readFileSync(seedPath, 'utf8')).rows as SeedRow[]
  const byId = new Map(all.map(r => [r.source_row_id, r]))

  // ---- (1) intra-batch slug collisions ----
  const bySlug = new Map<string, SeedRow[]>()
  for (const r of all) {
    const s = slugify(r.title)
    if (!s) continue
    if (!bySlug.has(s)) bySlug.set(s, [])
    bySlug.get(s)!.push(r)
  }
  const clusters = [...bySlug.entries()].filter(([, rows]) => rows.length > 1)
  const collisionIds = new Set<number>()
  for (const [, rows] of clusters) for (const r of rows) collisionIds.add(r.source_row_id)

  console.log(`\n=== INTRA-BATCH SLUG COLLISIONS — ${clusters.length} clusters, ${collisionIds.size} rows ===\n`)
  for (const [slug, rows] of clusters.sort((a, b) => a[0].localeCompare(b[0]))) {
    const authorSets = new Set(rows.map(r => r.authors.join(' & ').toLowerCase().trim()))
    const sameAuthor = authorSets.size < rows.length
    console.log(`slug "${slug}"  (${rows.length} rows)${sameAuthor ? '  ⚠ SHARED-AUTHOR' : ''}`)
    for (const r of rows) {
      console.log(`   #${r.source_row_id}  "${r.title}"  — ${r.authors.join(', ') || '(no author)'}  [${r.publication_year ?? '?'}]`)
    }
    console.log()
  }

  // ---- (2) generic-match holds ----
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n=== GENERIC-MATCH HOLDS — ${Object.keys(HOLD_GENERIC_MATCH).length} rows ===\n`)
  try {
    for (const [sridStr, bookId] of Object.entries(HOLD_GENERIC_MATCH)) {
      const srid = Number(sridStr)
      const r = byId.get(srid)!
      const bk = await pg.query(
        `select b.id, b.title, b.slug, b.first_published_year, b.inclusion_rationale,
                array_agg(a.display_name order by a.display_name) as authors
           from books b
           left join book_authors ba on ba.book_id = b.id
           left join authors a on a.id = ba.author_id
          where b.id = $1
          group by b.id`, [bookId])
      const bans = await pg.query(
        `select b.country_code, b.year_started, s.slug as scope, b.action_type, b.status
           from bans b join scopes s on s.id = b.scope_id
          where b.book_id = $1 order by b.year_started`, [bookId])
      const ex = bk.rows[0]
      // what would matchExistingBook resolve to now (sanity)?
      const m = await matchExistingBook({ title: r.title, englishTitle: r.title_english_meaningful })
      console.log(`#${srid}  Berlin: "${r.title}" — ${r.authors.join(', ') || '(none)'}  [pub ${r.publication_year ?? '?'}]`)
      console.log(`        en_meaningful: ${r.title_english_meaningful ?? '—'}`)
      if (!ex) { console.log(`   existing #${bookId}: NOT FOUND\n`); continue }
      console.log(`   existing #${ex.id} "${ex.title}" (slug ${ex.slug}) — ${(ex.authors || []).filter(Boolean).join(', ') || '(none)'}  [pub ${ex.first_published_year ?? '?'}]`)
      console.log(`        bans: ${bans.rows.map(b => `${b.country_code}/${b.scope}/${b.action_type}/${b.status}/${b.year_started}`).join('  |  ') || '(none)'}`)
      console.log(`        rationale: ${(ex.inclusion_rationale || '').slice(0, 120)}`)
      console.log(`   matchExistingBook(title) → ${m ? `#${m.id} (${m.status})` : 'no_match'}`)
      console.log(`        bare slug "${slugify(r.title)}" taken? ${m && m.status === 'exact' ? 'YES (this book)' : 'check'}\n`)
    }
  } finally {
    await pg.end()
  }

  console.log(`\nSummary: ${collisionIds.size} collision rows + ${Object.keys(HOLD_GENERIC_MATCH).length} generic = ${collisionIds.size + Object.keys(HOLD_GENERIC_MATCH).length} held`)
}

main().catch(e => { console.error(e); process.exit(1) })
