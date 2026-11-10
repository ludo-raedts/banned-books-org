#!/usr/bin/env tsx
// Resolve the pre-existing VA year conflicts that the Index Librorum Prohibitorum
// 1877 import (2026-11-09) surfaced. Root cause: the old VA seed rows came from
// Wikipedia's "List of authors and works on the Index", whose year column is
// per AUTHOR (first inclusion), and the seed stamped that first year onto every
// listed work — giving impossible years (Traité sur la tolérance "1752", published
// 1763) or the year of a sibling work (Julie "1762" = Émile; decree 1806).
// The 1877 Index records the decree per WORK, so it wins; every corrected year
// below is also in the Wikipedia row's own year list unless noted.
//
// Left alone (1-year or edition-level differences, not clearly wrong):
// Swedenborg 1738/1739, Kazantzakis 1954/1955, Balzac 1841/1842,, Esprit des lois 1751/1752, Eriugena 1684/1685,
// Milton Literae 1694/1700, Malebranche morale 1689/1714 (LLM-read decree),
// Conciliatorium 1627/1678, Encyclopédie 1758/1827, Descartes 1663/1722 edition.
//
//   npx tsx --env-file=.env.local scripts/fix-index-1877-year-conflicts.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/fix-index-1877-year-conflicts.ts --apply
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const INDEX_1877_SOURCE = 13482 // archive.org index-librorum-prohibitorum-catholic
const decree = (y: number, extra = '') =>
  `Prohibited by a decree of ${y}${extra}, as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition).`

// ban id → corrected year (from: old year)
const YEARS: { ban: number; from: number; to: number; extra?: string; note: string }[] = [
  { ban: 5087, from: 1959, to: 1834, note: 'Hugo, Notre-Dame de Paris — 1959 was the "until 1959" end date' },
  { ban: 5089, from: 1751, to: 1761, note: 'Montesquieu, Lettres persanes — 1751 belongs to Esprit des lois' },
  { ban: 5097, from: 1752, to: 1766, note: 'Voltaire, Traité sur la tolérance — published 1763' },
  { ban: 5117, from: 1758, to: 1804, note: 'Diderot, Jacques le fataliste — published 1796' },
  { ban: 5118, from: 1626, to: 1658, note: 'Grotius, De imperio — published 1647 (French translation 1753 stays a separate ban)' },
  { ban: 5125, from: 1626, to: 1661, note: 'Grotius, Annales — published 1657; 1661 per 1877 Index only' },
  { ban: 5136, from: 1759, to: 1774, note: "Helvétius, De l'homme — published 1773; 1759 belongs to De l'esprit" },
  { ban: 5153, from: 1762, to: 1806, note: 'Rousseau, Julie — 1762 belongs to Émile' },
  { ban: 5233, from: 1694, to: 1732, extra: " (Paolo Rolli's Italian translation)", note: 'Milton, Paradise Lost — 1694 belongs to Literae pseudo-senatus' },
  { ban: 5147, from: 1657, to: 1789, extra: " (edition with notes by Voltaire)", note: 'Pascal, Pensées w/ Voltaire notes — 1657 belongs to Lettres provinciales' },
]

// Wrong first_published_year (a modern edition's year) that made a ban predate its book.
const PUB_YEARS: { book: number; from: number; to: number; note: string }[] = [
  { book: 6573, from: 1677, to: 1647, note: 'Grotius, De imperio (pub. 1647 per the cited list)' },
  { book: 6659, from: 2007, to: 1677, note: 'Spinoza, Posthumous works (Opera posthuma 1677)' },
  { book: 6669, from: 1958, to: 1680, note: 'Malebranche, Traité de la nature et de la grâce (1680 per the cited list)' },
  { book: 6693, from: 1857, to: 1833, note: 'Heine, De la France (1833)' },
]

// Unsupported duplicate ban → the 1877-sourced ban of the same work. Reasons are
// unioned; sources only when they support the event (unionSources).
const MERGES: { drop: number; keep: number; unionSources: boolean; note: string }[] = [
  { drop: 4742, keep: 51305, unionSources: true, note: 'Locke, Essay — "1703" not in its cited list (which gives 1734, 1737)' },
  { drop: 888, keep: 53817, unionSources: false, note: 'Stendhal, Le Rouge et le Noir — "1841" not in its cited page' },
]

// "John Calvin" #6609 is the jurist Johannes Calvinus (Johann Kahl), per the cited list itself.
const KAHL = { book: 6609, wrongAuthor: 4739, name: 'Johann Kahl', slug: 'johann-kahl', birth: 1550, death: 1614, wikidata: 'Q59530933' }

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)
  await pg.query(APPLY ? 'begin' : 'begin read only')
  try {
    for (const y of YEARS) {
      const b = (await pg.query("select year_started, description from bans where id=$1 and country_code='VA'", [y.ban])).rows[0]
      if (!b) { console.log(`  ∅ ban ${y.ban} gone`); continue }
      if (b.year_started !== y.from) { console.log(`  = ban ${y.ban} is ${b.year_started} (expected ${y.from}) — skip`); continue }
      console.log(`  ban ${y.ban}: ${y.from} → ${y.to}  ${y.note}`)
      if (APPLY) {
        await pg.query('update bans set year_started=$1, description=coalesce(description,$2) where id=$3', [y.to, decree(y.to, y.extra), y.ban])
        await pg.query('insert into ban_source_links(ban_id,source_id) values($1,$2) on conflict do nothing', [y.ban, INDEX_1877_SOURCE])
      }
    }
    for (const p of PUB_YEARS) {
      const b = (await pg.query('select first_published_year fpy from books where id=$1', [p.book])).rows[0]
      if (b?.fpy !== p.from) { console.log(`  = book ${p.book} fpy ${b?.fpy} (expected ${p.from}) — skip`); continue }
      console.log(`  book ${p.book} fpy: ${p.from} → ${p.to}  ${p.note}`)
      if (APPLY) await pg.query('update books set first_published_year=$1 where id=$2', [p.to, p.book])
    }
    for (const m of MERGES) {
      const d = (await pg.query('select book_id from bans where id=$1', [m.drop])).rows[0]
      const k = (await pg.query('select book_id from bans where id=$1', [m.keep])).rows[0]
      if (!d) { console.log(`  ∅ ban ${m.drop} gone`); continue }
      if (!k || k.book_id !== d.book_id) throw new Error(`ban ${m.keep} missing or other book`)
      console.log(`  merge ban ${m.drop} → ${m.keep}  ${m.note}`)
      if (APPLY) {
        await pg.query('insert into ban_reason_links(ban_id,reason_id,basis) select $1,reason_id,basis from ban_reason_links where ban_id=$2 on conflict do nothing', [m.keep, m.drop])
        if (m.unionSources) await pg.query('insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing', [m.keep, m.drop])
        await pg.query('delete from bans where id=$1', [m.drop])
      }
    }
    const linked = (await pg.query('select 1 from book_authors where book_id=$1 and author_id=$2', [KAHL.book, KAHL.wrongAuthor])).rowCount
    if (linked) {
      const existing = (await pg.query('select id from authors where slug=$1', [KAHL.slug])).rows[0]
      console.log(`  book ${KAHL.book}: John Calvin → ${KAHL.name}${existing ? ` (existing #${existing.id})` : ' (new author)'}`)
      if (APPLY) {
        const id = existing?.id ?? (await pg.query(
          'insert into authors(display_name, slug, birth_year, death_year, wikidata_id) values($1,$2,$3,$4,$5) returning id',
          [KAHL.name, KAHL.slug, KAHL.birth, KAHL.death, KAHL.wikidata])).rows[0].id
        await pg.query('update book_authors set author_id=$1 where book_id=$2 and author_id=$3', [id, KAHL.book, KAHL.wrongAuthor])
      }
    } else console.log(`  ∅ book ${KAHL.book} no longer under John Calvin`)
    await pg.query(APPLY ? 'commit' : 'rollback')
  } catch (e) {
    await pg.query('rollback')
    throw e
  }
  await pg.end()
  console.log(APPLY ? '\nApplied.' : '\nDry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
