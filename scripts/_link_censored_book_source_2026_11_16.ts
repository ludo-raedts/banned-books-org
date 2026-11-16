#!/usr/bin/env tsx
/** Link Fellion & Inglis, Censored (2017) as a cited source on the three ban rows whose
 *  descriptions were rewritten from it (passages re-read by hand 2026-11-16: Fanny Hill pp.51–53,
 *  Leaves of Grass pp.108–110, Lolita pp.251–255). ban_sources is unique on source_url, so each
 *  chapter gets its own URL fragment on the Open Library edition page (OL26942635M, 978-0-7735-5127-5).
 *  Also fixes one wording slip in #829 ("citing" → "after reading" a Comstock letter). */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
const APPLY = isApply()
const BASE = 'https://openlibrary.org/books/OL26942635M'
const ROWS = [
  { ban: 13100, book: 577, frag: 'ch2-fanny-hill-pp51-53', name: 'Fellion & Inglis, Censored: A Literary History of Subversion and Control (McGill-Queen’s UP, 2017), ch. 2 “Memoirs of a Woman of Pleasure”, pp. 51–53' },
  { ban: 829, book: 761, frag: 'ch6-leaves-of-grass-pp108-110', name: 'Fellion & Inglis, Censored: A Literary History of Subversion and Control (McGill-Queen’s UP, 2017), ch. 6 “Leaves of Grass”, pp. 108–110' },
  { ban: 59, book: 51, frag: 'ch16-lolita-pp251-255', name: 'Fellion & Inglis, Censored: A Literary History of Subversion and Control (McGill-Queen’s UP, 2017), ch. 16 “Lolita”, pp. 251–255' },
]
const FIX_829 = ['In 1882 the New England Society for the Suppression of Vice, citing a letter from Anthony Comstock,',
  'In 1882 the New England Society for the Suppression of Vice, after reading a letter from Anthony Comstock,']
async function main() {
  console.log(`\n── link Censored (2017) ── ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  const pg = newPgClient(); await pg.connect()
  try {
    if (APPLY) await pg.query('begin')
    for (const r of ROWS) {
      const b = (await pg.query(`select book_id from bans where id=$1`, [r.ban])).rows[0]
      if (!b || Number(b.book_id) !== r.book) throw new Error(`drift ban #${r.ban}`)
      const url = `${BASE}#${r.frag}`
      console.log(`  LINK ban #${r.ban} → ${url}`)
      if (APPLY) {
        const s = (await pg.query(
          `insert into ban_sources (source_name, source_url, source_type, verification_status, accessed_at)
           values ($1,$2,'academic','verified',now())
           on conflict (source_url) do update set source_name=excluded.source_name, accessed_at=now() returning id`, [r.name, url])).rows[0]
        await pg.query(`insert into ban_source_links (ban_id, source_id) values ($1,$2) on conflict do nothing`, [r.ban, s.id])
      }
    }
    const d = (await pg.query(`select description from bans where id=829`)).rows[0]?.description ?? ''
    if (d.startsWith(FIX_829[0])) {
      console.log('  FIX  #829 wording ("citing" → "after reading")')
      if (APPLY) await pg.query(`update bans set description=$1 where id=829`, [d.replace(FIX_829[0], FIX_829[1])])
    }
    if (APPLY) await pg.query('commit')
  } catch (e) { if (APPLY) { try { await pg.query('rollback') } catch {} } throw e } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
