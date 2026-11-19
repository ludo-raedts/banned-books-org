/**
 * NZ Classification Office — confirmed matches to books we already hold (4 rows, 2026-11-19).
 * The register/list has no author column, so a title-only import is unsafe (see
 * data/nz-oflc/review-matches-2026-11-19.md); only owner-confirmed pinned book_ids are attached.
 * Seed: data/nz-oflc/stage0-confirmed-2026-11-19.json. Attach-only (commitNewBanForBook).
 *   npx tsx --env-file=.env.local scripts/import-nz-oflc-matches.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/import-nz-oflc-matches.ts --apply
 */
import { readFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()
const SRC = {
  url: 'https://www.classificationoffice.govt.nz/documents/297/title_20250922_Books_banned_in_Aotearoa.pdf',
  name: 'NZ Classification Office — Register of Classification Decisions / Books banned in Aotearoa (2025-09-22)',
  type: 'government',
}

async function main() {
  const rows = JSON.parse(readFileSync('data/nz-oflc/stage0-confirmed-2026-11-19.json', 'utf8')).rows
  const pg = newPgClient()
  await pg.connect()
  console.log(`── import-nz-oflc-matches ── ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${rows.length} rows`)
  try {
    for (const r of rows) {
      const b = (await pg.query(`select title from books where id=$1`, [r.book_id])).rows[0]
      const dup = (await pg.query(
        `select 1 from bans where book_id=$1 and country_code='NZ' and year_started=$2`, [r.book_id, r.year])).rows.length
      if (dup) { console.log(`  SKIP   ${r.key} #${r.book_id} "${b?.title}" — NZ ban ${r.year} exists`); continue }
      console.log(`  ATTACH ${r.key} (${r.year}) → #${r.book_id} "${b?.title}" [${r.pub_no}, ${r.classification}]`)
      if (!APPLY) continue
      const d = `Classified "${r.classification}" by the New Zealand Indecent Publications Tribunal (${r.pub_no}), registered ${r.reg_date}. Tribunal decisions of 1964–1994 remain in force under the Films, Videos, and Publications Classification Act 1993.${r.note ? ' Note: ' + r.note + '.' : ''}`
      await commitNewBanForBook({
        book_id: r.book_id, country_code: 'NZ', scope_slug: 'government', action_type: 'banned', ban_status: 'active',
        year: r.year, reason_slug: 'obscenity', description_ban: d,
        source_url: SRC.url, source_name: SRC.name, source_type: SRC.type,
      }, pg)
    }
  } finally { await pg.end() }
  if (!APPLY) console.log('DRY-RUN — nothing written.')
}
main().catch(e => { console.error(e); process.exit(1) })
