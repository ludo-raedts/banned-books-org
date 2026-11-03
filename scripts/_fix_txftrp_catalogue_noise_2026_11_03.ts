#!/usr/bin/env tsx
/**
 * Post-import cleanup of the Texas Freedom to Read Project import (2026-11-03).
 * Several districts pasted library-catalogue (MARC) records; the stage-0 cleanup
 * caught most of it, this fixes the residue on rows created by that import
 * (books id ≥ 24212, authors created the same day).
 *
 * 1. Titles: trailing ISBD punctuation ("Seraphina /", "Car Trouble :"),
 *    "[large Print]", "/ [Book] …" statement-of-responsibility tails.
 * 2. Authors: catalogue roles ("writers X ... []", "produced by", "[compiled by]"),
 *    inverted names ("Paul, Jeffers, H"), split pairs ("Morris" + "Roy").
 *    Rename in place, or fold into an existing author (merge) when one exists.
 * 3. Scope: "Abstinence…: It's the Right Choice" (SVE / Churchill Media) is an
 *    educational video, not a book → book + its bans deleted (books-only scope).
 *
 *   npx tsx --env-file=.env.local scripts/_fix_txftrp_catalogue_noise_2026_11_03.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/_fix_txftrp_catalogue_noise_2026_11_03.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const APPLY = isApply()
const FIRST_BOOK = 24212

// author id → new display name (null = unlink + delete: the other half of a split pair)
const RENAME: Record<number, string | null> = {
  21529: 'Jack Canfield',
  21968: 'Time-Life Books',
  20671: 'The Editors of Life',
  20617: 'Prince Harry',
  20244: 'Abegail Ntleko',
  20057: 'H. Paul Jeffers',
  22140: 'Walter D. Edmonds',
  18778: 'Ice-T',
  20426: 'Roy Morris Jr.',
  20427: null,
  21524: 'Brad Klinge',
  21525: 'Barry Klinge',
  21851: 'Pamela Voelkel',
}
const VIDEO_TITLE = "Abstinence...: It's the Right Choice"

function cleanTitle(t: string): string {
  return t
    .replace(/\/\s*\[book\].*$/i, '')
    .replace(/\s*\[large print\]\s*/i, ' ')
    .replace(/:\s*a novel\s*\/?\s*$/i, '')
    .replace(/\s+[/:;,=]\s*$/, '')
    .replace(/\s*\/\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim()
}

async function renameOrMerge(pg: Client, id: number, name: string) {
  const slug = slugify(name)
  const target = (await pg.query(`select id from authors where slug=$1 and id<>$2`, [slug, id])).rows[0]?.id
  if (target) {
    console.log(`  author #${id} → merge into #${target} "${name}"`)
    if (!APPLY) return
    await pg.query(
      `insert into book_authors(book_id, author_id, role) select book_id, $2, role from book_authors where author_id=$1 on conflict do nothing`,
      [id, target],
    )
    await pg.query(`delete from book_authors where author_id=$1`, [id])
    await pg.query(`delete from authors where id=$1`, [id])
  } else {
    console.log(`  author #${id} → rename "${name}"`)
    if (APPLY) await pg.query(`update authors set display_name=$2, slug=$3 where id=$1`, [id, name, slug])
  }
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`── _fix_txftrp_catalogue_noise_2026_11_03 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  if (APPLY) await pg.query('begin')
  try {
    // 1. titles
    const books = (await pg.query(`select id, title from books where id >= $1`, [FIRST_BOOK])).rows
    let titles = 0
    for (const b of books) {
      const t = cleanTitle(b.title)
      if (t === b.title || !t) continue
      titles++
      console.log(`  title #${b.id}: "${b.title}" → "${t}"`)
      if (APPLY) await pg.query(`update books set title=$2 where id=$1`, [b.id, t])
    }

    // 2a. catalogue-role prefixes on today's authors ("writers Mort Todd ... []")
    const roles = (
      await pg.query(
        `select id, display_name from authors where created_at > now() - interval '1 day' and display_name ~* '^(writers|artists|produced by) |\\.\\.\\. \\[\\]$'`,
      )
    ).rows
    for (const a of roles) {
      const name = a.display_name.replace(/^(writers|artists|produced by)\s+/i, '').replace(/\s*\.\.\.\s*\[\]$/, '').replace(/\s+\d+$/, '').trim()
      await renameOrMerge(pg, Number(a.id), name)
    }
    // 2b. hand-reviewed renames / merges
    for (const [idS, name] of Object.entries(RENAME)) {
      const id = Number(idS)
      const exists = (await pg.query(`select 1 from authors where id=$1`, [id])).rows.length
      if (!exists) continue
      if (name === null) {
        console.log(`  author #${id} → unlink + delete (other half of a split name)`)
        if (APPLY) { await pg.query(`delete from book_authors where author_id=$1`, [id]); await pg.query(`delete from authors where id=$1`, [id]) }
      } else await renameOrMerge(pg, id, name)
    }
    // the J half of "J Voelkel, P"
    const jv = (await pg.query(`select id from authors where display_name='J Voelkel' and created_at > now() - interval '1 day'`)).rows[0]?.id
    if (jv) await renameOrMerge(pg, Number(jv), 'Jon Voelkel')

    // 3. non-book (video)
    const vid = (await pg.query(`select id from books where title=$1 and id >= $2`, [VIDEO_TITLE, FIRST_BOOK])).rows[0]?.id
    if (vid) {
      const n = (await pg.query(`select count(*)::int n from bans where book_id=$1`, [vid])).rows[0].n
      console.log(`  book #${vid} "${VIDEO_TITLE}" (video) → delete with ${n} ban(s)`)
      if (APPLY) {
        const authors = (await pg.query(`select author_id from book_authors where book_id=$1`, [vid])).rows.map(r => r.author_id)
        await pg.query(`delete from ban_source_links where ban_id in (select id from bans where book_id=$1)`, [vid])
        await pg.query(`delete from ban_reason_links where ban_id in (select id from bans where book_id=$1)`, [vid])
        await pg.query(`delete from bans where book_id=$1`, [vid])
        await pg.query(`delete from book_authors where book_id=$1`, [vid])
        await pg.query(`delete from books where id=$1`, [vid])
        // orphaned authors that only existed for this record
        await pg.query(`delete from authors a where a.id = any($1) and not exists (select 1 from book_authors ba where ba.author_id=a.id)`, [authors])
      }
    }
    console.log(`  titles cleaned: ${titles}`)
    if (APPLY) await pg.query('commit')
  } catch (e) {
    if (APPLY) await pg.query('rollback')
    throw e
  }
  await pg.end()
}

main().catch(e => { console.error(e); process.exit(1) })
