#!/usr/bin/env tsx
/**
 * One-off: data-quality fix for South Korea (KR) historical bans.
 *
 * Audit (2026-05-30) found the 8 pre-1990 KR bans were LLM-import artefacts:
 * boilerplate rationales + generic homepage "sources" (article19.org,
 * pen.org/banned-books) or no source at all. Independent verification:
 *
 *   KEEP + backfill (verified):
 *     - ban_970 Five Bandits (Kim Chi-ha, 1970) — Sasanggye May 1970, poem
 *       placed on banned-materials list, magazine suspended, author + editors
 *       arrested under the Anti-Communist Law. Solid.
 *     - ban_598 Das Kapital (1948) — Marxist works barred under the National
 *       Security Law (Dec 1948). Defensible general fact.
 *
 *   REMOVE (spurious): the two Orwell KR-1985 bans have NO source and their
 *   rationales do not even mention South Korea (they describe Soviet-bloc /
 *   US-school-district bans). An anti-communist regime banning anti-Soviet
 *   allegories is also backwards. We delete ONLY the KR ban rows; the books
 *   keep their legitimate bans elsewhere.
 *     - ban_1020  1984 (book_4)        KR 1985
 *     - ban_1054  Animal Farm (book_8) KR 1985
 *
 *   The 4 Korean novels (The Square / The Dwarf / A Dream of Good Death /
 *   The Shadow of Arms) are left UNTOUCHED pending deeper verification.
 *
 *   pnpm tsx --env-file=.env.local scripts/_fix_south_korea_bans.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_fix_south_korea_bans.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

type Backfill = {
  ban_id: number
  label: string
  description: string
  source_name: string
  source_url: string
  source_type: string
  drop_source_url?: string // generic junk source link to remove from this ban
}

const BACKFILLS: Backfill[] = [
  {
    ban_id: 970,
    label: 'Five Bandits (Kim Chi-ha, 1970)',
    description: `Kim Chi-ha's 1970 narrative poem "Ojeok" ("Five Bandits"), cast in the form of traditional pansori, pilloried the country's corrupt elite — chaebol owners, generals, cabinet ministers, senior officials and lawmakers — as the bandits preying on the nation. After it appeared in the May 1970 issue of the journal Sasanggye, the government placed the poem on its list of banned materials and suspended the magazine, and Kim was arrested and imprisoned along with the editors under the Anti-Communist Law — even though the poem says nothing about communism or North Korea.`,
    source_name: 'Kim Chi-ha — Wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Kim_Chi-ha',
    source_type: 'wikipedia',
    drop_source_url: 'https://pen.org/banned-books/',
  },
  {
    ban_id: 598,
    label: 'Das Kapital (1948)',
    description: `Marxist political economy was prohibited in South Korea from the founding of the First Republic. The National Security Law, enacted in December 1948, criminalised material deemed to benefit communism or North Korea, and Marx's Das Kapital was among the works barred from publication and circulation for decades under successive anti-communist governments before the law was progressively narrowed after 1987.`,
    source_name: 'National Security Act (South Korea) — Wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/National_Security_Act_(South_Korea)',
    source_type: 'wikipedia',
    // ban_598 currently has no source attached.
  },
  {
    ban_id: 818,
    label: 'The Dwarf (Cho Se-hui, 1979)',
    description: `Cho Se-hui's linked-story cycle "The Dwarf" (난장이가 쏘아올린 작은 공, 1978) depicts the urban poor crushed by South Korea's breakneck industrialisation, echoing the forced resettlements of the Gwangju Daedanji incident. Unable to tolerate its sharp social criticism, the Park Chung-hee government placed the book under a sales ban; it nonetheless circulated widely and, after democratisation, became canonical — printed in hundreds of editions and set on the national university-entrance examination.`,
    source_name: '난장이가 쏘아올린 작은 공 — Korean Wikipedia',
    source_url: 'https://ko.wikipedia.org/wiki/난장이가_쏘아올린_작은_공',
    source_type: 'wikipedia',
    drop_source_url: 'https://www.article19.org/',
  },
]

// 1984 KR, Animal Farm KR (already removed in first run), then the three
// unverified Korean novels confirmed spurious by deeper verification:
//   816 The Square (canonical 1960 work, only authorial revisions),
//   814 The Shadow of Arms (serialised in Monthly Chosun, won the 1989 Manhae
//        Award — incompatible with a 1985 ban),
//   817 A Dream of Good Death (title does not exist in Yi Mun-yol's oeuvre).
const DELETE_BAN_IDS = [1020, 1054, 816, 814, 817]

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── fix-south-korea-bans — ${APPLY ? 'APPLY' : 'DRY-RUN'} ──\n`)

  try {
    // 1. Backfills --------------------------------------------------------
    console.log('[1] backfill verified bans (description + real source):')
    for (const bf of BACKFILLS) {
      const cur = await pg.query(
        `select b.country_code, bk.title, b.description from bans b join books bk on bk.id=b.book_id where b.id=$1`,
        [bf.ban_id],
      )
      if (cur.rows.length === 0) {
        console.log(`    ⚠ ban_${bf.ban_id} not found — skipping`)
        continue
      }
      const row = cur.rows[0]
      if (row.country_code.trim() !== 'KR') {
        console.log(`    ⚠ ban_${bf.ban_id} is ${row.country_code}, not KR — skipping for safety`)
        continue
      }
      console.log(`    + ban_${bf.ban_id} ${bf.label}`)
      console.log(`        desc: ${bf.description.slice(0, 80)}…`)
      console.log(`        src : ${bf.source_name}`)
      if (bf.drop_source_url) console.log(`        drop junk source link: ${bf.drop_source_url}`)
    }

    // 2. Deletions --------------------------------------------------------
    console.log('\n[2] remove spurious Orwell KR bans:')
    for (const id of DELETE_BAN_IDS) {
      const r = await pg.query(
        `select b.country_code, b.year_started, bk.title, bk.id book_id,
                (select count(*) from bans x where x.book_id=bk.id) total_bans
           from bans b join books bk on bk.id=b.book_id where b.id=$1`,
        [id],
      )
      if (r.rows.length === 0) {
        console.log(`    ⚠ ban_${id} not found — skipping`)
        continue
      }
      const row = r.rows[0]
      if (row.country_code.trim() !== 'KR') {
        console.log(`    ⚠ ban_${id} is ${row.country_code}, not KR — REFUSING to delete`)
        continue
      }
      console.log(
        `    − ban_${id} "${row.title}" (book_${row.book_id}) KR ${row.year_started} — book keeps its other ${row.total_bans - 1} ban(s)`,
      )
    }

    if (!APPLY) {
      console.log('\nDry-run. Re-run with --apply to write to DB.')
      return
    }

    // APPLY ---------------------------------------------------------------
    for (const bf of BACKFILLS) {
      const cur = await pg.query(`select country_code from bans where id=$1`, [bf.ban_id])
      if (cur.rows.length === 0 || cur.rows[0].country_code.trim() !== 'KR') continue

      await pg.query(`update bans set description=$1 where id=$2`, [bf.description, bf.ban_id])

      if (bf.drop_source_url) {
        await pg.query(
          `delete from ban_source_links bsl using ban_sources s
            where bsl.source_id=s.id and bsl.ban_id=$1 and s.source_url=$2`,
          [bf.ban_id, bf.drop_source_url],
        )
      }
      const srcRes = await pg.query(
        `insert into ban_sources (source_name, source_url, source_type, verification_status, accessed_at)
         values ($1,$2,$3,'verified',now())
         on conflict (source_url) do update set source_name=excluded.source_name, source_type=excluded.source_type, accessed_at=now()
         returning id`,
        [bf.source_name, bf.source_url, bf.source_type],
      )
      await pg.query(
        `insert into ban_source_links (ban_id, source_id) values ($1,$2) on conflict do nothing`,
        [bf.ban_id, srcRes.rows[0].id],
      )
      console.log(`✓ [1] ban_${bf.ban_id} ${bf.label} — description set + source attached`)
    }

    for (const id of DELETE_BAN_IDS) {
      const cur = await pg.query(`select country_code, book_id from bans where id=$1`, [id])
      if (cur.rows.length === 0 || cur.rows[0].country_code.trim() !== 'KR') continue
      const bookId = cur.rows[0].book_id as number

      await pg.query(`delete from ban_reason_links where ban_id=$1`, [id])
      await pg.query(`delete from ban_source_links where ban_id=$1`, [id])
      await pg.query(`delete from bans where id=$1`, [id])
      console.log(`✓ [2] deleted ban_${id}`)

      // If this leaves the book with no bans at all, it only existed because
      // of this spurious entry — remove the orphaned book, its alias/author
      // links, and any author left with no remaining books.
      const remaining = await pg.query(`select count(*)::int c from bans where book_id=$1`, [bookId])
      if (remaining.rows[0].c === 0) {
        const authors = await pg.query(`select author_id from book_authors where book_id=$1`, [bookId])
        await pg.query(`delete from book_slug_aliases where book_id=$1`, [bookId])
        await pg.query(`delete from book_authors where book_id=$1`, [bookId])
        await pg.query(`delete from books where id=$1`, [bookId])
        console.log(`        ↳ removed orphaned book_${bookId}`)
        for (const a of authors.rows) {
          const stillUsed = await pg.query(`select count(*)::int c from book_authors where author_id=$1`, [a.author_id])
          if (stillUsed.rows[0].c === 0) {
            await pg.query(`delete from authors where id=$1`, [a.author_id])
            console.log(`        ↳ removed orphaned author_${a.author_id}`)
          }
        }
      }
    }

    console.log('\nDone. Refresh /countries/KR on localhost to review.')
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
