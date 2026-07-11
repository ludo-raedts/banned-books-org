#!/usr/bin/env tsx
/**
 * Backfill Utah statewide school-removal bans (HB 29 / Utah Code §53G-10-103).
 *
 * WHY: Since 2024 the Utah State Board of Education maintains a list of titles
 * that must be removed from EVERY public school in the state — once a title is
 * removed for "objective sensitive material" by ≥3 districts (or 2 districts +
 * 5 charters) it is banned statewide. As of 2026-07-06 the list holds 36 titles
 * (Different Seasons by Stephen King = the 36th). We already carried all 36 as
 * book rows, but only 2 had a statewide ban row — the other 34 were recorded as
 * district-only, understating them. This adds/normalises one statewide ban per
 * title, sourced to the official USBE list + the HB 29 bill text.
 *
 * SOURCE (authoritative, dated): the USBE "Sensitive Materials Removed in a
 * Public School Setting Statewide" spreadsheet — Title / Author / triggering
 * districts / "Date threshold met". Values below are transcribed from that sheet
 * (downloaded 2026-07-11), not from secondary press.
 *
 * Also folds a same-work/same-author duplicate: Different Seasons #14321 → #1280
 * (same OL work OL81621W, same author; #1280 carries the US district bans).
 *
 * Book IDs are hardcoded from a title+author dry-run resolution; the script
 * RE-ASSERTS at runtime that each id still maps to the expected title + author
 * surname and aborts on any mismatch (namesake/edition guard).
 *
 *   pnpm tsx --env-file=.env.local scripts/backfill-utah-statewide-bans.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-utah-statewide-bans.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const SCOPE_GOVERNMENT = 4 // matches the 2 pre-existing statewide records
const INSTITUTION = 'Utah State Board of Education'

const SOURCES = [
  {
    source_name: 'Utah State Board of Education — Sensitive Materials Removed in a Public School Setting Statewide',
    source_url: 'https://usbe-my.sharepoint.com/:x:/g/personal/davina_sauthoff_schools_utah_gov/IQC62f_kkhOUTKg8QYRsa5glAf1N_fdVRalq8tPXL4FkQWY',
    source_type: 'web',
  },
  {
    source_name: 'Utah H.B. 29 (2024) — Sensitive Materials in Schools',
    source_url: 'https://le.utah.gov/~2024/bills/static/HB0029.html',
    source_type: 'web',
  },
]
const ACCESSED_AT = '2026-07-11'

/** book_id, display title (for description), author surname (assertion), date threshold met, triggering districts. */
type Row = { id: number; title: string; surname: string; date: string; districts: string }
const ROWS: Row[] = [
  { id: 134,  title: 'A Court of Thorns and Roses',                       surname: 'Maas',     date: '2024-08-02', districts: 'Alpine, Davis, Jordan, Nebo, Washington' },
  { id: 204,  title: 'A Court of Frost and Starlight',                    surname: 'Maas',     date: '2024-08-02', districts: 'Alpine, Davis, Jordan, Nebo, Washington' },
  { id: 200,  title: 'A Court of Mist and Fury',                          surname: 'Maas',     date: '2024-08-02', districts: 'Alpine, Davis, Nebo, Washington' },
  { id: 214,  title: 'A Court of Silver Flames',                          surname: 'Maas',     date: '2024-08-02', districts: 'Alpine, Davis, Nebo, Washington' },
  { id: 224,  title: 'What Girls Are Made Of',                            surname: 'Arnold',   date: '2024-08-02', districts: 'Alpine, Davis, Jordan, Washington' },
  { id: 201,  title: 'A Court of Wings and Ruin',                         surname: 'Maas',     date: '2024-08-02', districts: 'Alpine, Davis, Nebo, Washington' },
  { id: 229,  title: 'Milk and Honey',                                    surname: 'Kaur',     date: '2024-08-02', districts: 'Davis, Jordan, Washington' },
  { id: 37,   title: 'Forever',                                           surname: 'Blume',    date: '2024-08-02', districts: 'Davis, Nebo, Washington' },
  { id: 7536, title: 'Tilt',                                              surname: 'Hopkins',  date: '2024-08-02', districts: 'Davis, Tooele, Washington' },
  { id: 223,  title: 'Fallout',                                           surname: 'Hopkins',  date: '2024-08-02', districts: 'Alpine, Davis, Jordan, Washington' },
  { id: 265,  title: 'Oryx and Crake',                                    surname: 'Atwood',   date: '2024-08-02', districts: 'Davis, Jordan, Washington' },
  { id: 254,  title: 'Blankets',                                          surname: 'Thompson', date: '2024-08-02', districts: 'Davis, Nebo, Washington' },
  { id: 199,  title: 'Empire of Storms',                                  surname: 'Maas',     date: '2024-08-02', districts: 'Davis, Jordan, Washington' },
  { id: 207,  title: 'Living Dead Girl',                                  surname: 'Scott',    date: '2024-11-07', districts: 'Davis, Tooele, Washington' },
  { id: 216,  title: 'Damsel',                                            surname: 'Arnold',   date: '2025-01-21', districts: 'Davis, Park City, Washington' },
  { id: 251,  title: 'Like a Love Story',                                 surname: 'Nazemian', date: '2025-01-28', districts: 'Davis, Jordan, Washington' },
  { id: 192,  title: 'Tricks',                                            surname: 'Hopkins',  date: '2025-03-06', districts: 'Davis, Tooele, Washington' },
  { id: 181,  title: 'Water for Elephants',                               surname: 'Gruen',    date: '2025-05-05', districts: 'Cache, Davis, Tooele' },
  { id: 121,  title: 'Thirteen Reasons Why',                              surname: 'Asher',    date: '2025-10-23', districts: 'Nebo, Tooele, Washington' },
  { id: 221,  title: 'Wicked: The Life and Times of the Wicked Witch of the West', surname: 'Maguire', date: '2026-01-05', districts: 'Davis, Tooele, Washington' },
  { id: 135,  title: 'Nineteen Minutes',                                  surname: 'Picoult',  date: '2026-01-05', districts: 'Davis, Tooele, Washington' },
  { id: 29,   title: 'The Perks of Being a Wallflower',                   surname: 'Chbosky',  date: '2026-01-05', districts: 'Davis, Tooele, Washington' },
  { id: 524,  title: 'Bag of Bones',                                      surname: 'King',     date: '2026-02-13', districts: 'Davis, Granite, Jordan, Tooele' },
  { id: 963,  title: 'Breathless',                                        surname: 'Niven',    date: '2026-03-02', districts: 'Davis, Granite, Washington' },
  { id: 225,  title: 'The Carnival at Bray',                              surname: 'Foley',    date: '2026-03-02', districts: 'Davis, Granite, Washington' },
  { id: 227,  title: "The Handmaid's Tale: The Graphic Novel",           surname: 'Atwood',   date: '2026-03-02', districts: 'Davis, Granite, Washington' },
  { id: 242,  title: 'Red Hood',                                          surname: 'Arnold',   date: '2026-03-02', districts: 'Davis, Granite, Washington' },
  { id: 120,  title: 'Looking for Alaska',                                surname: 'Green',    date: '2026-03-13', districts: 'Davis, Jordan, Tooele, Washington' },
  { id: 252,  title: 'Life is Funny',                                     surname: 'Frank',    date: '2026-04-17', districts: 'Davis, Jordan, Washington' },
  { id: 219,  title: 'The Haters',                                        surname: 'Andrews',  date: '2026-04-17', districts: 'Davis, Jordan, Washington' },
  { id: 5,    title: 'The Bluest Eye',                                    surname: 'Morrison', date: '2026-04-17', districts: 'Davis, Jordan, Washington' },
  { id: 237,  title: 'People Kill People',                                surname: 'Hopkins',  date: '2026-04-17', districts: 'Davis, Jordan, Tooele' },
  { id: 231,  title: 'A Stolen Life',                                     surname: 'Dugard',   date: '2026-04-27', districts: 'Cache, Davis, Granite' },
  { id: 268,  title: 'A Clash of Kings',                                  surname: 'Martin',   date: '2026-04-27', districts: 'Alpine, Davis, Jordan' },
  { id: 205,  title: 'Lucky',                                             surname: 'Sebold',   date: '2026-06-05', districts: 'Davis, Granite, Tooele, Washington' },
  { id: 1280, title: 'Different Seasons',                                 surname: 'King',     date: '2026-07-06', districts: 'Davis, Jordan, Tooele, Washington' },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function monthYear(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
function describe(r: Row): string {
  return `In ${monthYear(r.date)}, ${r.title} was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (${r.districts}).`
}

/** Assert a book id still resolves to the expected title + author surname. */
async function assertBook(pg: Client, r: Row) {
  const book = (await pg.query(`select id, title from books where id=$1`, [r.id])).rows[0]
  if (!book) throw new Error(`book #${r.id} (${r.title}) not found — aborting`)
  const authors = (await pg.query(
    `select a.display_name from authors a join book_authors ba on ba.author_id=a.id where ba.book_id=$1`, [r.id])).rows
  const hasAuthor = authors.some((a: any) => a.display_name.toLowerCase().includes(r.surname.toLowerCase()))
  if (!hasAuthor) {
    throw new Error(`book #${r.id} "${book.title}" author mismatch — expected surname "${r.surname}", got [${authors.map((a: any) => a.display_name).join(', ')}]`)
  }
  return book.title as string
}

async function ensureSources(pg: Client): Promise<number[]> {
  const ids: number[] = []
  for (const s of SOURCES) {
    const existing = (await pg.query(`select id from ban_sources where source_url=$1`, [s.source_url])).rows[0]
    if (existing) { ids.push(existing.id); continue }
    if (!APPLY) { console.log(`  [source] would INSERT "${s.source_name}"`); ids.push(-1); continue }
    const ins = (await pg.query(
      `insert into ban_sources(source_name,source_url,source_type,accessed_at,verification_status)
       values($1,$2,$3,$4,'verified') returning id`,
      [s.source_name, s.source_url, s.source_type, ACCESSED_AT])).rows[0]
    ids.push(ins.id)
  }
  return ids
}

async function upsertStatewideBan(pg: Client, r: Row, sourceIds: number[]) {
  // Existing statewide ban for this book? (region=Utah + state-level institution)
  const existing = (await pg.query(
    `select id, institution, year_started, description from bans
     where book_id=$1 and country_code='US' and region='Utah'
       and (institution ilike '%state board%' or institution ilike '%state school board%')
     order by id limit 1`, [r.id])).rows[0]

  const desc = describe(r)
  const year = Number(r.date.slice(0, 4))
  let banId: number

  if (existing) {
    console.log(`  UPDATE ban ${existing.id} — "${r.title}" (was inst="${existing.institution}", yr=${existing.year_started})`)
    if (APPLY) {
      await pg.query(
        `update bans set institution=$2, scope_id=$3, action_type='banned', status='active',
           region='Utah', year_started=$4, description=$5, confidence='verified' where id=$1`,
        [existing.id, INSTITUTION, SCOPE_GOVERNMENT, year, desc])
    }
    banId = existing.id
  } else {
    console.log(`  INSERT statewide ban — #${r.id} "${r.title}" (${monthYear(r.date)})`)
    if (!APPLY) return
    banId = (await pg.query(
      `insert into bans(book_id,country_code,scope_id,action_type,status,region,institution,year_started,description,confidence)
       values($1,'US',$2,'banned','active','Utah',$3,$4,$5,'verified') returning id`,
      [r.id, SCOPE_GOVERNMENT, INSTITUTION, year, desc])).rows[0].id
  }

  if (APPLY) {
    for (const sid of sourceIds) {
      await pg.query(`insert into ban_source_links(ban_id,source_id) values($1,$2) on conflict do nothing`, [banId, sid])
    }
  }
}

/** Fold Different Seasons #14321 (RU ban only) into canonical #1280. */
async function mergeDifferentSeasons(pg: Client) {
  const KEEP = 1280, DROP = 14321
  const keep = (await pg.query(`select id,slug,title from books where id=$1`, [KEEP])).rows[0]
  const drop = (await pg.query(`select id,slug,title from books where id=$1`, [DROP])).rows[0]
  if (!drop) { console.log(`\n[merge] Different Seasons DROP #${DROP} already gone — no-op.`); return }
  if (!keep) throw new Error(`[merge] KEEP #${KEEP} not found`)
  console.log(`\n[merge] KEEP #${KEEP} "${keep.title}" ← DROP #${DROP} "${drop.title}"`)

  // Guard: never cascade-delete a curated pick.
  for (const t of ['bbw_featured_selections','reading_club_classics','reading_club_currently_challenged',
                   'reading_club_international','reading_club_theme_books','reading_club_young_readers']) {
    const hit = (await pg.query(`select 1 from ${t} where book_id=$1 limit 1`, [DROP])).rows[0]
    if (hit) throw new Error(`[merge] DROP #${DROP} referenced by curated table ${t} — abort`)
  }

  // Migrate bans, dedup on country+scope.
  const keepBans = (await pg.query(`select id,country_code,scope_id from bans where book_id=$1`, [KEEP])).rows
  const dropBans = (await pg.query(`select id,country_code,scope_id from bans where book_id=$1`, [DROP])).rows
  const key = (b: any) => `${b.country_code}|${b.scope_id ?? ''}`
  const keepKeys = new Set(keepBans.map(key))
  for (const b of dropBans) {
    if (keepKeys.has(key(b))) {
      const match = keepBans.find((k: any) => key(k) === key(b))
      console.log(`  ban ${b.id} ${b.country_code}/scope=${b.scope_id}: DUP of KEEP ban ${match.id} → union links, drop via cascade`)
      if (APPLY) await pg.query(`insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing`, [match.id, b.id])
    } else {
      console.log(`  ban ${b.id} ${b.country_code}/scope=${b.scope_id}: MOVE → KEEP`)
      if (APPLY) await pg.query(`update bans set book_id=$1 where id=$2`, [KEEP, b.id])
      keepKeys.add(key(b))
    }
  }

  // Slug aliases: re-point DROP's, add DROP.slug as legacy alias.
  if (APPLY) await pg.query(`update book_slug_aliases set book_id=$1 where book_id=$2`, [KEEP, DROP])
  if (drop.slug && drop.slug !== keep.slug) {
    console.log(`  alias add legacy "${drop.slug}" → KEEP`)
    if (APPLY) await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [drop.slug, KEEP])
  }

  console.log(`  DELETE book #${DROP} (CASCADE)`)
  if (APPLY) await pg.query(`delete from books where id=$1`, [DROP])
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`── backfill-utah-statewide-bans ── (${APPLY ? 'APPLY' : 'DRY-RUN'})  ${ROWS.length} titles`)
  try {
    if (APPLY) await pg.query('begin')

    // 0. Assert every book id still maps to the expected title+author (namesake guard).
    console.log('\n[assert] verifying book id → title/author …')
    for (const r of ROWS) {
      const t = await assertBook(pg, r)
      if (!t.toLowerCase().includes(r.title.toLowerCase().slice(0, 12).replace(/[^a-z0-9 ].*/, '')))
        console.log(`  note: #${r.id} db-title "${t}" vs list "${r.title}"`)
    }
    console.log('  all 36 book ids verified ✓')

    // 1. Merge the Different Seasons duplicate first.
    await mergeDifferentSeasons(pg)

    // 2. Ensure sources exist.
    const sourceIds = await ensureSources(pg)

    // 3. Upsert one statewide ban per title.
    console.log('\n[bans] upserting statewide records …')
    for (const r of ROWS) await upsertStatewideBan(pg, r, sourceIds)

    if (APPLY) { await pg.query('commit'); console.log('\nApplied (single transaction).') }
    else console.log('\nDry-run — re-run with --apply.')
  } catch (err) {
    if (APPLY) { try { await pg.query('rollback'); console.error('Rolled back.') } catch { /* */ } }
    throw err
  } finally {
    await pg.end()
  }
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
