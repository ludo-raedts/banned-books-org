#!/usr/bin/env tsx
/**
 * Split the collapsed "Perfect" record (#520) back into its real authors.
 *
 * WHY: PEN's School Book Bans index disambiguates same-title books with an
 * initials suffix — `Perfect (EH)` = Ellen Hopkins (Impulse #2, 2011),
 * `Perfect (SS)` = Sara Shepard (Pretty Little Liars #3, 2006),
 * `Perfect (CA)` = Cecelia Ahern (Flawed #2, 2017). An earlier import stripped
 * the suffix and hung every row on #520 "Perfect"/Sara Shepard, so ~75 Hopkins
 * bans (incl. the 4 Utah districts that tipped it onto the USBE statewide list)
 * were credited to Shepard. Same failure class as Breathless
 * (memory: project_pen_suffix_collapse).
 *
 * HOW: attribution comes from PEN's own CSVs (data/pen-20xx-yy.csv), keyed by
 * state + district. Per ban on #520:
 *   - only Hopkins rows for that district → MOVE the ban to the Hopkins book
 *   - only Shepard rows                   → keep on #520
 *   - Hopkins AND Shepard rows            → keep on #520 + CLONE to Hopkins
 *     (PEN lists both books there; the old import collapsed them into one row)
 *   - only Ahern rows                     → MOVE to the Ahern book
 *   - no PEN row found                    → keep, reported for review
 * Source + reason links travel with a moved ban and are copied for a clone.
 * Creates "Perfect"/Ellen Hopkins (slug perfect-hopkins, 2011) and
 * "Perfect"/Cecelia Ahern (slug perfect-ahern, 2017) when missing (years from
 * Open Library works OL16086729W / OL20679922W).
 *
 * Also corrects #410 The Invisible Life of Addie LaRue first_published_year
 * 2015 → 2020 (Wikidata Q107404757: 2020-10-06; the 2015 came from Open
 * Library's work record). OL harvest only fills NULL years, so this sticks.
 *
 * Idempotent; writes a backup of every touched ban to data/ on --apply.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-perfect-pen-collapse.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-perfect-pen-collapse.ts --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const SHEPARD_BOOK = 520
const PEN_CSVS = ['data/pen-2021-22.csv', 'data/pen-2022-23.csv', 'data/pen-2023-24.csv', 'data/pen-2024-25.csv']

type Who = 'hopkins' | 'shepard' | 'ahern'
const AUTHOR_OF: Record<string, Who> = { hopkins: 'hopkins', shepard: 'shepard', ahern: 'ahern' }

const NEW_BOOKS: Record<Exclude<Who, 'shepard'>, { slug: string; year: number; author: string; authorSlug: string; olWork: string; rationale: string }> = {
  hopkins: {
    slug: 'perfect-hopkins', year: 2011, author: 'Ellen Hopkins', authorSlug: 'ellen-hopkins', olWork: 'OL16086729W',
    rationale: 'Ellen Hopkins\'s verse novel, a companion to Impulse, is among the most frequently removed titles in PEN America\'s Index of School Book Bans and was banned from all Utah public schools in 2026 under HB 29.',
  },
  ahern: {
    slug: 'perfect-ahern', year: 2017, author: 'Cecelia Ahern', authorSlug: 'cecelia-ahern', olWork: 'OL20679922W',
    rationale: 'Cecelia Ahern\'s dystopian young-adult novel, the sequel to Flawed, was restricted in a Texas school district according to PEN America\'s Index of School Book Bans.',
  },
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** state|district → set of authors PEN lists a "Perfect" under there. */
function loadPenAttribution(): Map<string, Set<Who>> {
  const map = new Map<string, Set<Who>>()
  for (const f of PEN_CSVS) {
    const rows: string[][] = parse(readFileSync(f, 'utf8'), { relax_column_count: true, bom: true })
    for (const r of rows) {
      if (r.length < 8) continue
      // 2021-22 is author,title,…; later years are title,author,…
      const [title, author] = /^perfect\b/i.test(r[0]) ? [r[0], r[1]] : [r[1], r[0]]
      if (!/^perfect( \([A-Z]{2}\)| \(Impulse Series\))?$/i.test(title.trim())) continue
      const who = AUTHOR_OF[norm(author).split(' ')[0]]
      if (!who) { console.warn(`  [pen] unknown author for "${title}": ${author} (${f})`); continue }
      const key = `${norm(r[6])}|${norm(r[7])}`
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(who)
    }
  }
  return map
}

async function ensureBook(pg: Client, who: Exclude<Who, 'shepard'>): Promise<number> {
  const spec = NEW_BOOKS[who]
  const existing = (await pg.query(`select id from books where slug=$1`, [spec.slug])).rows[0]
  if (existing) return Number(existing.id)
  if (!APPLY) { console.log(`  [book] would CREATE "Perfect"/${spec.author} (${spec.slug}, ${spec.year})`); return -1 }
  let author = (await pg.query(`select id from authors where slug=$1`, [spec.authorSlug])).rows[0]
  if (!author) {
    author = (await pg.query(`insert into authors(slug, display_name) values($1,$2) returning id`, [spec.authorSlug, spec.author])).rows[0]
    console.log(`  [author] created #${author.id} ${spec.author}`)
  }
  const book = (await pg.query(
    `insert into books(title, slug, inclusion_rationale, ai_drafted, original_language, first_published_year, openlibrary_work_id)
     values('Perfect',$1,$2,false,'en',$3,$4) returning id`,
    [spec.slug, spec.rationale, spec.year, spec.olWork])).rows[0]
  await pg.query(`insert into book_authors(book_id, author_id) values($1,$2) on conflict do nothing`, [book.id, author.id])
  console.log(`  [book] created #${book.id} "Perfect"/${spec.author}`)
  return Number(book.id)
}

async function main() {
  const pen = loadPenAttribution()
  const pg = newPgClient()
  await pg.connect()
  try {
    const shep = (await pg.query(
      `select b.id, b.title, a.display_name from books b join book_authors ba on ba.book_id=b.id join authors a on a.id=ba.author_id where b.id=$1`,
      [SHEPARD_BOOK])).rows[0]
    if (!shep || shep.title !== 'Perfect' || !/shepard/i.test(shep.display_name)) {
      throw new Error(`#${SHEPARD_BOOK} is not "Perfect"/Sara Shepard — aborting (${JSON.stringify(shep)})`)
    }

    const bans = (await pg.query(`select * from bans where book_id=$1 order by id`, [SHEPARD_BOOK])).rows
    console.log(`#${SHEPARD_BOOK} carries ${bans.length} bans; PEN attribution keys: ${pen.size}`)

    if (APPLY) await pg.query('BEGIN')
    const target: Record<string, number> = {}
    target.hopkins = await ensureBook(pg, 'hopkins')
    target.ahern = await ensureBook(pg, 'ahern')

    const tally = { move_hopkins: 0, move_ahern: 0, clone_hopkins: 0, keep_shepard: 0, unattributed: 0 }
    const backup: any[] = []
    for (const b of bans) {
      const who = pen.get(`${norm(b.region ?? '')}|${norm(b.institution ?? '')}`)
      const label = `ban ${b.id} ${b.year_started} ${b.region} / ${b.institution}`
      if (!who) { tally.unattributed++; console.log(`  ? ${label} — no PEN row, kept`); continue }
      const links = (await pg.query(`select source_id from ban_source_links where ban_id=$1`, [b.id])).rows.map(r => r.source_id)
      const reasons = (await pg.query(`select reason_id from ban_reason_links where ban_id=$1`, [b.id])).rows.map(r => r.reason_id)

      if (who.has('shepard') && !who.has('hopkins') && !who.has('ahern')) { tally.keep_shepard++; continue }
      if (who.has('shepard') && who.has('hopkins')) {
        tally.clone_hopkins++
        console.log(`  + ${label} — PEN lists both; keep + clone to Hopkins`)
        if (!APPLY) continue
        backup.push({ action: 'clone', ban: b, links, reasons })
        const clone = (await pg.query(
          `insert into bans(book_id,country_code,scope_id,action_type,status,region,institution,year_started,year_ended,actor,description,confidence)
           select $2,country_code,scope_id,action_type,status,region,institution,year_started,year_ended,actor,description,confidence from bans where id=$1
           on conflict on constraint bans_unique_per_scope do nothing returning id`,
          [b.id, target.hopkins])).rows[0]
        if (clone) {
          for (const s of links) await pg.query(`insert into ban_source_links(ban_id,source_id) values($1,$2) on conflict do nothing`, [clone.id, s])
          for (const r of reasons) await pg.query(`insert into ban_reason_links(ban_id,reason_id) values($1,$2) on conflict do nothing`, [clone.id, r])
        }
        continue
      }
      const dest: Exclude<Who, 'shepard'> = who.has('hopkins') ? 'hopkins' : 'ahern'
      tally[dest === 'hopkins' ? 'move_hopkins' : 'move_ahern']++
      console.log(`  → ${label} — move to ${dest}`)
      if (!APPLY) continue
      backup.push({ action: `move_${dest}`, ban: b, links, reasons })
      await pg.query(`update bans set book_id=$2 where id=$1`, [b.id, target[dest]])
    }

    // Addie LaRue year (Wikidata Q107404757 = 2020-10-06).
    const addie = (await pg.query(`select id,title,first_published_year from books where id=410`)).rows[0]
    if (addie?.title !== 'The Invisible Life of Addie LaRue') throw new Error(`#410 is not Addie LaRue — aborting`)
    if (addie.first_published_year !== 2020) {
      console.log(`  [year] #410 Addie LaRue ${addie.first_published_year} → 2020`)
      if (APPLY) await pg.query(`update books set first_published_year=2020 where id=410`)
    }

    console.log('\nSummary:', tally)
    if (APPLY) {
      await pg.query('COMMIT')
      const out = `data/perfect-pen-collapse-backup-${new Date().toISOString().slice(0, 10)}.json`
      writeFileSync(out, JSON.stringify(backup, null, 2))
      console.log(`Backup → ${out}`)
    } else {
      console.log('DRY-RUN — re-run with --apply to write.')
    }
  } catch (e) {
    if (APPLY) await pg.query('ROLLBACK')
    throw e
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
