#!/usr/bin/env tsx
/**
 * Import historical government/authority book bans from the University of
 * Kansas Library exhibition "He who destroyes a good Booke, kills reason it
 * selfe" (1955), extracted into data/ku-spencer-bans.json.
 *
 * Match-or-create per book (grouped by title slug):
 *   - Resolve an existing book by exact slug (books.slug, then
 *     book_slug_aliases.slug). If found, every event in the group is ADDED as
 *     a new ban on that book via commitNewBanForBook() — idempotent on
 *     (book_id, country, year, scope), so re-runs are safe.
 *   - If no existing book, the first event creates book+ban via
 *     commitParsedRow(); the remaining events in the group attach to the new
 *     book_id via commitNewBanForBook(). On a second run the book now matches
 *     by slug, so it falls into the ADD path — no duplicate books.
 *
 * Fuzzy candidates (pg_trgm similarity >= 0.55) are SURFACED in the dry-run
 * for the no-exact-match groups, but are NEVER auto-attached — the project's
 * review-gate doctrine requires a human to confirm a fuzzy book identity.
 * Inspect those, and if one is a real duplicate, add an alias (or rename the
 * JSON title to the canonical) before --apply.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-ku-spencer-json.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-ku-spencer-json.ts --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'
import type { Client } from 'pg'

type Entry = {
  title: string
  author: string
  first_published_year: number | null
  country_code: string
  ban_year: number
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  reason_slug: string
  ban_status: 'active' | 'historical'
  ku_page: string
  description_ban: string
  needs_review: boolean
}

type Meta = {
  source_name: string
  source_type: string
  source_pages: Record<string, string>
}

const APPLY = process.argv.includes('--apply')
const FUZZY_THRESHOLD = 0.55

const FILE = resolve(__dirname, '../data/ku-spencer-bans.json')

function sourceUrl(meta: Meta, kuPage: string): string {
  const url = meta.source_pages[kuPage]
  if (!url) throw new Error(`No source_pages url for ku_page='${kuPage}'`)
  return url
}

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

async function fuzzyCandidates(pg: Client, title: string): Promise<string[]> {
  try {
    const r = await pg.query<{ title: string; slug: string; score: number }>(
      `select title, slug, similarity(title, $1) as score
         from books
        where similarity(title, $1) >= $2
        order by score desc limit 3`,
      [title, FUZZY_THRESHOLD],
    )
    return r.rows.map((x) => `${x.title} [${x.slug}] (${Number(x.score).toFixed(2)})`)
  } catch {
    return []
  }
}

async function isBlocked(pg: Client, slug: string): Promise<boolean> {
  try {
    const r = await pg.query('select 1 from blocked_works where slug = $1', [slug])
    return r.rows.length > 0
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { meta: Meta; entries: Entry[] }
  const meta = raw.meta
  const entries = raw.entries

  // Group by book slug (multi-jurisdiction titles share a group).
  const groups = new Map<string, Entry[]>()
  for (const e of entries) {
    const slug = slugify(e.title)
    if (!slug) throw new Error(`slugify produced empty slug for title '${e.title}'`)
    const arr = groups.get(slug) ?? []
    arr.push(e)
    groups.set(slug, arr)
  }

  console.log(
    `\nKU Spencer import — ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${entries.length} ban-events across ${groups.size} books\n`,
  )

  const pg = newPgClient()
  await pg.connect()

  let createdBooks = 0
  let createdBans = 0
  let addedBans = 0
  let reusedBans = 0
  let blockedCount = 0
  const fuzzyWarnings: string[] = []

  try {
    for (const [slug, group] of groups) {
      if (await isBlocked(pg, slug)) {
        console.log(`  BLOCKED (CSAM policy) — skipping '${group[0].title}' [${slug}]`)
        blockedCount += group.length
        continue
      }

      let bookId = await resolveExistingBook(pg, slug)
      const matched = bookId !== null
      const head = group[0]
      const label = `${head.author} — ${head.title} [${slug}]`

      if (!matched) {
        const cands = await fuzzyCandidates(pg, head.title)
        if (cands.length > 0) {
          fuzzyWarnings.push(`  '${head.title}' [${slug}] → fuzzy: ${cands.join(' | ')}`)
        }
      }

      console.log(
        `${matched ? 'MATCH ' : 'CREATE'}  ${label}  (${group.length} event${group.length > 1 ? 's' : ''})`,
      )
      for (const e of group) {
        const flag = e.needs_review ? ' ⚠needs_review' : ''
        console.log(
          `         ${e.country_code} ${e.ban_year} ${e.scope_slug}/${e.action_type}/${e.reason_slug}${flag}`,
        )
      }

      if (!APPLY) {
        if (!matched) createdBooks++
        continue
      }

      // APPLY ----------------------------------------------------------------
      if (!matched) {
        const first = group[0]
        const input: CommitInput = {
          title: first.title,
          authors: [first.author],
          year: first.ban_year,
          first_published_year: first.first_published_year,
          country_code: first.country_code,
          scope_slug: first.scope_slug,
          action_type: first.action_type,
          ban_status: first.ban_status,
          reason_slug: first.reason_slug,
          description_ban: first.description_ban,
          inclusion_rationale: `Documented in the University of Kansas Library exhibition "He who destroyes a good Booke, kills reason it selfe" (1955). ${first.description_ban}`,
          source_url: sourceUrl(meta, first.ku_page),
          source_name: meta.source_name,
          source_type: meta.source_type,
        }
        const res = await commitParsedRow(input, pg)
        bookId = res.book_id
        createdBooks++
        createdBans++
        console.log(`         + created book_${bookId} + ban_${res.ban_ids[0]}`)
      }

      const restStart = matched ? 0 : 1
      for (let i = restStart; i < group.length; i++) {
        const e = group[i]
        const add: AddBanInput = {
          book_id: bookId as number,
          country_code: e.country_code,
          scope_slug: e.scope_slug,
          action_type: e.action_type,
          ban_status: e.ban_status,
          year: e.ban_year,
          reason_slug: e.reason_slug,
          description_ban: e.description_ban,
          source_url: sourceUrl(meta, e.ku_page),
          source_name: meta.source_name,
          source_type: meta.source_type,
        }
        const res = await commitNewBanForBook(add, pg)
        if (res.created) addedBans++
        else reusedBans++
        console.log(`         ${res.created ? '+ added' : '= reused'} ban_${res.ban_id}  ${e.country_code} ${e.ban_year}`)
      }
    }

    if (fuzzyWarnings.length > 0) {
      console.log(`\nFUZZY CANDIDATES (no exact match — review before --apply, NOT auto-attached):`)
      for (const w of fuzzyWarnings) console.log(w)
    }

    if (!APPLY) {
      console.log(
        `\nDry-run complete. ${groups.size} books (${createdBooks} would be created, ${groups.size - createdBooks} matched), ${entries.length} ban-events. Re-run with --apply.`,
      )
      return
    }

    console.log(
      `\nDone. Books created: ${createdBooks}. Bans: ${createdBans} via new book + ${addedBans} added + ${reusedBans} reused (idempotent). Blocked: ${blockedCount}.`,
    )
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
