#!/usr/bin/env tsx
/** Seven ban rows from Haight & Grannis, Banned Books 387 B.C. to 1978 A.D. (Bowker 1978, ISBN 0-8352-1078-2),
 *  selected in data/haight-shortlist-2026-11-16.md (tier A). Descriptions are our own paraphrase.
 *  Reasons only where Haight states one; otherwise 'other'. Guarded: skips if the book already has a ban for that
 *  country+year. Source = the Internet Archive lending record of the printed book, one URL fragment per entry.
 *    pnpm tsx --env-file=.env.local scripts/_add_haight_bans_2026_11_16.ts [--apply] */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'
const APPLY = isApply()
const BASE = 'https://archive.org/details/bannedbooks387bc0000haig'
const SRC = (who: string) => `Haight & Grannis, Banned Books 387 B.C. to 1978 A.D., 4th ed. (R. R. Bowker, 1978), entry “${who}”`
type Row = { book: number; title: string; cc: string; year: number; scope: string; action: 'banned' | 'restricted' | 'challenged'; reason: string; who: string; desc: string; inst?: string }
const SKIP_BOOKS = new Set([16279, 1028]) // weak matches (Genet edition identity; Joy of Sex not named in the entry)
const ALL_ROWS: Row[] = [
  { book: 20832, title: 'Aphrodite', cc: 'US', year: 1929, scope: 'customs', action: 'banned', reason: 'obscenity', who: 'Louÿs, Pierre',
    desc: 'In 1929 the US Customs Department barred Aphrodite, together with Louÿs’s Songs of Bilitis and Twilight of the Nymphs, as lascivious, corrupting and obscene.' },
  { book: 14, title: 'The Catcher in the Rye', cc: 'AU', year: 1957, scope: 'customs', action: 'banned', reason: 'other', who: 'Salinger, J. D.',
    desc: 'In 1957 Australian Customs seized a shipment of the book, even though it had been presented as a gift by the US Ambassador. The grounds are not recorded.' },
  { book: 16279, title: 'Our Lady of the Flowers', cc: 'GB', year: 1957, scope: 'public_library', action: 'banned', reason: 'other', who: 'Genet, Jean',
    desc: 'In 1957 a two-volume French-language edition of Genet’s novels ordered by Birmingham Public Library was seized. The grounds are not recorded, and the edition may not be this exact title.' },
  { book: 6224, title: 'Another Country', cc: 'US', year: 1965, scope: 'school', action: 'challenged', reason: 'other', who: 'Baldwin, James',
    desc: 'In 1965, after a parent’s complaint, the Chicago City Council ordered the novel removed from a course list at Wright Junior College; the college dean refused to comply.' },
  { book: 16660, title: 'Soul on Ice', cc: 'US', year: 1969, scope: 'school', action: 'restricted', reason: 'other', who: 'Cleaver, Eldridge',
    desc: 'In 1969 California Superintendent of Public Instruction Max Rafferty barred the book, with LeRoi Jones’s Dutchman, from elective black-studies courses.' },
  { book: 1028, title: 'The Joy of Sex', cc: 'US', year: 1978, scope: 'government', action: 'banned', reason: 'sexual', who: 'Comfort, Alex',
    desc: 'In 1978 police in Lexington confiscated sex-instruction books of this kind from three bookstores under a new county ordinance against displaying sexually oriented material in places frequented by minors. The state is not given in the entry.' },
  { book: 10, title: 'Lady Chatterley\'s Lover', cc: 'IE', year: 1932, scope: 'government', action: 'banned', reason: 'obscenity', who: 'Lawrence, D. H.',
    desc: 'Lady Chatterley’s Lover was banned in Ireland in 1932.' },
]
const ROWS = ALL_ROWS.filter(r => !SKIP_BOOKS.has(r.book))
async function main() {
  console.log(`\n── add haight bans ── ${APPLY ? 'APPLY' : 'DRY-RUN (no writes)'}`)
  const pg = newPgClient(); await pg.connect()
  let n = 0
  try {
    for (const r of ROWS) {
      const b = (await pg.query(`select title from books where id=$1`, [r.book])).rows[0]
      if (!b || b.title !== r.title) throw new Error(`book #${r.book} drift (${b?.title})`)
      const ex = (await pg.query(`select id from bans where book_id=$1 and country_code=$2 and year_started=$3`, [r.book, r.cc, r.year])).rows[0]
      if (ex) { console.log(`  skip: #${r.book} ${r.cc} ${r.year} already exists (ban #${ex.id})`); continue }
      const same = (await pg.query(`select string_agg(year_started::text, ',') y from bans where book_id=$1 and country_code=$2`, [r.book, r.cc])).rows[0].y
      console.log(`  ADD  #${r.book} ${r.title} — ${r.cc} ${r.year} ${r.scope}/${r.action}/${r.reason}${same ? ` (existing ${r.cc}: ${same})` : ''}`)
      console.log(`       ${r.desc}`)
      if (APPLY) {
        const res = await commitNewBanForBook({ book_id: r.book, country_code: r.cc, scope_slug: r.scope, action_type: r.action, ban_status: 'historical',
          year: r.year, reason_slug: r.reason, description_ban: r.desc, source_url: `${BASE}#${encodeURIComponent(r.who)}`, source_name: SRC(r.who), source_type: 'reference' }, pg)
        console.log(`       → ban #${res.ban_id} (${res.created ? 'created' : 'reused'})`)
      }
      n++
    }
  } finally { await pg.end() }
  console.log(`\n  ${APPLY ? 'added' : 'would add'}: ${n}\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
