/**
 * Three patterns in the ban rows, found while checking the censorship
 * histories against sources (2026-11-11). Each fix rests on the row's own
 * source, read again — not on a model's opinion.
 *
 * A. Russian extremist register: the feed date taken for a listing date.
 *    258 rows carry year_started 2020 and "Added to list: 2020-09-04" — the day
 *    the Ministry's RSS feed was re-published, not the day each entry was
 *    listed. Their court decisions date from 2004–2016. The Ministry's own
 *    export (data/source-research/russia-fsem-export-2026-11-09.csv) has no
 *    inclusion date for these early entries, and the full import of 2026-11-09
 *    dates such an entry by its court decision (year_basis 'court_decision').
 *    Same rule here: year_started → the year of the court decision named in
 *    the row's note (or the export's inclusion date where it has one), and the
 *    false "Added to list" sentence leaves the note.
 *
 * B. Wikipedia "List of books banned by governments": publication year as ban
 *    year. The list has the columns Title · Author(s) · Year published · Type ·
 *    Notes — no year of banning. The import put "Year published" into
 *    bans.year_started (the same mistake as source 825, fixed earlier today).
 *    A year becomes NULL (unknown) only when all of this holds:
 *      - every source linked to the ban is that Wikipedia list;
 *      - the ban's year equals the "Year published" cell of the book's row in
 *        the country's table (wikitext fetched live);
 *      - neither that row's Notes nor our own note states that year.
 *    A row we cannot find in the wikitext is left alone.
 *
 * C. The Satanic Verses, Malaysia: two rows for one ban (#1003 from Wikipedia,
 *    year 1988; #26694 from the KDN register, gazetted 30 March 1989). #1003's
 *    own note says "Banned March 1989". The register row is kept; it takes the
 *    Wikipedia sources and the sentence on the penalty; #1003 is removed.
 *
 * Nothing is written without --apply. A row whose new year would collide with
 * another ban of the same book (bans_unique_per_scope) is skipped and listed.
 *
 *   npx tsx --env-file=.env.local scripts/fix-ban-row-patterns-2026-11.ts            # dry-run + report
 *   npx tsx --env-file=.env.local scripts/fix-ban-row-patterns-2026-11.ts --apply [--only=A,C]
 * Report: data/ban-row-patterns-2026-11-11.md · backup on --apply: data/ban-row-patterns-backup-2026-11-11.json
 * (with --only=X each of these gets the suffix -X; the first run, --only=A,C, wrote the unsuffixed files)
 * After --apply: scripts/refresh-mv.ts, bust the pages in data/ban-row-patterns-busted-paths.txt.
 */

import fs from 'node:fs'
import path from 'node:path'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply, flagValue } from './lib/cli'

const APPLY = isApply()
// --only=A,C writes just those sections; the others are still measured and reported.
const ONLY = flagValue('only')?.split(',').map(s => s.trim().toUpperCase())
const writes = (section: 'A' | 'B' | 'C') => APPLY && (!ONLY || ONLY.includes(section))
// A partial run keeps its own report, backup and path list, so it never overwrites an earlier run's record.
const SUFFIX = ONLY ? `-${ONLY.join('')}` : ''
const FSEM_CSV = 'data/source-research/russia-fsem-export-2026-11-09.csv'
const WIKI_RAW = 'https://en.wikipedia.org/w/index.php?title=List_of_books_banned_by_governments&action=raw'
const UA = { 'User-Agent': 'banned-books.org/1.0 (source verification; contact@banned-books.org)' }

type BanRow = {
  id: number; book_id: number; slug: string; title: string; first_published_year: number | null
  country_code: string; country: string; scope_id: number; region: string | null; institution: string | null
  year_started: number | null; description: string | null
}

// ── A. Russian register ─────────────────────────────────────────────────

/** entry number → ISO inclusion date, from the Ministry's export (';'-separated, quoted, multi-line fields). */
function fsemInclusionDates(): Map<number, string> {
  const text = fs.readFileSync(FSEM_CSV, 'utf8')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') q = false
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ';') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const out = new Map<number, string>()
  for (const r of rows.slice(1)) {
    const n = Number.parseInt(r[0]?.trim() ?? '', 10)
    const d = (r[2] ?? '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (Number.isFinite(n) && d) out.set(n, `${d[3]}-${d[2]}-${d[1]}`)
  }
  return out
}

// ── B. Wikipedia list ───────────────────────────────────────────────────

type WikiRow = { country: string; title: string; yearCell: string; notes: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()

function plain(cell: string): string {
  return cell
    .replace(/<ref[^>]*\/>/g, ' ').replace(/<ref[\s\S]*?<\/ref>/g, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/** Every table row of the list, with the country heading it stands under. */
function parseWikiList(wikitext: string): WikiRow[] {
  const out: WikiRow[] = []
  let country = ''
  for (const block of wikitext.split(/\n(?===)/)) {
    const h = block.match(/^(={2,3})\s*([^=\n]+?)\s*\1/)
    if (h) country = plain(h[2])
    for (const chunk of block.split(/\n\|-[^\n]*/)) {
      const cells: string[] = []
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('|') || line.startsWith('|}') || line.startsWith('|+')) {
          // continuation of the previous cell (multi-line notes)
          if (cells.length && !line.startsWith('!') && !line.startsWith('{|')) cells[cells.length - 1] += ' ' + line
          continue
        }
        for (const part of line.slice(1).split('||')) cells.push(part.replace(/^\s*(?:rowspan|colspan|style|class|scope)\s*=\s*"[^"]*"\s*(?:(?:rowspan|colspan|style|class|scope)\s*=\s*"[^"]*"\s*)*\|/i, ''))
      }
      if (cells.length < 4) continue
      // The Notes cell is the last one; the title cell often carries the year too: ''Title'' (1949)
      out.push({ country, title: plain(cells[0]).replace(/\s*\(\d{4}[^)]*\)\s*$/, ''), yearCell: plain(cells[2]), notes: plain(cells[cells.length - 1]) })
    }
  }
  return out
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  'united states': ['united states of america', 'usa'],
  'united kingdom': ['uk', 'great britain', 'england'],
  'soviet union': ['ussr', 'russia soviet union', 'soviet union and russia'],
  'russia': ['russian federation', 'russian empire'],
  'germany': ['nazi germany', 'west germany'],
  'east germany (ddr)': ['east germany', 'german democratic republic'],
  'china': ["people's republic of china", 'peoples republic of china', 'republic of china'],
  'vatican': ['vatican city', 'holy see', 'catholic church'],
  'south korea': ['korea south', 'republic of korea'],
  'iran': ['islamic republic of iran', 'persia'],
}

function sameCountry(ours: string, heading: string): boolean {
  const a = norm(ours)
  const b = norm(heading)
  if (!a || !b) return false
  if (a === b || b.startsWith(a) || a.startsWith(b)) return true
  return (COUNTRY_ALIASES[ours.toLowerCase()] ?? []).some(x => norm(x) === b)
}

function sameTitle(ours: string, wiki: string): boolean {
  const a = norm(ours)
  const b = norm(wiki)
  if (!a || !b) return false
  if (a === b) return true
  const head = (s: string) => s.split(/[:(]/)[0]
  const ah = norm(head(ours))
  const bh = norm(head(wiki))
  return ah.length >= 6 && ah === bh
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── fix-ban-row-patterns-2026-11 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  const L: string[] = ['# Ban-row patterns — corrections (2026-11-11)', '']
  const bust = new Set<string>()
  const backup: Record<string, unknown[]> = { fsem: [], wikipedia_list: [], merge: [] }
  const keyTaken = async (b: BanRow, year: number | null) => (await pg.query(
    `select 1 from bans where book_id=$1 and country_code=$2 and scope_id=$3 and id<>$4
       and year_started is not distinct from $5 and region is not distinct from $6 and institution is not distinct from $7 limit 1`,
    [b.book_id, b.country_code, b.scope_id, b.id, year, b.region, b.institution],
  )).rows.length > 0
  const SELECT = `select x.id, x.book_id, k.slug, k.title, k.first_published_year, x.country_code, c.name_en as country, c.slug as country_slug,
      x.scope_id, x.region, x.institution, x.year_started, x.description
    from bans x join books k on k.id=x.book_id join countries c on c.code=x.country_code`

  try {
    if (APPLY) await pg.query('begin')

    // ── A ──
    const inclusion = fsemInclusionDates()
    const fsem = (await pg.query(`${SELECT} where x.description like '%Added to list: 2020-09-04%' order by x.id`)).rows as Array<BanRow & { country_slug: string }>
    let aFixed = 0
    const aSkipped: string[] = []
    const aSamples: string[] = []
    for (const b of fsem) {
      const entry = Number(b.description?.match(/entry #(\d+)/)?.[1])
      const decisionYear = Number(b.description?.match(/от \d{2}\.\d{2}\.(\d{4})/)?.[1]) || null
      const listed = Number.isFinite(entry) ? inclusion.get(entry) ?? null : null
      const year = listed ? Number(listed.slice(0, 4)) : decisionYear
      if (!year) { aSkipped.push(`#${b.id} ${b.slug}: no court-decision date in the note`); continue }
      if (await keyTaken(b, year)) { aSkipped.push(`#${b.id} ${b.slug}: another ban of this book already carries ${year} (a second register entry for the same title)`); continue }
      const note = (b.description ?? '').replace(/\s*Added to list: 2020-09-04\./, listed ? ` Added to list: ${listed}.` : '').replace(/\s{2,}/g, ' ').trim()
      aFixed++
      if (aSamples.length < 8) aSamples.push(`| #${b.id} | ${b.title.slice(0, 50).replace(/\|/g, '/')} | 2020 | ${year} | ${listed ? 'export inclusion date' : 'court decision'} |`)
      if (writes('A')) {
        backup.fsem.push({ id: b.id, year_started: b.year_started, description: b.description })
        bust.add(`/books/${b.slug}`)
        await pg.query(`update bans set year_started=$2, description=$3 where id=$1`, [b.id, year, note])
      }
    }
    console.log(`  A. Russian register: ${fsem.length} rows with the feed date · corrected ${aFixed} · skipped ${aSkipped.length}`)
    L.push('## A. Russian extremist register — feed date taken for a listing date', '',
      `${fsem.length} rows carried year 2020 and "Added to list: 2020-09-04". ${writes('A') ? 'Corrected' : 'To correct'}: **${aFixed}** (year → court decision, or the export's inclusion date; the false sentence removed). Skipped: **${aSkipped.length}**.`, '',
      '| ban | title | was | now | basis |', '|---|---|---|---|---|', ...aSamples, `| … | (${Math.max(0, aFixed - aSamples.length)} more) | | | |`, '')
    if (aSkipped.length) L.push('Skipped:', ...aSkipped.map(s => `- ${s}`), '')

    // ── B ──
    const res = await fetch(WIKI_RAW, { headers: UA })
    if (!res.ok) throw new Error(`Wikipedia wikitext: HTTP ${res.status}`)
    const wiki = parseWikiList(await res.text())
    const cand = (await pg.query(
      `${SELECT}
       where x.year_started is not null
         and exists (select 1 from ban_source_links l join ban_sources s on s.id=l.source_id where l.ban_id=x.id and s.source_url ilike '%List_of_books_banned_by_governments%')
         and not exists (select 1 from ban_source_links l join ban_sources s on s.id=l.source_id where l.ban_id=x.id and s.source_url not ilike '%List_of_books_banned_by_governments%')
       order by x.id`,
    )).rows as Array<BanRow & { country_slug: string }>
    let bFixed = 0
    const bKept = { notFound: 0, yearDiffers: 0, notesGiveYear: 0, ownNote: 0, collision: 0 }
    const bSamples: string[] = []
    const bCollisions: string[] = []
    for (const b of cand) {
      const y = String(b.year_started)
      if (b.description && b.description.includes(y)) { bKept.ownNote++; continue }
      const row = wiki.find(w => sameCountry(b.country, w.country) && sameTitle(b.title, w.title))
      if (!row) { bKept.notFound++; continue }
      // The cell may be "1949", "1955–1988", "1928 (private)": the ban year must be the (first) published year.
      const published = row.yearCell.match(/\d{4}/)?.[0]
      if (published !== y) { bKept.yearDiffers++; continue }
      if (row.notes.includes(y)) { bKept.notesGiveYear++; continue }
      if (await keyTaken(b, null)) { bKept.collision++; bCollisions.push(`#${b.id} ${b.slug} (${b.country})`); continue }
      bFixed++
      if (bSamples.length < 12) bSamples.push(`| #${b.id} | ${b.title.slice(0, 40).replace(/\|/g, '/')} | ${b.country} | ${y} | ${row.yearCell.slice(0, 20)} | ${row.notes.slice(0, 90).replace(/\|/g, '/')} |`)
      if (writes('B')) {
        backup.wikipedia_list.push({ id: b.id, year_started: b.year_started })
        bust.add(`/books/${b.slug}`)
        bust.add(`/countries/${b.country_slug}`)
        await pg.query(`update bans set year_started=null where id=$1`, [b.id])
      }
    }
    console.log(`  B. Wikipedia list: ${cand.length} dated rows with only that source · year cleared ${bFixed} · kept ${JSON.stringify(bKept)}`)
    L.push('## B. Wikipedia "List of books banned by governments" — publication year as ban year', '',
      `${cand.length} dated rows have that list as their only source. ${writes('B') ? 'Year cleared' : 'NOT APPLIED — year that would be cleared'} (it is the list's "Year published", and neither the list's notes nor ours give it as a ban year): **${bFixed}**.`,
      `Kept: ${bKept.yearDiffers} whose year is not the published year · ${bKept.notesGiveYear} where the list's notes state the year · ${bKept.ownNote} where our own note states it · ${bKept.notFound} not found in the wikitext · ${bKept.collision} that would collide with a year-less twin.`, '',
      '| ban | title | country | year cleared | list: Year published | list: Notes |', '|---|---|---|---|---|---|', ...bSamples, `| … | (${Math.max(0, bFixed - bSamples.length)} more) | | | | |`, '')
    if (bCollisions.length) L.push('Would collide, left alone:', ...bCollisions.map(s => `- ${s}`), '')

    // ── C ──
    const pair = (await pg.query(`select id, year_started, status, confidence, description from bans where id in (1003, 26694) order by id`)).rows as Array<{ id: number; year_started: number; status: string; confidence: string; description: string | null }>
    const dup = pair.find(r => Number(r.id) === 1003)
    const keep = pair.find(r => Number(r.id) === 26694)
    if (dup && keep) {
      const penalty = "Possession of the book carries up to three years' imprisonment or a fine of approximately $7,400."
      const note = keep.description?.includes('three years') ? keep.description : `${(keep.description ?? '').trim()} ${penalty}`.trim()
      if (writes('C')) backup.merge.push({ removed: dup, kept_before: keep,
        removed_source_links: (await pg.query(`select * from ban_source_links where ban_id=1003`)).rows,
        removed_reason_links: (await pg.query(`select * from ban_reason_links where ban_id=1003`)).rows })
      console.log('  C. Malaysia duplicate: #1003 folded into #26694')
      L.push('## C. The Satanic Verses, Malaysia — two rows for one ban', '',
        `#1003 (Wikipedia, year 1988, note "Banned March 1989") ${writes('C') ? 'was' : 'is'} folded into #26694 (KDN register, gazetted 30 March 1989): its sources and the sentence on the penalty move to the register row; #1003 ${writes('C') ? 'is removed' : 'will be removed'}.`, '')
      if (writes('C')) {
        bust.add('/books/the-satanic-verses'); bust.add('/countries/malaysia')
        await pg.query(`insert into ban_source_links(ban_id, source_id, locator) select 26694, source_id, locator from ban_source_links where ban_id=1003 on conflict do nothing`)
        await pg.query(`insert into ban_reason_links(ban_id, reason_id, basis) select 26694, reason_id, basis from ban_reason_links where ban_id=1003 on conflict do nothing`)
        await pg.query(`update bans set description=$1, confidence='verified' where id=26694`, [note])
        await pg.query(`delete from bans where id=1003`)
      }
    } else {
      console.log('  C. Malaysia duplicate: already merged')
      L.push('## C. The Satanic Verses, Malaysia — two rows for one ban', '', 'Already merged: only the KDN register row #26694 remains.', '')
    }

    if (APPLY) {
      fs.writeFileSync(path.resolve('data', `ban-row-patterns-backup-2026-11-11${SUFFIX}.json`), JSON.stringify(backup, null, 2) + '\n')
      await pg.query('commit')
      fs.writeFileSync(path.resolve('data', `ban-row-patterns-busted-paths${SUFFIX}.txt`), [...bust].join('\n') + '\n')
    }
    // A finished run finds nothing left to do; keep the report of the run that did the work.
    if (APPLY || aFixed + bFixed > 0 || (dup && keep)) fs.writeFileSync(path.resolve('data', `ban-row-patterns-2026-11-11${SUFFIX}.md`), L.join('\n') + '\n')
    console.log(`\n${APPLY ? 'Applied' : 'DRY-RUN'}: A ${aFixed} · B ${bFixed} · C ${dup && keep ? 1 : 0} · pages to bust ${bust.size}`)
    if (!APPLY) console.log('Report: data/ban-row-patterns-2026-11-11.md — add --apply to write.')
  } catch (e) {
    if (APPLY) await pg.query('rollback').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
