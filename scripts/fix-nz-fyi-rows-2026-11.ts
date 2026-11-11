/**
 * New Zealand rows that cite the Classification Office's information release
 * (fyi.org.nz request 14169) — checked against that release (2026-11-11).
 *
 * 49 ban rows cited "FYI.org.nz - New Zealand Official Information" as their
 * source, and 38 of them carried the note "Classified as objectionable under
 * the New Zealand Indecent Publications Act 1963…" — also on bans dated 1886
 * to 1942, decades before that Act.
 *
 * The release is two spreadsheets from the Office of Film and Literature
 * Classification (19 November 2020): "IPT banned books 1964 1994" (1,215
 * titles banned by the Indecent Publications Tribunal, with a column that
 * says when a ban is no longer in force) and "OFLC Banned books to 19 November
 * 2020" (96 titles). Both were read row by row.
 *
 *   - 19 of the 49 titles are in those registers. For 17 the source is right
 *     and the row now says what the register says: the register number and
 *     the date the decision was registered (as the source locator), and for
 *     Tribunal bans a note and the status the register gives — none of these
 *     has a later classification, so the ban is in force. The Perfumed Garden
 *     carried its publication year (1886); the Tribunal's decision is of 1981.
 *     Two are left alone (see LEADS): their year differs from the register's.
 *   - 30 are NOT in the registers, and could not be: they are Customs,
 *     court and wartime bans from before the Tribunal, or Tribunal-era titles
 *     the Office does not list as banned. All 30 are rows of Wikipedia's "List
 *     of books banned in New Zealand", which is where the import took them.
 *     The false source link is replaced by that list (by section) and the
 *     false note is removed. Four of them carried the list's "published" year
 *     where the list gives no year of banning: cleared.
 *   - American Psycho: the Tribunal gave it an R18 classification in 1991
 *     (University of Otago exhibition); it is not on the Office's list of
 *     banned books. banned → restricted.
 *
 * No row is deleted. Dry-run by default.
 *   npx tsx --env-file=.env.local scripts/fix-nz-fyi-rows-2026-11.ts
 *   npx tsx --env-file=.env.local scripts/fix-nz-fyi-rows-2026-11.ts --apply
 * Report: data/nz-fyi-rows-2026-11-11.md · backup on --apply: data/nz-fyi-rows-backup-2026-11-11.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const FYI_SOURCE_ID = 617
const TEMPLATE_PREFIX = 'Classified as objectionable under the New Zealand Indecent Publications Act 1963'

// Wikipedia "List of books banned in New Zealand", one ban_sources row per section.
const WIKI = { pre: 917, ww1: 922, ww2: 1071, ipt: 923 } as const

/** In the official registers: [ban id, register number, decision registered, body, new year or null]. */
const IN_REGISTER: Array<{ id: number; title: string; no: string; date: string; body: 'IPT' | 'OFLC'; year?: number; keepNote?: boolean }> = [
  { id: 1220, title: 'The Perfumed Garden', no: 'IPT 80-983', date: '1981-03-18', body: 'IPT', year: 1981 },
  { id: 1241, title: 'John and Mimi', no: 'IPT 75-833', date: '1975-02-05', body: 'IPT' },
  { id: 1240, title: 'Snatches and Lays', no: 'IPT 75-849', date: '1975-11-07', body: 'IPT' },
  { id: 1236, title: "Marijuana Grower's Guide", no: 'IPT 78-904', date: '1978-09-29', body: 'IPT' },
  { id: 1242, title: 'Joy', no: 'IPT 87-18', date: '1987-11-04', body: 'IPT' },
  { id: 1243, title: 'The World of the American Pit Bull Terrier', no: 'IPT 91-5', date: '1991-04-16', body: 'IPT' },
  { id: 1244, title: 'Click', no: 'IPT 91-6', date: '1991-04-30', body: 'IPT' },
  { id: 1245, title: 'Boobytraps', no: 'IPT 91-23', date: '1991-06-26', body: 'IPT' },
  { id: 595, title: 'The Anarchist Cookbook', no: 'IPT 94-115', date: '1994-11-25', body: 'IPT', keepNote: true },
  { id: 1246, title: 'Diva Obsexion', no: '9400568', date: '1995-11-21', body: 'OFLC' },
  { id: 1248, title: 'Behind Closed Doors', no: '9501102', date: '1996-03-18', body: 'OFLC' },
  { id: 1249, title: 'The Seventh Acolyte Reader', no: '9501602', date: '1996-10-16', body: 'OFLC' },
  { id: 1250, title: 'Holiday Snapshots', no: '9901504', date: '2000-03-16', body: 'OFLC' },
  { id: 1251, title: 'Opium for the Masses', no: '200768', date: '2002-07-09', body: 'OFLC' },
  { id: 1252, title: 'Psilocybin Mushrooms of the World', no: '200767', date: '2002-07-09', body: 'OFLC' },
  { id: 1253, title: 'The Big Book of Buds', no: '200772', date: '2002-07-09', body: 'OFLC' },
  { id: 1254, title: 'Advanced Techniques of Clandestine Psychedelic & Amphetamine Manufacture', no: '201888', date: '2003-03-21', body: 'OFLC' },
]

/** Not in the registers: rows of the Wikipedia list. clearYear = the list gives only a year published. */
const FROM_WIKIPEDIA: Array<{ id: number; section: keyof typeof WIKI; clearYear?: boolean }> = [
  { id: 1207, section: 'pre' }, { id: 1219, section: 'pre', clearYear: true }, { id: 1218, section: 'pre' },
  { id: 1216, section: 'pre' }, { id: 1217, section: 'pre' }, { id: 1221, section: 'pre', clearYear: true },
  { id: 1208, section: 'pre', clearYear: true }, { id: 1213, section: 'pre' }, { id: 1223, section: 'pre' },
  { id: 1224, section: 'pre' }, { id: 1222, section: 'pre' }, { id: 1225, section: 'pre' },
  { id: 1227, section: 'pre' }, { id: 1228, section: 'pre' }, { id: 1211, section: 'pre', clearYear: true },
  { id: 1230, section: 'pre' }, { id: 1209, section: 'pre' }, { id: 1229, section: 'pre' },
  { id: 1210, section: 'pre' }, { id: 1226, section: 'pre' },
  { id: 1231, section: 'ww1' },
  { id: 1235, section: 'ww2' }, { id: 1232, section: 'ww2' }, { id: 1212, section: 'ww2' },
  { id: 1234, section: 'ww2' }, { id: 1233, section: 'ww2' },
  { id: 1237, section: 'ipt' }, { id: 1239, section: 'ipt' }, { id: 1238, section: 'ipt' }, { id: 1214, section: 'ipt' },
]

const AMERICAN_PSYCHO = {
  id: 1214,
  note: 'In 1991 the Indecent Publications Tribunal gave the novel an R18 classification, with the condition that it be labelled with the age restriction. It is not on the Classification Office\'s list of books banned by the Tribunal.',
  source: {
    source_name: 'University of Otago Library — Banned Books exhibition',
    source_url: 'https://www.otago.ac.nz/library/exhibitions/bannedbooks/',
    source_type: 'academic',
  },
}

const LEADS = [
  'The Great Big Narcotics Cookbook (#1247): our row says 1995, as Wikipedia does; the Office\'s register shows a decision registered on 6 March 2018 (no. 1800003). Left alone.',
  'The Peaceful Pill Handbook (#1115): our row and note say 2008; the register shows a decision registered on 8 June 2007 (no. 700240), which a Scoop report of June 2007 confirms. The row has four sources and a note on 2008; left for a reader.',
  'Nana (#1207): the row records the 1890 Magistrate\'s Court ban. The register also has a Tribunal decision on Nana registered 18 March 1981 (IPT 80-984): a second ban we do not hold.',
  'The Joy of Sex (#1237), More Joy of Sex (#1238), Intimate Embrace (#1239): Wikipedia lists them under the Tribunal; none is on the Office\'s list of banned books. Probably restricted, not banned — no second source yet.',
  'Soviet Foreign Policy (#1232): Wikipedia says "withheld and held for decision by a higher authority", not banned.',
  'The Communist Manifesto (#1212): Wikipedia gives "−1942" (until 1942); our row has 1942 as the start.',
  'Falsehood in War-Time (#1235): Wikipedia says banned in May 1941; our row says 1940.',
  'La Vie Parisienne (#1225) is a magazine, outside the archive\'s scope.',
  'The Tribunal\'s register holds 1,215 banned titles and the Office\'s 96; the archive has 19 of them. An official, complete source for a later import.',
]

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── fix-nz-fyi-rows-2026-11 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  const L: string[] = ['# New Zealand rows citing the Classification Office release — corrections (2026-11-11)', '']
  try {
    const ids = [...IN_REGISTER.map(r => r.id), ...FROM_WIKIPEDIA.map(r => r.id)]
    const rows = (await pg.query(
      `select x.id, x.book_id, k.slug, k.title, x.year_started, x.status, x.action_type, x.description, x.scope_id, x.region, x.institution,
              exists (select 1 from ban_source_links l where l.ban_id=x.id and l.source_id=$2) as has_fyi,
              (select l.locator from ban_source_links l where l.ban_id=x.id and l.source_id=$2) as fyi_locator
       from bans x join books k on k.id=x.book_id where x.id = any($1::bigint[])`, [ids, FYI_SOURCE_ID],
    )).rows as Array<{ id: string; book_id: string; slug: string; title: string; year_started: number | null; status: string; action_type: string; description: string | null; scope_id: string; region: string | null; institution: string | null; has_fyi: boolean; fyi_locator: string | null }>
    const byId = new Map(rows.map(r => [Number(r.id), r]))
    const backup: unknown[] = []
    const bust = new Set<string>(['/countries/new-zealand'])
    const tally = { locator: 0, note: 0, status: 0, year: 0, resourced: 0, noteRemoved: 0, yearCleared: 0, action: 0 }
    if (APPLY) await pg.query('begin')

    L.push('## In the official registers — source kept, row brought in line', '', '| ban | title | register | decision registered | change |', '|---|---|---|---|---|')
    for (const r of IN_REGISTER) {
      const row = byId.get(r.id)
      if (!row || !row.has_fyi || row.fyi_locator) { console.log(`  · #${r.id} ${r.title}: already done or no longer cites the release`); continue }
      const locator = `${r.body === 'IPT' ? 'IPT banned books 1964–1994' : 'OFLC banned books to 19 November 2020'}: no. ${r.no}, decision registered ${r.date}`
      const changes: string[] = ['locator']
      const set: Record<string, unknown> = {}
      if (r.body === 'IPT' && !r.keepNote) {
        set.description = `Banned by the Indecent Publications Tribunal; the decision was registered on ${r.date} (${r.no}). The Classification Office's list of books banned by the Tribunal, released in November 2020, records no later classification: the ban is in force.`
        changes.push('note'); tally.note++
        if (row.status !== 'active') { set.status = 'active'; changes.push(`status ${row.status} → active`); tally.status++ }
      }
      if (r.year && row.year_started !== r.year) { set.year_started = r.year; changes.push(`year ${row.year_started} → ${r.year}`); tally.year++ }
      tally.locator++
      L.push(`| #${r.id} | ${r.title} | ${r.no} | ${r.date} | ${changes.join(' · ')} |`)
      backup.push({ kind: 'in_register', id: r.id, before: { year_started: row.year_started, status: row.status, description: row.description } })
      bust.add(`/books/${row.slug}`)
      if (APPLY) {
        const keys = Object.keys(set)
        if (keys.length) await pg.query(`update bans set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [r.id, ...keys.map(k => set[k])])
        await pg.query(`update ban_source_links set locator=$2 where ban_id=$1 and source_id=$3`, [r.id, locator, FYI_SOURCE_ID])
      }
    }
    L.push('')

    L.push('## Not in the registers — rows of Wikipedia\'s list, wrongly attributed', '', '| ban | title | section of the list | change |', '|---|---|---|---|')
    for (const w of FROM_WIKIPEDIA) {
      const row = byId.get(w.id)
      if (!row || !row.has_fyi) { console.log(`  · #${w.id}: already done or no longer cites the release`); continue }
      const changes: string[] = ['source: release → Wikipedia list']
      const set: Record<string, unknown> = {}
      if (row.description?.startsWith(TEMPLATE_PREFIX)) { set.description = null; changes.push('false note removed'); tally.noteRemoved++ }
      if (w.clearYear && row.year_started != null) {
        const taken = (await pg.query(
          `select 1 from bans where book_id=$1 and country_code='NZ' and scope_id=$2 and id<>$3 and year_started is null
             and region is not distinct from $4 and institution is not distinct from $5 limit 1`,
          [row.book_id, row.scope_id, w.id, row.region, row.institution])).rows.length > 0
        if (!taken) { set.year_started = null; changes.push(`year ${row.year_started} cleared (the list gives only the year published)`); tally.yearCleared++ }
      }
      if (w.id === AMERICAN_PSYCHO.id) { set.action_type = 'restricted'; set.description = AMERICAN_PSYCHO.note; changes.push('banned → restricted (R18)'); tally.action++ }
      tally.resourced++
      L.push(`| #${w.id} | ${row.title.slice(0, 50)} | ${w.section} | ${changes.join(' · ')} |`)
      backup.push({ kind: 'from_wikipedia', id: w.id, before: { year_started: row.year_started, action_type: row.action_type, description: row.description, source_id: FYI_SOURCE_ID } })
      bust.add(`/books/${row.slug}`)
      if (APPLY) {
        const keys = Object.keys(set)
        if (keys.length) await pg.query(`update bans set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [w.id, ...keys.map(k => set[k])])
        await pg.query(`insert into ban_source_links(ban_id, source_id, locator) values($1,$2,null) on conflict do nothing`, [w.id, WIKI[w.section]])
        await pg.query(`delete from ban_source_links where ban_id=$1 and source_id=$2`, [w.id, FYI_SOURCE_ID])
        if (w.id === AMERICAN_PSYCHO.id) {
          const s = AMERICAN_PSYCHO.source
          const sid = (await pg.query(
            `insert into ban_sources(source_name, source_url, source_type, accessed_at, verification_status) values($1,$2,$3,'2026-11-11','verified')
             on conflict (source_url) do update set accessed_at=excluded.accessed_at returning id`, [s.source_name, s.source_url, s.source_type])).rows[0].id
          await pg.query(`insert into ban_source_links(ban_id, source_id, locator) values($1,$2,'correction 2026-11-11') on conflict do nothing`, [w.id, sid])
        }
      }
    }
    L.push('', '## Left alone, for a reader', '', ...LEADS.map(l => `- ${l}`), '')
    L.unshift(`Summary: ${tally.locator} rows keep the release as source and gain its register number and date (${tally.note} notes rewritten from the register, ${tally.status} set to active, ${tally.year} year corrected); ${tally.resourced} rows re-attributed to Wikipedia's list (${tally.noteRemoved} false notes removed, ${tally.yearCleared} years cleared, ${tally.action} action type corrected).`, '')
    L.unshift('# New Zealand rows citing the Classification Office release — corrections (2026-11-11)', '')
    L.splice(4, 2)

    console.log(`  ${JSON.stringify(tally)}`)
    if (APPLY) {
      fs.writeFileSync(path.resolve('data', 'nz-fyi-rows-backup-2026-11-11.json'), JSON.stringify(backup, null, 2) + '\n')
      await pg.query('commit')
      fs.writeFileSync(path.resolve('data', 'nz-fyi-rows-busted-paths.txt'), [...bust].join('\n') + '\n')
    }
    const backupPath = path.resolve('data', 'nz-fyi-rows-backup-2026-11-11.json')
    if (!APPLY && tally.locator + tally.resourced === 0 && fs.existsSync(backupPath)) {
      // Everything is applied: rebuild the report from the backup (before) and the database (after).
      const before = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as Array<{ kind: string; id: number; before: Record<string, unknown> }>
      const now = (await pg.query(
        `select x.id, k.title, x.year_started, x.status, x.action_type, x.description,
                (select string_agg(coalesce(s.source_name,'') || coalesce(' [' || l.locator || ']', ''), ' · ') from ban_source_links l join ban_sources s on s.id=l.source_id where l.ban_id=x.id) as sources
         from bans x join books k on k.id=x.book_id where x.id = any($1::bigint[])`, [before.map(b => b.id)],
      )).rows as Array<Record<string, unknown>>
      const cur = new Map(now.map(r => [Number(r.id), r]))
      const R: string[] = ['# New Zealand rows citing the Classification Office release — corrections applied (2026-11-11)', '',
        `${before.filter(b => b.kind === 'in_register').length} rows keep the release as their source and now carry its register number and decision date; ${before.filter(b => b.kind === 'from_wikipedia').length} rows were re-attributed to Wikipedia's "List of books banned in New Zealand". No row was deleted.`, '']
      for (const kind of ['in_register', 'from_wikipedia'] as const) {
        R.push(kind === 'in_register' ? '## In the official registers — source kept, row brought in line' : "## Not in the registers — rows of Wikipedia's list, wrongly attributed", '',
          '| ban | title | field | before | after |', '|---|---|---|---|---|')
        for (const b of before.filter(x => x.kind === kind)) {
          const c = cur.get(b.id)
          if (!c) continue
          const cell = (v: unknown) => String(v ?? '—').replace(/\|/g, '/').slice(0, 150)
          let first = true
          for (const f of ['year_started', 'status', 'action_type', 'description'] as const) {
            if (!(f in b.before) || (b.before[f] ?? null) === (c[f] ?? null)) continue
            R.push(`| ${first ? `#${b.id}` : ''} | ${first ? cell(c.title).slice(0, 44) : ''} | ${f} | ${cell(b.before[f])} | ${cell(c[f])} |`)
            first = false
          }
          R.push(`| ${first ? `#${b.id}` : ''} | ${first ? cell(c.title).slice(0, 44) : ''} | sources | ${kind === 'from_wikipedia' ? 'FYI.org.nz - New Zealand Official Information' : 'FYI.org.nz (no locator)'} | ${cell(c.sources)} |`)
        }
        R.push('')
      }
      R.push('## Left alone, for a reader', '', ...LEADS.map(l => `- ${l}`), '')
      fs.writeFileSync(path.resolve('data', 'nz-fyi-rows-2026-11-11.md'), R.join('\n') + '\n')
      console.log('  report rebuilt from the backup and the current rows')
    } else if (APPLY || tally.locator + tally.resourced > 0) fs.writeFileSync(path.resolve('data', 'nz-fyi-rows-2026-11-11.md'), L.join('\n') + '\n')
    console.log(APPLY ? `\nApplied. Pages to bust: ${bust.size}` : '\nDRY-RUN — report: data/nz-fyi-rows-2026-11-11.md — add --apply to write.')
  } catch (e) {
    if (APPLY) await pg.query('rollback').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
