#!/usr/bin/env tsx
// Index 1877, page 260 (archive.org leaf n316), checked against the scan 2026-11-24:
//   • #31686 "Mulbrunnae habiti" is the tail of "PROTOCOLLUM, hoc est acta colloquii inter Palatinos, et Wirtebergicos
//     theologos de ubiquitate … anno 1564 Mulbrunnae habiti. App. Ind. Trid." → rename to the head title (old slug kept as alias).
//   • "PRUDENZANO FRANC. Istituzione di arte poetica. Donec expurg. Decr. 14 Dec. 1854" was lost by the OCR column break → add it.
//     Author kept as PRINTED ("Franc." not expanded; identity unverified, no catalogue hit found).
//   npx tsx --env-file=.env.local scripts/fix-index-1877-protocollum-prudenzano.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
import { slugify } from '../src/lib/imports/slugify'
import { commitParsedRow } from '../src/lib/imports/review-commit'
import { INDEX_1877_SOURCE_URL } from './build-index-1877-stage0'
const APPLY = isApply()
const NEW_TITLE = 'Protocollum, hoc est acta colloquii inter Palatinos, et Wirtebergicos theologos de ubiquitate'
const INCLUSION = 'Listed in the Index Librorum Prohibitorum (Rome, 1877 edition, complete to 1876), the Catholic Church’s official catalogue of books Catholics were forbidden to read, print or keep. The Index was abolished in 1966.'
const SOURCE_NAME = 'Index librorum prohibitorum … Pii IX Pont. Max. iussu editus, editio novissima … usque ad annum 1876 (Romae 1877)'

async function main() {
  const pg = newPgClient(); await pg.connect()
  const tot = async () => (await pg.query(`select (select count(*) from books)::int books,(select count(*) from authors)::int authors,(select count(*) from bans)::int bans`)).rows[0]
  console.log(APPLY ? 'APPLY' : 'DRY-RUN', 'voor', await tot())
  const book = (await pg.query('select id,slug,title from books where id=31686')).rows[0]
  if (book && book.title !== NEW_TITLE) {
    const slug = slugify(NEW_TITLE).slice(0, 80).replace(/-[^-]*$/, '')
    const clash = (await pg.query('select id from books where slug=$1 and id<>31686', [slug])).rows[0]
    if (clash) throw new Error(`slug ${slug} taken by #${clash.id}`)
    console.log(`rename #31686 "${book.title}" → "${NEW_TITLE}" (slug ${slug}; alias ${book.slug})`)
    if (APPLY) {
      await pg.query('update books set title=$1, slug=$2 where id=31686', [NEW_TITLE, slug])
      await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,31686,'legacy_slug') on conflict do nothing`, [book.slug])
    }
  } else console.log('Protocollum: already done')
  const have = (await pg.query(`select id from books where slug='istituzione-di-arte-poetica'`)).rows[0]
  if (have) console.log(`Prudenzano: already present #${have.id}`)
  else {
    console.log('create "Istituzione di arte poetica" — Franc. Prudenzano — VA 1854 restricted (donec expurgetur)')
    if (APPLY) {
      await pg.query('begin')
      try {
        const res = await commitParsedRow({
          country_code: 'VA', scope_slug: 'government', ban_status: 'historical', reason_slug: 'religious',
          source_url: INDEX_1877_SOURCE_URL, source_name: SOURCE_NAME, source_type: 'government',
          title: 'Istituzione di arte poetica', slug_override: 'istituzione-di-arte-poetica', original_language: 'it',
          authors: ['Franc. Prudenzano'], year: 1854, action_type: 'restricted',
          description_ban: 'Prohibited until corrected (donec expurgetur) by a decree of 14 December 1854, as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition). The author afterwards submitted (“et postea laudabiliter se subiecit”).',
          inclusion_rationale: INCLUSION,
        }, pg)
        console.log('  created book', res.book_id)
        await pg.query('commit')
      } catch (e) { await pg.query('rollback'); throw e }
    }
  }
  console.log('na', await tot())
  await pg.end()
  console.log(APPLY ? 'Applied.' : 'Dry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
