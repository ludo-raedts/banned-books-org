#!/usr/bin/env tsx
// Correct wrong author attributions from the Index Librorum Prohibitorum 1877
// import (2026-11-09). The LLM cleanup "recognised" a person for entries whose
// printed headword is a pseudonym, a title word or another author's group, and
// the headword guard only demoted its confidence — the invented name was still
// imported ("Tindalus alias Hitchins" → the physicist John Tyndall, "Caroli
// Magni opus" → Maximus the Confessor, Volney's Ruines under d'Holbach).
// Every row below was checked by hand against the raw Index text
// (data/index-1877/stage1-2026-11-09.json); 375 flagged names were reviewed,
// the rest are correct (OCR-garbled surname or a well-known pseudonym).
//
// Ops, all in ONE transaction:
//   RENAMES   author gets the printed / correctly identified name; its slug
//             follows (no alias: the old slug names the wrong person) and the Wikipedia fields are
//             cleared, since they described the wrongly identified person.
//             If the new name already exists as an author, the row is MERGED
//             into it instead.
//   MOVES     a book goes to another author (existing id, a name that is
//             found-or-created, or Anonymous #33).
//   MERGES    duplicate author rows folded into the canonical one.
//   Blanket "<Author> — All works" titles are re-derived for every touched
//   author; authors left without books are deleted.
//
//   npx tsx --env-file=.env.local scripts/fix-index-1877-author-attributions.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/fix-index-1877-author-attributions.ts --apply
import type { Client } from 'pg'
import { slugify } from '../src/lib/imports/slugify'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const ANONYMOUS = 33

const RENAMES: { id: number; name: string }[] = [
  { id: 25730, name: 'Ioannes Leo Nannius' },
  { id: 25889, name: 'Peter le Page Renouf' },
  { id: 26213, name: 'Hercule Rasiel de Selva' },
  { id: 26260, name: 'Honoratus Reggius' },
  { id: 26726, name: 'Philander von Sittewald' },
  { id: 22852, name: 'Vincenzo Albarella' },
  { id: 23089, name: 'Arcangela Tarabotti' },
  { id: 23820, name: 'Bernard Connor' },
  { id: 23951, name: 'Benjamin de Daillon' },
  { id: 23993, name: 'Paul Deltuf' },
  { id: 24481, name: 'Ioannes Fuchs' },
  { id: 24711, name: 'Iodocus Harchius' },
  { id: 24874, name: 'Juan Huarte de San Juan' },
  { id: 24879, name: 'Jacobus Hugo' },
  { id: 25189, name: 'Thomas Leonardi' },
  { id: 25288, name: 'Philipp van Limborch' },
  { id: 25500, name: 'Jacques Matter' },
  { id: 25516, name: 'Beda Mayr' },
  { id: 25518, name: 'Nicolas Mazure' },
  { id: 25524, name: 'Miguel de Medina' },
  { id: 25564, name: 'Andrés Mendo' },
  { id: 25652, name: 'Adolphe Monod' },
  { id: 25712, name: 'Willem van der Muelen' },
  { id: 26014, name: 'Giacomo Picenino' },
  { id: 26123, name: 'Silvester Prierias' },
  { id: 26416, name: 'Anne de La Roche-Guilhem' },
  { id: 26667, name: 'Bruno Seidel' },
  { id: 26925, name: 'Guilielmus Taylour' },
  { id: 26963, name: 'Herbert Thorndike' },
  { id: 27106, name: 'Giulio Cesare Vanini' },
  { id: 27137, name: 'Jean du Vergier de Hauranne' },
  { id: 27312, name: 'Hieronymus Wolf' },
  { id: 27281, name: 'Daniel Whitby' },
  { id: 24263, name: 'Aegidius Estrix' },
  { id: 24388, name: 'Valentinus Fidlerus' },
  { id: 24439, name: 'Edmund S. Ffoulkes' },
  { id: 23517, name: 'Charlemagne' },
  { id: 23409, name: 'Stephanus Junius Brutus' },
  { id: 23340, name: 'Marie-Nicolas Bouillet' },
  { id: 23906, name: 'Cornelius a Craneberch' },
  { id: 24092, name: 'Johann Dölsch' },
  { id: 24415, name: 'Cunmannus Flinsbachius' },
  { id: 26976, name: 'William Tyndale' }, // exists (#11761) → merged
]

const MOVES: { book: number; from: number; to: number | string; note: string }[] = [
  { book: 28428, from: 22895, to: 'Jean-Jacques Altmeyer', note: 'Introduction à l\'étude philosophique de l\'humanité (OCR merged Altmeyer into Alting)' },
  { book: 29946, from: 24411, to: 'Jean-Baptiste Lamé-Fleury', note: 'Histoire moderne racontée aux enfants (Lamé Fleury, not Claude Fleury)' },
  { book: 29757, from: 24225, to: 4823, note: 'De divisione naturae → Eriugena (merged with #6664 in the book script)' },
  { book: 29898, from: 24366, to: 'John Fell', note: 'Cypriani opera, ed. John Fell, bishop of Oxford' },
  { book: 32753, from: 23652, to: 'Constantin-François Volney', note: 'Le rovine (Volney, not d\'Holbach)' },
  { book: 32754, from: 23652, to: 'Constantin-François Volney', note: 'Recherches nouvelles sur l\'histoire ancienne (Volney)' },
  { book: 30423, from: 23906, to: 'Gummarus Huygens', note: 'Compendium theologiae (Huygens theses, 1691)' },
  { book: 30245, from: 24092, to: 'Johannes Drusius', note: 'Opera varia (Drusius, decree 1739)' },
  { book: 30246, from: 24092, to: 'Johannes Drusius', note: 'Commentarius in Novum Testamentum (Drusius, 1742)' },
  { book: 29162, from: 4698, to: 25587, note: 'Histoire naturelle de l\'âme → La Mettrie (printed "Harp Mr.")' },
  { book: 31410, from: 4698, to: ANONYMOUS, note: 'Ouvrages philosophiques… (anonymous collection, not Helvétius)' },
  { book: 31411, from: 4698, to: ANONYMOUS, note: 'Sermon des cinquante (anonymous, not Helvétius)' },
  { book: 30779, from: 25247, to: 23148, note: 'Lettres nouvelles de l\'auteur de la critique générale… → Pierre Bayle' },
  { book: 29061, from: 23529, to: ANONYMOUS, note: 'Carta al papa Pio VII, published under Talleyrand\'s name' },
  { book: 31538, from: 26006, to: ANONYMOUS, note: 'Du pape (1863; not Lacordaire, †1861)' },
  { book: 28733, from: 23201, to: ANONYMOUS, note: 'Lettre à un docteur de Sorbonne (anonymous)' },
]

const MERGES: { keep: number; drop: number; note: string }[] = [
  { keep: 4784, drop: 25204, note: 'Gregorio Leti ← "Gregorius de Valentia" (printed "Leti Greg. Opera omnia")' },
  { keep: 592, drop: 26817, note: 'Stendhal ← "Stendhal (Henri Beyle)"' },
]

const BIO_FIELDS = ['bio', 'bio_source_url', 'bio_source_type', 'birth_year', 'death_year', 'birth_country', 'photo_url']

async function authorBySlug(pg: Client, slug: string): Promise<number | null> {
  const a = await pg.query('select id from authors where slug=$1', [slug])
  if (a.rows[0]) return Number(a.rows[0].id)
  const al = await pg.query('select author_id from author_slug_aliases where slug=$1', [slug])
  return al.rows[0] ? Number(al.rows[0].author_id) : null
}

async function getOrCreate(pg: Client, name: string): Promise<number> {
  const slug = slugify(name)
  const found = await authorBySlug(pg, slug)
  if (found) return found
  console.log(`  + create author "${name}" (${slug})`)
  if (!APPLY) return -1
  return Number((await pg.query('insert into authors(display_name, slug) values($1,$2) returning id', [name, slug])).rows[0].id)
}

async function mergeAuthor(pg: Client, keep: number, drop: number) {
  const d = (await pg.query('select slug from authors where id=$1', [drop])).rows[0]
  if (!d) { console.log(`  ∅ #${drop} already gone`); return }
  console.log(`  merge #${drop} (${d.slug}) → #${keep}`)
  if (!APPLY) return
  await pg.query(`delete from book_authors ba where ba.author_id=$2
                    and exists(select 1 from book_authors k where k.author_id=$1 and k.book_id=ba.book_id)`, [keep, drop])
  await pg.query('update book_authors set author_id=$1 where author_id=$2', [keep, drop])
  await pg.query('update author_slug_aliases set author_id=$1 where author_id=$2', [keep, drop])
  await pg.query('delete from authors where id=$1', [drop])
  await pg.query(`insert into author_slug_aliases(slug,author_id,source) values($1,$2,'merge') on conflict(slug) do update set author_id=excluded.author_id`, [d.slug, keep])
}

async function moveBook(pg: Client, book: number, from: number, to: number) {
  if (!APPLY) return
  const dup = await pg.query('select 1 from book_authors where book_id=$1 and author_id=$2', [book, to])
  if (dup.rowCount) await pg.query('delete from book_authors where book_id=$1 and author_id=$2', [book, from])
  else await pg.query('update book_authors set author_id=$1 where book_id=$2 and author_id=$3', [to, book, from])
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  await pg.query(APPLY ? 'begin' : 'begin read only')
  const touched = new Set<number>()
  try {
    console.log('── renames')
    for (const r of RENAMES) {
      const a = (await pg.query('select id, display_name, slug from authors where id=$1', [r.id])).rows[0]
      if (!a) { console.log(`  ∅ #${r.id} gone`); continue }
      if (a.display_name === r.name) { console.log(`  = #${r.id} already "${r.name}"`); continue }
      const slug = slugify(r.name)
      const other = await authorBySlug(pg, slug)
      if (other && other !== r.id) {
        console.log(`  "${a.display_name}" #${r.id} → existing "${r.name}" #${other}`)
        await mergeAuthor(pg, other, r.id)
        touched.add(other)
        continue
      }
      console.log(`  "${a.display_name}" → "${r.name}" (${a.slug} → ${slug}); clear Wikipedia fields`)
      touched.add(r.id)
      // No alias for the old slug: it names the WRONG person (/authors/francisco-de-quevedo
      // must not redirect to Philander von Sittewald, and must stay free for the real one).
      // These slugs were minted by the same day's import, so nothing links to them yet.
      if (APPLY) {
        await pg.query(`update authors set display_name=$1, slug=$2, ${BIO_FIELDS.map(f => `${f}=null`).join(', ')} where id=$3`, [r.name, slug, r.id])
      }
    }

    console.log('── moves')
    const emptied = new Set<number>()
    for (const m of MOVES) {
      const to = typeof m.to === 'number' ? m.to : await getOrCreate(pg, m.to)
      console.log(`  book ${m.book}: #${m.from} → ${typeof m.to === 'number' ? `#${m.to}` : `"${m.to}"`} — ${m.note}`)
      await moveBook(pg, m.book, m.from, to)
      emptied.add(m.from)
      if (to !== ANONYMOUS) touched.add(to)
    }

    console.log('── merges')
    for (const m of MERGES) { console.log(`  ${m.note}`); await mergeAuthor(pg, m.keep, m.drop); touched.add(m.keep) }

    console.log('── blanket titles')
    for (const id of touched) {
      const a = (await pg.query('select display_name from authors where id=$1', [id])).rows[0]
      if (!a) continue
      const bl = await pg.query(`select bk.id, bk.title, bk.slug from books bk join book_authors ba on ba.book_id=bk.id
                                   where ba.author_id=$1 and bk.is_blanket_works and bk.title like '% — All works'`, [id])
      for (const b of bl.rows) {
        const title = `${a.display_name} — All works`
        if (b.title === title) continue
        const slug = slugify(title)
        const taken = (await pg.query('select id from books where slug=$1 and id<>$2', [slug, b.id])).rows[0]
        console.log(`  book ${b.id}: "${b.title}" → "${title}"${taken ? ' (slug kept: taken)' : ''}`)
        if (APPLY) {
          await pg.query('update books set title=$1, slug=$2 where id=$3', [title, taken ? b.slug : slug, b.id])
          if (!taken && b.slug !== slug) await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [b.slug, b.id])
        }
      }
    }

    console.log('── authors left without books')
    for (const id of emptied) {
      const n = (await pg.query('select count(*)::int n from book_authors where author_id=$1', [id])).rows[0].n
      const a = (await pg.query('select display_name from authors where id=$1', [id])).rows[0]
      if (a && n === 0 && APPLY) { await pg.query('delete from authors where id=$1', [id]); console.log(`  delete #${id} ${a.display_name}`) }
      else if (a && n === 0) console.log(`  (would be empty after moves) #${id} ${a.display_name}`)
    }
    await pg.query(APPLY ? 'commit' : 'rollback')
  } catch (e) {
    await pg.query('rollback')
    throw e
  } finally {
    await pg.end()
  }
  console.log(APPLY ? 'Applied.' : 'Dry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
