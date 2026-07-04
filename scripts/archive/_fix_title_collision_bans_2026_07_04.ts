// _fix_title_collision_bans_2026_07_04.ts — one-off: fix 4 title-collision
// mis-attachments found via quality_duplicates_2026-07-04.csv (title-dupe groups).
//
// Verified against upstream sources (PEN 2021-22/2022-23 CSVs in git @e8e17dd,
// data/kdn-epq-batch1.json, data/apm-biblioteca-batch1.json):
//
// 1. LUCKY — book #18834 "Lucky" by "Alice Seabold" (author #346) is a dupe of
//    #205 lucky-as by Alice Sebold (#206); the misspelling comes verbatim from
//    PEN 2021-22 ("Seabold, Alice", Virginia Beach). Move ban #35891 → #205,
//    delete book #18834 + author #346, aliases lucky→#205 / alice-seabold→#206.
// 2. SHAME — ban #29284 (PK 1983, Rushdie's novel per its own description) sits
//    on #10643 "Shame" by Rudolph Conway Ph. D. (KDN 1969 pulp, correct for the
//    MY ban). New book shame-salman-rushdie (author #7), move ban there.
// 3. THE FUGITIVE — ban #32235 (PEN 2022-23, Frisco ISD) is "The Fugitive" by
//    John Grisham (Theodore Boone #5, 2015; siblings #17991/#18363/... already
//    exist), not Neruda's #10742 (KDN 1956, correct for the MY ban). New book
//    the-fugitive-grisham (author #329), move ban there.
// 4. LENIN — ban #27916 (AR 1976, APM Córdoba p.25 "Walter, Gerard — Lenin") is
//    Gérard Walter's 1950 biography, not the Chinese-language KDN row #10720.
//    New book lenin-walter (existing orphan author #9581), move ban there.
//
// Dry-run by default; write with --apply.
// Run: pnpm tsx --env-file=.env.local scripts/_fix_title_collision_bans_2026_07_04.ts [--apply]

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()
const s = adminClient()

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

/** true = ban staat nog op `from` (actie nodig); false = al op `to` (skip). */
async function banNeedsMove(banId: number, from: number, to: number): Promise<boolean> {
  const { data, error } = await s.from('bans').select('id, book_id').eq('id', banId).single()
  if (error || !data) fail(`ban #${banId} niet gevonden: ${error?.message}`)
  if (data.book_id === to) { console.log(`  ✓ ban #${banId} staat al op #${to} — skip`); return false }
  if (data.book_id !== from) fail(`ban #${banId} staat op book #${data.book_id}, verwacht #${from} — handmatig checken`)
  return true
}

async function moveBan(banId: number, toBookId: number, label: string) {
  console.log(`  → ban #${banId} verplaatsen naar book #${toBookId} (${label})`)
  if (!APPLY) return
  const { error } = await s.from('bans').update({ book_id: toBookId }).eq('id', banId)
  if (error) fail(`ban #${banId} move: ${error.message}`)
}

async function createBook(row: { slug: string; title: string; first_published_year: number | null; original_language: string | null }, authorId: number): Promise<number | null> {
  const { data: existing } = await s.from('books').select('id').eq('slug', row.slug).maybeSingle()
  if (existing) { console.log(`  ✓ [${row.slug}] bestaat al (book #${existing.id}) — hergebruik`); return existing.id }
  console.log(`  → nieuw book [${row.slug}] "${row.title}" (yr=${row.first_published_year ?? '-'}, lang=${row.original_language ?? '-'}), auteur #${authorId}`)
  if (!APPLY) return null
  const { data, error } = await s.from('books').insert(row).select('id').single()
  if (error || !data) fail(`insert ${row.slug}: ${error?.message}`)
  const { error: e2 } = await s.from('book_authors').insert({ book_id: data.id, author_id: authorId })
  if (e2) fail(`book_authors ${row.slug}: ${e2.message}`)
  return data.id
}

async function main() {
  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN (gebruik --apply om te schrijven) ==')

  // 1. Lucky merge (#18834 → #205)
  console.log('\n[1] Lucky — "Alice Seabold" dupe → lucky-as (#205)')
  if (await banNeedsMove(35891, 18834, 205)) await moveBan(35891, 205, 'Virginia Beach, PEN 2021-22')
  console.log('  → delete book #18834 (+book_authors), delete auteur #346, aliases lucky→#205 en alice-seabold→#206')
  if (APPLY) {
    let r = await s.from('book_authors').delete().eq('book_id', 18834)
    if (r.error) fail(`book_authors delete: ${r.error.message}`)
    r = await s.from('books').delete().eq('id', 18834)
    if (r.error) fail(`book #18834 delete: ${r.error.message}`)
    r = await s.from('authors').delete().eq('id', 346)
    if (r.error) fail(`author #346 delete: ${r.error.message}`)
    r = await s.from('book_slug_aliases').upsert({ slug: 'lucky', book_id: 205, source: 'legacy_slug' }, { onConflict: 'slug', ignoreDuplicates: true })
    if (r.error) fail(`book alias: ${r.error.message}`)
    r = await s.from('author_slug_aliases').upsert({ slug: 'alice-seabold', author_id: 206, source: 'merge' }, { onConflict: 'slug', ignoreDuplicates: true })
    if (r.error) fail(`author alias: ${r.error.message}`)
  }

  // 2. Shame — Rushdie-ban van Conway-row af
  console.log('\n[2] Shame — Rushdie PK-ban (#29284) → nieuw shame-salman-rushdie')
  const shameId = await createBook({ slug: 'shame-salman-rushdie', title: 'Shame', first_published_year: 1983, original_language: 'en' }, 7)
  if (shameId && await banNeedsMove(29284, 10643, shameId)) await moveBan(29284, shameId, 'Pakistan 1983')

  // 3. The Fugitive — Grisham-ban van Neruda-row af
  console.log('\n[3] The Fugitive — PEN Frisco-ban (#32235) → nieuw the-fugitive-grisham')
  const fugitiveId = await createBook({ slug: 'the-fugitive-grisham', title: 'The Fugitive', first_published_year: 2015, original_language: 'en' }, 329)
  if (fugitiveId && await banNeedsMove(32235, 10742, fugitiveId)) await moveBan(32235, fugitiveId, 'Frisco ISD, PEN 2022-23')

  // 4. Lenin — APM-ban van Chinese KDN-row af
  console.log('\n[4] Lenin — APM AR-ban (#27916) → nieuw lenin-walter (Gérard Walter)')
  const leninId = await createBook({ slug: 'lenin-walter', title: 'Lenin', first_published_year: 1950, original_language: 'fr' }, 9581)
  if (leninId && await banNeedsMove(27916, 10720, leninId)) await moveBan(27916, leninId, 'Argentinië 1976, APM Córdoba')

  console.log(`\n${APPLY ? 'Klaar' : 'Dry-run klaar'}: 4 bans verplaatst, 3 nieuwe books, 1 book + 1 auteur verwijderd, 2 aliases.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
