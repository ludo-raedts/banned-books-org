#!/usr/bin/env tsx
/**
 * Split PEN "author-suffix collapse" titles back into their real authors.
 *
 * WHY: PEN's School Book Bans index disambiguates same-title books by
 * different authors with an initials suffix — `Tilt (EH)` = Ellen Hopkins,
 * `Tilt (AC)` = Alan Cumyn. An earlier import stripped the suffix and hung
 * every row on one book record with one (often wrong) author. Generalises
 * scripts/fix-perfect-pen-collapse.ts (Perfect, f35a7df) to a config table;
 * memory: project_pen_suffix_collapse.
 *
 * HOW: attribution comes from PEN's own CSVs (data/pen-20xx-yy.csv), keyed by
 * state + district, narrowed to the ban's year when PEN has rows for it. Per ban on any of the title's book records:
 *   - holder's author is among PEN's authors there → keep; CLONE to the
 *     other listed authors (the old import collapsed both rows into one)
 *   - holder's author is not listed               → MOVE to a listed author
 *     (FOLD = merge links + delete, when that book already has the same ban)
 *   - no PEN row for that district                → keep, reported
 * Source + reason links travel with a moved ban and are copied for a clone.
 * Missing author books are created (slug <title>-<surname>, year + work id
 * from Open Library, checked against publisher/Wikipedia dates).
 *
 * Idempotent; writes a backup of every touched ban to data/ on --apply.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-pen-suffix-collapse.ts [--title=Tilt]          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-pen-suffix-collapse.ts [--title=Tilt] --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { flagValue, isApply } from './lib/cli'

const APPLY = isApply()
const PEN_CSVS = ['data/pen-2021-22.csv', 'data/pen-2022-23.csv', 'data/pen-2023-24.csv', 'data/pen-2024-25.csv']

type NewBook = { slug: string; year: number; author: string; authorSlug: string; olWork: string; rationale: string }
/** PEN author surname (lowercased, as in "Surname, First") → existing book id, or a book to create. */
type AuthorSpec = { bookId: number } | { create: NewBook }
type TitleSpec = {
  title: string
  authors: Record<string, AuthorSpec>
  /** Display-title / year corrections on existing records (PEN suffix left in the title, wrong year). */
  fixes?: { bookId: number; title?: string; year?: number }[]
}

const pen = (who: string, what: string, where: string) =>
  `${who}'s ${what} was removed from ${where} according to PEN America's Index of School Book Bans.`

const TITLES: TitleSpec[] = [
  {
    title: 'Twisted',
    authors: {
      anderson: { bookId: 391 },
      showalter: { create: { slug: 'twisted-showalter', year: 2011, author: 'Gena Showalter', authorSlug: 'gena-showalter', olWork: 'OL17484393W',
        rationale: pen('Gena Showalter', 'young-adult paranormal novel, the third book of the Intertwined series,', 'school libraries') } },
      shepard: { create: { slug: 'twisted-shepard', year: 2011, author: 'Sara Shepard', authorSlug: 'sara-shepard', olWork: 'OL16014239W',
        rationale: pen('Sara Shepard', 'young-adult mystery, the ninth Pretty Little Liars novel,', 'school libraries') } },
    },
  },
  { title: 'Tilt', authors: { hopkins: { bookId: 7536 }, cumyn: { bookId: 23873 } } },
  {
    title: 'Lawn Boy',
    authors: {
      evison: { bookId: 273 },
      paulsen: { create: { slug: 'lawn-boy-paulsen', year: 2007, author: 'Gary Paulsen', authorSlug: 'gary-paulsen', olWork: 'OL14850152W',
        rationale: pen('Gary Paulsen', 'comic middle-grade novel about a twelve-year-old\'s lawn-mowing business', 'a school district — PEN lists it separately from Jonathan Evison\'s much-challenged novel of the same title') } },
    },
  },
  { title: 'Crush', authors: { mac: { bookId: 2125 }, wolff: { bookId: 23872 } } },
  {
    title: 'City of Thieves',
    authors: {
      benioff: { bookId: 1686 },
      london: { create: { slug: 'city-of-thieves-london', year: 2022, author: 'Alex London', authorSlug: 'alex-london', olWork: 'OL27171774W',
        rationale: pen('Alex London', 'middle-grade fantasy, the first Battle Dragons novel,', 'a school district') } },
    },
  },
  {
    title: 'Burned',
    authors: {
      hopkins: { bookId: 326 },
      cast: { bookId: 531 },
      shepard: { create: { slug: 'burned-shepard', year: 2012, author: 'Sara Shepard', authorSlug: 'sara-shepard', olWork: 'OL17573826W',
        rationale: pen('Sara Shepard', 'young-adult mystery, the twelfth Pretty Little Liars novel,', 'school libraries') } },
    },
    // House of Night #7 (St. Martin's Griffin, 2010); title kept PEN's "(PCC)" disambiguator.
    fixes: [{ bookId: 531, title: 'Burned', year: 2010 }],
  },
  {
    title: 'Blue Moon',
    authors: {
      'noël': { bookId: 8770 },
      ponti: { create: { slug: 'blue-moon-ponti', year: 2013, author: 'James Ponti', authorSlug: 'james-ponti', olWork: 'OL19706426W',
        rationale: pen('James Ponti', 'middle-grade mystery, the second Dead City novel,', 'a school district') } },
    },
  },
  { title: 'After', authors: { efaw: { bookId: 1118 }, todd: { bookId: 23855 } } },
  {
    title: 'Male/Female Roles',
    authors: {
      leone: { bookId: 10010 },
      ojeda: { create: { slug: 'male-female-roles-ojeda', year: 2004, author: 'Auriana Ojeda', authorSlug: 'auriana-ojeda', olWork: 'OL8213177W',
        rationale: pen('Auriana Ojeda', 'Opposing Viewpoints anthology on gender roles', 'a school district') } },
    },
  },
  {
    title: 'Gender Identity',
    authors: {
      light: { bookId: 1423 },
      petrikowski: { bookId: 1802 },
      abraham: { create: { slug: 'gender-identity-abraham', year: 2021, author: 'Anika Abraham', authorSlug: 'anika-abraham', olWork: 'OL25914401W',
        rationale: pen('Anika Abraham', 'nonfiction book for young readers about gender identity', 'a school district') } },
      ghafoerkhan: { create: { slug: 'gender-identity-ghafoerkhan', year: 2020, author: 'Olivia Ghafoerkhan', authorSlug: 'olivia-ghafoerkhan', olWork: 'OL22167759W',
        rationale: pen('Olivia Ghafoerkhan', 'nonfiction book for teens about gender identity', 'a school district') } },
    },
    // Teen Mental Health series volume (Rosen, 2013); title kept PEN's series disambiguator.
    fixes: [{ bookId: 1802, title: 'Gender Identity' }],
  },
  {
    title: 'Forget Me Not',
    authors: {
      derrick: { bookId: 4457 },
      dean: { create: { slug: 'forget-me-not-dean', year: 2012, author: 'Carolee Dean', authorSlug: 'carolee-dean', olWork: 'OL16151904W',
        rationale: pen('Carolee Dean', 'young-adult verse novel about bullying', 'a school district') } },
    },
  },
]

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

type PenRow = { who: string; year: number | null }
/** title → state|district → PEN rows (author key + year). */
function loadPen(specs: TitleSpec[]): Map<string, Map<string, PenRow[]>> {
  const out = new Map<string, Map<string, PenRow[]>>(specs.map(s => [s.title, new Map()]))
  for (const f of PEN_CSVS) {
    const rows: string[][] = parse(readFileSync(f, 'utf8'), { relax_column_count: true, bom: true })
    // 2021-22 is author,title,…; later years title,author,… (2022-23 has no header row).
    // State/District/Date sit at columns 6/7/8 in every year.
    const [ti, ai] = f.includes('2021-22') ? [1, 0] : [0, 1]
    for (const r of rows) {
      if (r.length < 9 || r[6] === 'State') continue
      const title = (r[ti] ?? '').trim()
      const spec = specs.find(s => title.toLowerCase() === s.title.toLowerCase() || title.toLowerCase().startsWith(`${s.title.toLowerCase()} (`))
      if (!spec) continue
      const who = (r[ai] ?? '').split(',')[0].trim().toLowerCase()
      if (!spec.authors[who]) { console.warn(`  [pen] unknown author for "${title}": ${r[ai]} (${f})`); continue }
      const key = `${norm(r[6])}|${norm(r[7])}`
      const m = out.get(spec.title)!
      if (!m.has(key)) m.set(key, [])
      const y = (r[8] ?? '').match(/\d{4}/)
      m.get(key)!.push({ who, year: y ? Number(y[0]) : null })
    }
  }
  return out
}

async function ensureBook(pg: Client, title: string, spec: NewBook): Promise<number> {
  const existing = (await pg.query(`select id from books where slug=$1`, [spec.slug])).rows[0]
  if (existing) return Number(existing.id)
  if (!APPLY) { console.log(`  [book] would CREATE "${title}"/${spec.author} (${spec.slug}, ${spec.year})`); return -1 }
  let author = (await pg.query(`select id from authors where slug=$1`, [spec.authorSlug])).rows[0]
  if (!author) {
    author = (await pg.query(`insert into authors(slug, display_name) values($1,$2) returning id`, [spec.authorSlug, spec.author])).rows[0]
    console.log(`  [author] created #${author.id} ${spec.author}`)
  }
  const book = (await pg.query(
    `insert into books(title, slug, inclusion_rationale, ai_drafted, original_language, first_published_year, openlibrary_work_id)
     values($1,$2,$3,false,'en',$4,$5) returning id`,
    [title, spec.slug, spec.rationale, spec.year, spec.olWork])).rows[0]
  await pg.query(`insert into book_authors(book_id, author_id) values($1,$2) on conflict do nothing`, [book.id, author.id])
  console.log(`  [book] created #${book.id} "${title}"/${spec.author}`)
  return Number(book.id)
}

async function processTitle(pg: Client, spec: TitleSpec, penRows: Map<string, PenRow[]>, backup: any[]) {
  console.log(`\n=== ${spec.title}  (PEN district keys: ${penRows.size})`)
  // Resolve + verify existing records; create missing ones.
  const bookOf: Record<string, number> = {}
  const whoOf = new Map<number, string>()
  for (const [who, a] of Object.entries(spec.authors)) {
    if ('bookId' in a) {
      const row = (await pg.query(
        `select b.title, string_agg(a.display_name, '; ') authors from books b join book_authors ba on ba.book_id=b.id join authors a on a.id=ba.author_id where b.id=$1 group by b.title`,
        [a.bookId])).rows[0]
      if (!row || !row.title.toLowerCase().startsWith(spec.title.toLowerCase()) || !norm(row.authors).includes(norm(who))) {
        throw new Error(`#${a.bookId} is not "${spec.title}"/${who} — aborting (${JSON.stringify(row)})`)
      }
      bookOf[who] = a.bookId
    } else {
      bookOf[who] = await ensureBook(pg, spec.title, a.create)
    }
    whoOf.set(bookOf[who], who)
  }

  const tally: Record<string, number> = { keep: 0, move: 0, fold: 0, clone: 0, clone_exists: 0, unattributed: 0 }
  const holders = Object.values(bookOf).filter(id => id > 0)
  const bans = (await pg.query(`select * from bans where book_id = any($1) order by book_id, id`, [holders])).rows
  const before = Object.fromEntries(holders.map(id => [id, bans.filter(b => Number(b.book_id) === id).length]))
  console.log(`  before: ${JSON.stringify(Object.fromEntries(Object.entries(bookOf).map(([w, id]) => [`${w}#${id}`, before[id] ?? 0])))}`)

  /** Same ban (unique key minus book) already on `bookId`? */
  const twin = async (b: any, bookId: number) => bookId > 0 ? (await pg.query(
    `select id from bans where book_id=$1 and country_code is not distinct from $2 and year_started is not distinct from $3
       and scope_id is not distinct from $4 and region is not distinct from $5 and institution is not distinct from $6`,
    [bookId, b.country_code, b.year_started, b.scope_id, b.region, b.institution])).rows[0] : undefined

  for (const b of bans) {
    const cur = whoOf.get(Number(b.book_id))!
    const label = `ban ${b.id} ${b.year_started} ${b.region} / ${b.institution} [on ${cur}]`
    const rows = penRows.get(`${norm(b.region ?? '')}|${norm(b.institution ?? '')}`)
    if (!rows) { tally.unattributed++; console.log(`  ? ${label} — no PEN row, kept`); continue }
    // Prefer PEN rows from the ban's own year; fall back to the whole district.
    const sameYear = [...new Set(rows.filter(r => r.year === b.year_started).map(r => r.who))]
    const listed = sameYear.length ? sameYear : [...new Set(rows.map(r => r.who))]
    const links = (await pg.query(`select source_id from ban_source_links where ban_id=$1`, [b.id])).rows.map(r => r.source_id)
    const reasons = (await pg.query(`select reason_id from ban_reason_links where ban_id=$1`, [b.id])).rows.map(r => r.reason_id)

    const others = listed.filter(w => w !== cur)
    if (listed.includes(cur)) {
      tally.keep++
    } else {
      const dest = others.shift()!
      const t = await twin(b, bookOf[dest])
      if (t) {
        tally.fold++
        console.log(`  ⇢ ${label} — fold into ${dest} ban ${t.id}`)
        if (APPLY) {
          backup.push({ title: spec.title, action: `fold_${dest}`, into: t.id, ban: b, links, reasons })
          for (const s of links) await pg.query(`insert into ban_source_links(ban_id,source_id) values($1,$2) on conflict do nothing`, [t.id, s])
          for (const r of reasons) await pg.query(`insert into ban_reason_links(ban_id,reason_id) values($1,$2) on conflict do nothing`, [t.id, r])
          await pg.query(`delete from bans where id=$1`, [b.id])
        }
      } else {
        tally.move++
        console.log(`  → ${label} — move to ${dest}`)
        if (APPLY) {
          backup.push({ title: spec.title, action: `move_${dest}`, ban: b, links, reasons })
          await pg.query(`update bans set book_id=$2 where id=$1`, [b.id, bookOf[dest]])
        }
      }
    }
    for (const w of others) {
      if (await twin(b, bookOf[w])) { tally.clone_exists++; continue }
      tally.clone++
      console.log(`  + ${label} — PEN lists ${listed.join('+')}; clone to ${w}`)
      if (!APPLY) continue
      backup.push({ title: spec.title, action: `clone_${w}`, ban: b, links, reasons })
      const clone = (await pg.query(
        `insert into bans(book_id,country_code,scope_id,action_type,status,region,institution,year_started,year_ended,actor,description,confidence)
         select $2,country_code,scope_id,action_type,status,region,institution,year_started,year_ended,actor,description,confidence from bans where id=$1
         on conflict on constraint bans_unique_per_scope do nothing returning id`,
        [b.id, bookOf[w]])).rows[0]
      if (clone) {
        for (const s of links) await pg.query(`insert into ban_source_links(ban_id,source_id) values($1,$2) on conflict do nothing`, [clone.id, s])
        for (const r of reasons) await pg.query(`insert into ban_reason_links(ban_id,reason_id) values($1,$2) on conflict do nothing`, [clone.id, r])
      }
    }
  }

  for (const f of spec.fixes ?? []) {
    const row = (await pg.query(`select title, first_published_year from books where id=$1`, [f.bookId])).rows[0]
    if (f.title && row.title !== f.title) {
      console.log(`  [title] #${f.bookId} "${row.title}" → "${f.title}"`)
      if (APPLY) await pg.query(`update books set title=$2 where id=$1`, [f.bookId, f.title])
    }
    if (f.year && row.first_published_year !== f.year) {
      console.log(`  [year] #${f.bookId} ${row.first_published_year} → ${f.year}`)
      if (APPLY) await pg.query(`update books set first_published_year=$2 where id=$1`, [f.bookId, f.year])
    }
  }
  console.log(`  summary: ${JSON.stringify(tally)}`)
  return tally
}

async function main() {
  const only = flagValue('title')
  const specs = only ? TITLES.filter(t => t.title.toLowerCase() === only.toLowerCase()) : TITLES
  if (!specs.length) throw new Error(`no config for --title=${only}`)
  const penAll = loadPen(specs)
  const pg = newPgClient()
  await pg.connect()
  const backup: any[] = []
  try {
    if (APPLY) await pg.query('BEGIN')
    const total: Record<string, number> = {}
    for (const spec of specs) {
      const t = await processTitle(pg, spec, penAll.get(spec.title)!, backup)
      for (const [k, v] of Object.entries(t)) total[k] = (total[k] ?? 0) + v
    }
    console.log('\nTOTAL:', total)
    if (APPLY) {
      await pg.query('COMMIT')
      const out = `data/pen-suffix-collapse-backup-${new Date().toISOString().slice(0, 10)}.json`
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
