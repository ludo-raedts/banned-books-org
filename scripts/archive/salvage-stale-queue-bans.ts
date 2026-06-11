#!/usr/bin/env tsx
/**
 * One-off salvage of the 37 stale `import_review_queue` rows from the
 * 2026-05-14 single-pass Wikipedia batch.
 *
 * Triage (see chat 2026-05-31): of the 37 pending rows, 23 are non-books
 * (NZ periodicals/newspapers/collective bans + duplicates), 2 are too thin to
 * keep (#109, #638), and 12 are classics ALREADY in the catalogue. A ban-check
 * across those 12 found exactly 4 missing, attributable ban-events worth
 * keeping — added below. Everything else is dropped; afterwards every pending
 * row is marked `rejected` so the "37 pending" badge clears and the queue path
 * goes idle (audit trail preserved, no hard delete).
 *
 * Idempotent: skips a ban-add when a ban for (book, country) already exists.
 * Dry-run by default; pass --apply to write.
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook, type AddBanInput } from '../src/lib/imports/review-commit'
import { createClient } from '@supabase/supabase-js'
import type { Client } from 'pg'

const APPLY = process.argv.includes('--apply')

const WIKI_GOV = 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments'
const WIKI_IRAN = 'https://en.wikipedia.org/wiki/Book_censorship_in_Iran#Books_banned_in_Iran'

type Salvage = {
  slug: string
  ban: Omit<AddBanInput, 'book_id' | 'year'> & { year: number | null }
}

const SALVAGE: Salvage[] = [
  {
    slug: 'lolita',
    ban: {
      country_code: 'CA',
      scope_slug: 'government',
      action_type: 'banned',
      ban_status: 'historical', // lifted late 1958 — year_ended patched below
      year: 1956,
      reason_slug: 'obscenity',
      description_ban:
        'Banned in Canada in 1956; not enforced on imports of the U.S. Putnam edition, and lifted in late 1958.',
      source_url: `${WIKI_GOV}#Canada`,
      source_name: 'List of books banned by governments (Wikipedia)',
      source_type: 'wikipedia',
    },
  },
  {
    slug: 'rangila-rasul',
    ban: {
      country_code: 'BD',
      scope_slug: 'government',
      action_type: 'banned',
      ban_status: 'active',
      year: null,
      reason_slug: 'religious',
      description_ban: 'Currently banned in India, Pakistan, and Bangladesh.',
      source_url: `${WIKI_GOV}#Bangladesh`,
      source_name: 'List of books banned by governments (Wikipedia)',
      source_type: 'wikipedia',
    },
  },
  {
    slug: 'rangila-rasul',
    ban: {
      country_code: 'PK',
      scope_slug: 'government',
      action_type: 'banned',
      ban_status: 'active',
      year: null,
      reason_slug: 'religious',
      description_ban: 'Currently banned in India, Pakistan, and Bangladesh.',
      source_url: `${WIKI_GOV}#Bangladesh`,
      source_name: 'List of books banned by governments (Wikipedia)',
      source_type: 'wikipedia',
    },
  },
  {
    slug: 'the-social-contract',
    ban: {
      country_code: 'IR',
      scope_slug: 'government',
      action_type: 'banned',
      ban_status: 'active',
      year: null,
      reason_slug: 'political',
      description_ban: null,
      source_url: WIKI_IRAN,
      source_name: 'Book censorship in Iran (Wikipedia)',
      source_type: 'wikipedia',
    },
  },
]

async function bookId(pg: Client, slug: string): Promise<number | null> {
  const r = await pg.query('select id from books where slug = $1', [slug])
  return r.rows.length ? (r.rows[0].id as number) : null
}

async function hasCountryBan(pg: Client, id: number, cc: string): Promise<boolean> {
  const r = await pg.query(
    'select 1 from bans where book_id = $1 and country_code = $2 limit 1',
    [id, cc],
  )
  return r.rows.length > 0
}

async function main() {
  console.log(`\n=== Salvage stale queue bans ${APPLY ? '(APPLY)' : '(DRY-RUN)'} ===\n`)
  const pg = newPgClient()
  await pg.connect()
  let added = 0

  try {
    for (const s of SALVAGE) {
      const id = await bookId(pg, s.slug)
      if (id === null) {
        console.log(`  [skip] ${s.slug}: book not found`)
        continue
      }
      if (await hasCountryBan(pg, id, s.ban.country_code)) {
        console.log(`  [skip] ${s.slug} ${s.ban.country_code}: a ban for this country already exists`)
        continue
      }
      console.log(
        `  [add ] ${s.slug} ${s.ban.country_code} ${s.ban.year ?? 'n/a'} ` +
        `(${s.ban.action_type}/${s.ban.ban_status}/${s.ban.reason_slug})`,
      )
      if (!APPLY) continue

      const res = await commitNewBanForBook(
        { book_id: id, ...s.ban, year: s.ban.year as number },
        pg,
      )
      added++
      // commitNewBanForBook hard-codes year_ended=null; patch Lolita's 1958 lift.
      if (s.slug === 'lolita' && s.ban.country_code === 'CA' && res.created) {
        await pg.query('update bans set year_ended = 1958 where id = $1', [res.ban_id])
        console.log(`         year_ended=1958 patched (ban id ${res.ban_id})`)
      }
    }
  } finally {
    await pg.end()
  }

  // Clear the queue: mark every pending row rejected.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { count } = await sb
    .from('import_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review')
  console.log(`\n  ${count ?? 0} pending rows to reject`)
  if (APPLY) {
    const { error } = await sb
      .from('import_review_queue')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'salvage-stale-queue-bans',
        review_notes:
          'Stale 2026-05-14 single-pass batch. 4 ban-events salvaged to existing books (lolita/CA, rangila-rasul/BD+PK, the-social-contract/IR); remainder were non-books (periodicals, collective bans), duplicates, or too thin.',
      })
      .eq('status', 'pending_review')
    if (error) {
      console.error('  reject update failed:', error.message)
      process.exit(1)
    }
    console.log('  all pending rows marked rejected')
  }

  console.log(`\nDone. ${APPLY ? `${added} bans added.` : 'Dry-run — no writes.'}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
