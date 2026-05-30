#!/usr/bin/env tsx
/**
 * Import title-specific book restrictions from
 * data/africa-criminalization-bans.json (African states that criminalise
 * homosexuality). Each entry is one book + one ban event.
 *
 * Per entry:
 *   - Resolve an existing book by exact slug (books.slug, then
 *     book_slug_aliases.slug). If found, the event is ADDED via
 *     commitNewBanForBook() — idempotent on (book_id, country, year, scope),
 *     so re-runs are safe.
 *   - If no existing book, create book + ban via commitParsedRow().
 *
 * Entries with needs_review=true are SKIPPED on --apply (shown in dry-run
 * only); fix them in the JSON, then re-run.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-africa-criminalization-bans.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-africa-criminalization-bans.ts --apply
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'
import { slugify } from '../src/lib/imports/slugify'

type Entry = {
  title: string
  authors: string[]
  first_published_year: number | null
  original_language: string | null
  country_code: string
  ban_year: number
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  reason_slug: string
  ban_status: 'active' | 'historical'
  description_ban: string
  inclusion_rationale: string
  source_url: string
  source_name: string
  source_type: string
  needs_review: boolean
}

type Meta = { note?: string; source_type?: string }

const APPLY = process.argv.includes('--apply')
const FILE = resolve(__dirname, '../data/africa-criminalization-bans.json')

async function resolveExistingBook(pg: Client, slug: string): Promise<number | null> {
  const direct = await pg.query<{ id: number }>('select id from books where slug = $1', [slug])
  if (direct.rows.length > 0) return direct.rows[0].id
  const alias = await pg.query<{ book_id: number }>(
    'select book_id from book_slug_aliases where slug = $1',
    [slug],
  )
  if (alias.rows.length > 0) return alias.rows[0].book_id
  return null
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { meta: Meta; entries: Entry[] }
  const entries = raw.entries

  const pg = newPgClient()
  await pg.connect()

  let createdBooks = 0
  let createdBans = 0
  let addedBans = 0
  let reusedBans = 0
  let skipped = 0

  try {
    for (const e of entries) {
      const slug = slugify(e.title)
      if (!slug) throw new Error(`slugify produced empty slug for '${e.title}'`)

      const existingId = await resolveExistingBook(pg, slug)
      const flag = e.needs_review ? ' ⚠needs_review' : ''
      const where = existingId ? `EXISTS book_${existingId}` : 'NEW book'
      console.log(
        `\n${e.title} [${slug}] — ${where}\n   ${e.country_code} ${e.ban_year} ${e.scope_slug}/${e.action_type}/${e.reason_slug}${flag}`,
      )

      if (e.needs_review) {
        skipped++
        if (APPLY) console.log('   skipped (needs_review)')
        continue
      }
      if (!APPLY) {
        if (!existingId) createdBooks++
        continue
      }

      if (existingId) {
        const add: AddBanInput = {
          book_id: existingId,
          country_code: e.country_code,
          scope_slug: e.scope_slug,
          action_type: e.action_type,
          ban_status: e.ban_status,
          year: e.ban_year,
          reason_slug: e.reason_slug,
          description_ban: e.description_ban,
          source_url: e.source_url,
          source_name: e.source_name,
          source_type: e.source_type,
        }
        const res = await commitNewBanForBook(add, pg)
        if (res.created) {
          addedBans++
          console.log(`   + added ban_${res.ban_id}`)
        } else {
          reusedBans++
          console.log(`   = reused ban_${res.ban_id} (idempotent)`)
        }
        continue
      }

      const input: CommitInput = {
        title: e.title,
        authors: e.authors,
        original_language: e.original_language,
        year: e.ban_year,
        first_published_year: e.first_published_year,
        country_code: e.country_code,
        scope_slug: e.scope_slug,
        action_type: e.action_type,
        ban_status: e.ban_status,
        reason_slug: e.reason_slug,
        description_ban: e.description_ban,
        inclusion_rationale: e.inclusion_rationale,
        source_url: e.source_url,
        source_name: e.source_name,
        source_type: e.source_type,
      }
      const res = await commitParsedRow(input, pg)
      createdBooks++
      createdBans++
      console.log(`   + created book_${res.book_id} + ban_${res.ban_ids[0]}`)
    }

    if (!APPLY) {
      console.log(
        `\nDry-run complete. ${entries.length} entries (${createdBooks} new books would be created, ${skipped} skipped for review). Re-run with --apply.`,
      )
      return
    }
    console.log(
      `\nDone. Books created: ${createdBooks}. Bans: ${createdBans} new + ${addedBans} added + ${reusedBans} reused. Skipped (needs_review): ${skipped}.`,
    )
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
