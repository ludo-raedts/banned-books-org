#!/usr/bin/env tsx
/** Add the two ban rows that Fellion & Inglis, Censored (2017) documents and we lacked
 *  (passages re-read by hand 2026-11-16): Ulysses → Canada 1923–1949 (p.182);
 *  Lady Chatterley's Lover → US Post Office seizure 1959, reversed in court (pp.193–195).
 *  commitNewBanForBook only writes active/historical, so status/year_ended are set after.
 *    pnpm tsx --env-file=.env.local scripts/_add_censored_missing_bans_2026_11_16.ts [--apply] */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'
const APPLY = isApply()
const BASE = 'https://openlibrary.org/books/OL26942635M'
const ITEMS = [
  { book: 52, title: 'Ulysses', cc: 'CA', year: 1923, yearEnded: 1949, frag: 'ch11-ulysses-p182',
    srcName: 'Fellion & Inglis, Censored: A Literary History of Subversion and Control (McGill-Queen’s UP, 2017), ch. 11 “Ulysses”, p. 182',
    desc: 'Canada banned Ulysses from January 1923 until 1949. Before the ban took effect, copies had been smuggled from Canada into the United States.' },
  { book: 10, title: 'Lady Chatterley’s Lover', cc: 'US', year: 1959, yearEnded: null, frag: 'ch12-lady-chatterley-pp193-195',
    srcName: 'Fellion & Inglis, Censored: A Literary History of Subversion and Control (McGill-Queen’s UP, 2017), ch. 12 “Lady Chatterley’s Lover”, pp. 193–195',
    desc: 'In 1959 the US Post Office seized twenty-four cartons of Grove Press’s unexpurgated edition from the mail. After a one-day Post Office hearing, Postmaster General Arthur Summerfield ruled the book obscene. Grove Press won judicial review: Judge Frederick van Pelt Bryan held it not obscene under the Roth test, a court of appeals affirmed, and the Post Office did not appeal further.' },
]
async function main() {
  console.log(`\n── add censored missing bans ── ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  const pg = newPgClient(); await pg.connect()
  try {
    for (const it of ITEMS) {
      const b = (await pg.query(`select title from books where id=$1`, [it.book])).rows[0]
      if (!b || !b.title.startsWith(it.title.slice(0, 6))) throw new Error(`book #${it.book} drift (${b?.title})`)
      const ex = (await pg.query(`select id, year_started from bans where book_id=$1 and country_code=$2 and scope_id=4 and year_started=$3`, [it.book, it.cc, it.year])).rows[0]
      if (ex) { console.log(`  skip: #${it.book} ${it.cc} ${it.year} already exists (ban #${ex.id})`); continue }
      console.log(`  ADD  #${it.book} ${b.title} — ${it.cc} ${it.year}${it.yearEnded ? '–' + it.yearEnded : ''} government/rescinded, source ${BASE}#${it.frag}`)
      if (APPLY) {
        const r = await commitNewBanForBook({
          book_id: it.book, country_code: it.cc, scope_slug: 'government', action_type: 'banned', ban_status: 'historical',
          year: it.year, reason_slug: 'obscenity', description_ban: it.desc,
          source_url: `${BASE}#${it.frag}`, source_name: it.srcName, source_type: 'academic',
        }, pg)
        await pg.query(`update bans set status='rescinded', year_ended=$2, confidence='verified' where id=$1`, [r.ban_id, it.yearEnded])
        console.log(`       → ban #${r.ban_id} (${r.created ? 'created' : 'reused'})`)
      }
    }
  } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
