#!/usr/bin/env tsx
/**
 * Merge cross-language (Spanish-edition) duplicate book rows.
 *
 * A US school-ban import batch (book ids clustering ~5400-6100, Google-API
 * covers, no OpenLibrary work id, 1-2 bans) minted fresh book rows keyed on the
 * SPANISH edition title for works the DB already catalogues in English — e.g.
 * "Ciudades de Papel" is the Spanish edition of "Paper Towns". Each Spanish row
 * shares the SAME author as its English canonical, so these are book-ONLY
 * merges (no author merge). See memory "Cross-language (cross-script) dupes".
 *
 * Doctrine: a foreign-language DROP contributes ONLY its ban, its URL slug-alias
 * and language-NEUTRAL facts the canonical row lacks. The title, original_language,
 * description and the edition's own ISBN/pub-year/cover are NEVER copied — they
 * describe the translation, not the original work. In practice every English
 * canonical here is already fully populated (OL work + cover) and every DROP
 * scalar is Spanish-edition-specific, so nothing is enriched.
 *
 * Ban dedup uses the FULL event key (country+scope+region+institution+year), NOT
 * the coarse country|scope key in merge-cross-language-dupes.ts (that one is for
 * distinct-country bans and would wrongly collapse one US school ban against an
 * unrelated US district).
 *
 * IMPORTANT — what is NOT in this list: genuine foreign-language WORKS that merely
 * look Spanish/French (Lenin/Engels political works, Liste-Otto/FSEM French titles,
 * Alvaro Yunque's all-Spanish catalogue). Those are distinct titles, not edition
 * dupes, and are deliberately excluded.
 *
 * Each PAIR was verified by translating the Spanish title to its English work and
 * confirming both share one author. Whole run is ONE transaction under --apply.
 * Idempotent: a gone DROP is a no-op (so applied pairs stay in the list as record).
 *
 *   pnpm tsx --env-file=.env.local scripts/merge-spanish-edition-dupes.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-spanish-edition-dupes.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

// [DROP (Spanish edition), KEEP (English canonical), note]
// Each Spanish→English mapping was verified by translation + shared author; the
// two non-obvious ones (Gonzales, Niven) were confirmed against the published
// Spanish editions ("La teoría de lo perfecto / Perfect on Paper"; "Violet y
// Finch" = "All the Bright Places", título original).
const PAIRS: [number, number, string][] = [
  // John Green — applied 2026-06-16
  [5453, 232, 'Bajo La Misma Estrella → The Fault in Our Stars (John Green)'],
  [5490, 291, 'Ciudades de Papel → Paper Towns (John Green)'],
  [5537, 534, 'El teorema Katherine → An Abundance of Katherines (John Green)'],
  // Khaled Hosseini
  [5494, 31, 'Cometas en el cielo → The Kite Runner (Khaled Hosseini)'],
  // Sherman Alexie
  [5529, 82, 'El diario completamente verídico… → The Absolutely True Diary of a Part-Time Indian (Sherman Alexie)'],
  // Sarah J. Maas
  [6054, 195, 'Trono de cristal → Throne of Glass (Sarah J. Maas)'],
  [8683, 290, 'Corona de Medianoche → Crown of Midnight (Sarah J. Maas)'],
  [8684, 199, 'Imperio de Tormentas → Empire of Storms (Sarah J. Maas)'],
  [8685, 212, 'Reino de Cenizas → Kingdom of Ash (Sarah J. Maas)'],
  [8686, 243, 'Torre del Alba → Tower of Dawn (Sarah J. Maas)'],
  // George R. R. Martin
  [2690, 268, 'Choque de Reyes → A Clash of Kings (George R. R. Martin)'],
  // Isabel Quintero
  [5585, 341, 'Gabi, fragmentos de una adolescente → Gabi, a Girl in Pieces (Isabel Quintero)'],
  // Victoria Aveyard
  [5496, 5499, 'Corona cruel → Cruel Crown (Victoria Aveyard)'],
  [5719, 2013, 'La Jaula Del Rey → King\'s Cage (Victoria Aveyard)'],
  // Rick Riordan
  [5539, 3972, 'El último héroe del Olimpo → The Last Olympian (Rick Riordan)'],
  [5717, 3927, 'La batalla del laberinto → The Battle of the Labyrinth (Rick Riordan)'],
  [5721, 4008, 'La maldición del Titán → The Titan\'s Curse (Rick Riordan)'],
  [5723, 5944, 'La sangre del Olimpo → The Blood of Olympus (Rick Riordan)'],
  [5841, 7935, 'Percy Jackson y los dioses griegos → Percy Jackson\'s Greek Gods (Rick Riordan)'],
  // Sabaa Tahir
  [6066, 5388, 'Una antorcha en las tinieblas → A Torch Against the Night (Sabaa Tahir)'],
  // Pablo Cartaya
  [5531, 5964, 'El épico fracaso de Arturo Zamora → The Epic Fail of Arturo Zamora (Pablo Cartaya)'],
  // Alexandra Diaz
  [5727, 5893, 'La travesía de Santiago → Santiago\'s Road Home (Alexandra Diaz)'],
  // Sophie Gonzales
  [4998, 5056, 'La teoría de lo perfecto → Perfect on Paper (Sophie Gonzales)'],
  // Jennifer Niven
  [6074, 330, 'Violet y Finch → All the Bright Places (Jennifer Niven)'],
]

const CURATED_BOOK_TABLES = [
  'bbw_featured_selections', 'reading_club_classics', 'reading_club_currently_challenged',
  'reading_club_international', 'reading_club_theme_books', 'reading_club_young_readers',
]

type Ban = {
  id: number; country_code: string; scope_id: number | null
  region: string | null; institution: string | null; year_started: number | null
}
const banKey = (b: Ban) =>
  `${b.country_code}|${b.scope_id ?? ''}|${b.region ?? ''}|${b.institution ?? ''}|${b.year_started ?? ''}`

async function mergeBook(pg: Client, DROP: number, KEEP: number, note: string) {
  const keepRow = (await pg.query(`select id, slug, title from books where id=$1`, [KEEP])).rows[0]
  const dropRow = (await pg.query(`select id, slug, title from books where id=$1`, [DROP])).rows[0]
  if (!dropRow) { console.log(`\n[${note}] DROP #${DROP} already gone — no-op.`); return }
  if (!keepRow) throw new Error(`[${note}] KEEP #${KEEP} not found`)
  console.log(`\n[${note}]\n  KEEP #${KEEP} "${keepRow.title}" ← DROP #${DROP} "${dropRow.title}"`)

  // Verify the shared-author invariant — guards against a mistranslated pairing.
  const shared = await pg.query(
    `select 1 from book_authors d join book_authors k on d.author_id=k.author_id
     where d.book_id=$1 and k.book_id=$2 limit 1`, [DROP, KEEP])
  if (!shared.rowCount) throw new Error(`[${note}] DROP #${DROP} and KEEP #${KEEP} share no author — abort.`)

  for (const t of CURATED_BOOK_TABLES) {
    const { rows } = await pg.query(`select 1 from ${t} where book_id=$1 limit 1`, [DROP])
    if (rows.length) throw new Error(`[${note}] DROP #${DROP} referenced by curated table ${t} — abort.`)
  }

  // 1. Migrate bans (dedup on full event key).
  const banCols = `id, country_code, scope_id, region, institution, year_started`
  const keepBans = (await pg.query<Ban>(`select ${banCols} from bans where book_id=$1`, [KEEP])).rows
  const dropBans = (await pg.query<Ban>(`select ${banCols} from bans where book_id=$1`, [DROP])).rows
  const keepKeys = new Map(keepBans.map(b => [banKey(b), b.id]))
  for (const b of dropBans) {
    const match = keepKeys.get(banKey(b))
    if (match != null) {
      console.log(`  ban ${b.id} [${banKey(b)}]: DUP of KEEP ban ${match} → union links, drop via cascade`)
      if (APPLY) {
        await pg.query(`insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing`, [match, b.id])
        await pg.query(`insert into ban_reason_links(ban_id,reason_id) select $1,reason_id from ban_reason_links where ban_id=$2 on conflict do nothing`, [match, b.id])
      }
    } else {
      console.log(`  ban ${b.id} [${banKey(b)}]: MOVE → KEEP`)
      if (APPLY) await pg.query(`update bans set book_id=$1 where id=$2`, [KEEP, b.id])
      keepKeys.set(banKey(b), b.id)
    }
  }

  // 2. Slug aliases: re-point DROP's aliases, add the Spanish slug as a legacy alias.
  if (APPLY) await pg.query(`update book_slug_aliases set book_id=$1 where book_id=$2`, [KEEP, DROP])
  if (dropRow.slug && dropRow.slug !== keepRow.slug) {
    console.log(`  alias add legacy "${dropRow.slug}" → KEEP`)
    if (APPLY) await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict(slug) do nothing`, [dropRow.slug, KEEP])
  }

  // 3. No enrichment (every DROP scalar is Spanish-edition-specific). Intentional no-op.

  // 4. Delete DROP (CASCADE: shared book_authors row, search-attempt logs).
  console.log(`  DELETE book #${DROP} (CASCADE)`)
  if (APPLY) await pg.query(`delete from books where id=$1`, [DROP])
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`── merge-spanish-edition-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${PAIRS.length} pair(s)`)
  try {
    if (APPLY) await pg.query('begin')
    for (const [drop, keep, note] of PAIRS) await mergeBook(pg, drop, keep, note)
    if (APPLY) { await pg.query('commit'); console.log(`\nApplied (single transaction).`) }
    else console.log(`\nDry-run — re-run with --apply.`)
  } catch (err) {
    if (APPLY) { try { await pg.query('rollback'); console.error('Rolled back.') } catch { /* */ } }
    throw err
  } finally {
    await pg.end()
  }
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
