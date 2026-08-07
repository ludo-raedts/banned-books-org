#!/usr/bin/env tsx
/**
 * _fix_truncated_generic_titles.ts — ONE-OFF remediation of the verified hits
 * from scripts/_audit_truncated_titles.ts (2026-08-07 batch, found via the
 * /news linkify work). Every row below was checked against its ban source
 * (import JSON in data/) and against OpenLibrary before landing here.
 *
 * FINDINGS (verified):
 *
 *  RETITLE (truncated import titles; old slug gets a book_slug_aliases row):
 *
 *  1. #13397 "On the" (slug on-the) — PEN Belarus extremist-list import cut
 *     the title at a nested quote. Source raw (data/pen-belarus-batch1.json,
 *     extremist entry 51/53 block):
 *       Ihar Mielnikaŭ, "On the "border of civilizations"". Pages of the
 *       history of the pre-war Soviet-Polish cordon in Belarus" (Minsk, 2020)
 *     → title: On the "Border of Civilizations": Pages of the History of the
 *       Pre-War Soviet-Polish Cordon in Belarus; first_published_year 2020.
 *
 *  2. #18491 "The Event" (slug the-event) — PEN America 2022-23 keeps the
 *     series in a separate CSV column ("The Event" / series "Black Hammer",
 *     Wentzville MO); the importer dropped it. The row's own
 *     openlibrary_work_id OL19729936W resolves to "Black Hammer, Vol. 2".
 *     → title: Black Hammer, Vol. 2: The Event (Lemire/Ormston/Stewart).
 *
 *  CLEAN (right book, contaminated enrichment; guarded field fixes):
 *
 *  3. #17734 "Will" — PEN 2021-22 (NEISD, TX) confirms Maria Boyd's "Will"
 *     (real YA novel, 2006). Enrichment matched namesakes on the bare word:
 *     openlibrary_work_id OL362694W = Shakespeare's "Twelfth Night, or What
 *     You Will"; isbn13 9780451502933 = unrelated Signet (pub-year 1734 came
 *     along with it); description_book = Wikipedia article on Will Boyd, an
 *     American politician. → NULL isbn/OL/desc, first_published_year 2006
 *     (OL first_publish_year, Random House Australia).
 *
 *  4. #6166 "Health" (McGraw Hill; PEN 2024-25 King George County VA) —
 *     OL id OL35168424W is CORRECT (Glencoe Health) but description_book is
 *     a Wikipedia article on the Grand Rapids Medical Mile. → NULL desc.
 *
 *  5. #2563 "The Gathering" (Kelley Armstrong) — first_published_year 2025
 *     is the ban year, not the pub year; OL says 2011. → 2011.
 *
 *  6. #3917 "Target" (Kathleen Jeffrie Johnson) — same class: 2025 → 2003
 *     (OL). Also strips the "----------" cruft prefix off description_book.
 *
 *  DELETE (KDN-Malaysia periodicals, out of books-only scope; precedent
 *  scripts/archive/delete-kdn-periodicals.ts — FK cascade removes bans,
 *  book_authors, ban_*_links; full pre-delete backup below):
 *
 *  7. #10449 "Times"   — KDN bil 159/540: publisher "THE TIMES BOOK AND
 *     NEWSPAPER PUBLISHING CO." resp. "CHIANG CHUANG FANG"; no author.
 *     Contaminated with OL264688W ("A Day at a Time").
 *  8. #10970 "Novel"   — KDN bil 697: publisher "NOVEL MAGAZINE" (CINA).
 *     Contaminated with OL14908523W ("The Oyster") + wrong ISBN.
 *  9. #11165 "Stories" — KDN bil 903: publisher "STORIES MONTHLY PRESS".
 *     Contaminated with OL264090W ("The Penguin Book of Vampire Stories").
 * 10. #11465 "Time"    — KDN bil 1233: publisher "TIME INC,", printer "ISSUE
 *     DATED 5 NOV 1973" = the TIME magazine issue of 5 Nov 1973.
 *     Contaminated with OL264688W ("A Day at a Time").
 *
 * Every update is guarded on the exact current (wrong) value, so a later
 * manual edit is never clobbered. Dry-run by default; --apply writes.
 * Backup: data/truncated-titles-fix-2026-08-07.json (also written on dry-run).
 *
 *   pnpm tsx --env-file=.env.local scripts/_fix_truncated_generic_titles.ts
 *   pnpm tsx --env-file=.env.local scripts/_fix_truncated_generic_titles.ts --apply
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const db = adminClient()
const APPLY = isApply()
const BACKUP = 'data/truncated-titles-fix-2026-08-07.json'

const RETITLES = [
  {
    id: 13397,
    expect: { title: 'On the', slug: 'on-the' },
    set: {
      title:
        'On the "Border of Civilizations": Pages of the History of the Pre-War Soviet-Polish Cordon in Belarus',
      first_published_year: 2020,
    },
  },
  {
    id: 18491,
    expect: { title: 'The Event', slug: 'the-event' },
    set: { title: 'Black Hammer, Vol. 2: The Event', first_published_year: null as number | null },
  },
]

type FieldFix = {
  id: number
  note: string
  expect: Record<string, string | number | null>
  set: Record<string, string | number | null>
}

const FIELD_FIXES: FieldFix[] = [
  {
    id: 17734,
    note: 'Will (Maria Boyd) — namesake contamination (Twelfth Night OL id, Signet ISBN, politician bio)',
    expect: {
      isbn13: '9780451502933',
      openlibrary_work_id: 'OL362694W',
      first_published_year: 1734,
    },
    set: {
      isbn13: null,
      openlibrary_work_id: null,
      description_book: null,
      first_published_year: 2006,
    },
  },
  {
    id: 6166,
    note: 'Health (McGraw Hill) — wiki wrong-article description (Grand Rapids Medical Mile)',
    expect: { openlibrary_work_id: 'OL35168424W' },
    set: { description_book: null },
  },
  {
    id: 2563,
    note: 'The Gathering (Kelley Armstrong) — ban year stamped as pub year',
    expect: { first_published_year: 2025 },
    set: { first_published_year: 2011 },
  },
  {
    id: 3917,
    note: 'Target (K.J. Johnson) — ban year stamped as pub year',
    expect: { first_published_year: 2025 },
    set: { first_published_year: 2003 },
  },
]

const DELETE_IDS = [10449, 10970, 11165, 11465]

async function getBook(id: number) {
  const { data, error } = await db
    .from('books')
    .select(
      'id, title, slug, isbn13, openlibrary_work_id, first_published_year, description_book',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

async function main() {
  const backup: Record<string, unknown> = { plannedAt: '2026-08-07' }
  let retitled = 0
  let cleaned = 0

  // --- RETITLE ---
  for (const fix of RETITLES) {
    const book = await getBook(fix.id)
    if (!book) {
      console.log(`⚠ #${fix.id}: not found, skipping`)
      continue
    }
    if (book.title !== fix.expect.title || book.slug !== fix.expect.slug) {
      console.log(`⚠ #${fix.id}: state changed (title="${book.title}", slug=${book.slug}) — guard blocks write`)
      continue
    }
    const newSlug = slugify(fix.set.title)
    console.log(`RETITLE #${fix.id}: "${book.title}" → "${fix.set.title}"`)
    console.log(`         slug ${book.slug} → ${newSlug} (+ alias for old slug)`)
    backup[`retitle_${fix.id}`] = book
    if (APPLY) {
      const patch: Record<string, unknown> = { title: fix.set.title, slug: newSlug }
      if (fix.set.first_published_year !== null) {
        patch.first_published_year = fix.set.first_published_year
      }
      const { error: e1 } = await db.from('books').update(patch).eq('id', fix.id)
      if (e1) throw e1
      // Old slug must keep resolving: 308 via book_slug_aliases (page.tsx fallback).
      const { error: e2 } = await db
        .from('book_slug_aliases')
        .upsert(
          { slug: fix.expect.slug, book_id: fix.id, source: 'legacy_slug' },
          { onConflict: 'slug' },
        )
      if (e2) throw e2
      retitled++
    }
  }

  // --- CLEAN ---
  for (const fix of FIELD_FIXES) {
    const book = await getBook(fix.id)
    if (!book) {
      console.log(`⚠ #${fix.id}: not found, skipping`)
      continue
    }
    const rec = book as unknown as Record<string, string | number | null>
    const mismatch = Object.entries(fix.expect).find(([k, v]) => rec[k] !== v)
    if (mismatch) {
      console.log(`⚠ #${fix.id}: guard mismatch on ${mismatch[0]} (now ${rec[mismatch[0]]}) — skipping`)
      continue
    }
    console.log(`CLEAN   #${fix.id}: ${fix.note}`)
    for (const [k, v] of Object.entries(fix.set)) console.log(`         ${k}: ${rec[k] === undefined ? '?' : JSON.stringify(rec[k])} → ${JSON.stringify(v)}`)
    backup[`clean_${fix.id}`] = book
    if (APPLY) {
      const { error } = await db.from('books').update(fix.set).eq('id', fix.id)
      if (error) throw error
      cleaned++
    }
  }

  // Special case #3917: strip the "----------" cruft prefix, keep the rest.
  {
    const book = await getBook(3917)
    if (book?.description_book?.startsWith('----------')) {
      const trimmed = book.description_book.replace(/^-{4,}\s*/, '')
      console.log(`CLEAN   #3917: strip "----------" prefix off description_book`)
      backup['desc_3917'] = book.description_book
      if (APPLY) {
        const { error } = await db
          .from('books')
          .update({ description_book: trimmed })
          .eq('id', 3917)
          .eq('description_book', book.description_book)
        if (error) throw error
      }
    }
  }

  // --- DELETE (periodicals) ---
  const { data: delBooks, error: e3 } = await db
    .from('books')
    .select('*')
    .in('id', DELETE_IDS)
  if (e3) throw e3
  const { data: delBans, error: e4 } = await db
    .from('bans')
    .select('*')
    .in('book_id', DELETE_IDS)
  if (e4) throw e4
  console.log(`\nDELETE (periodicals): ${delBooks?.length ?? 0} books, ${delBans?.length ?? 0} bans (cascade)`)
  for (const b of delBooks ?? []) console.log(`  #${b.id} "${b.title}" (${b.slug})`)
  backup['deleted_books'] = delBooks
  backup['deleted_bans'] = delBans

  writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  console.log(`\nBackup written: ${BACKUP}`)

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.')
    return
  }

  const { error: e5 } = await db.from('books').delete().in('id', DELETE_IDS)
  if (e5) throw e5

  console.log(`\nApplied: ${retitled} retitled (+aliases), ${cleaned} cleaned, ${delBooks?.length ?? 0} deleted.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
