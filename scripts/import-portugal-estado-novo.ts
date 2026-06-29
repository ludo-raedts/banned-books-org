#!/usr/bin/env tsx
/**
 * Import Portugal / Estado Novo banned books from the Stap-0 seed
 * (data/portugal-estado-novo-<date>.json, built by
 * scripts/build-portugal-estado-novo-stage0.ts). Source = José Brandão,
 * "Livros Proibidos nos Anos da Ditadura de 1933 a 1974".
 *
 * Per row, with AUTHOR-VERIFIED match-before-create (the dedup safety):
 *   1. Resolve an existing book by the Portuguese-title slug (books.slug, then
 *      book_slug_aliases). If found AND its author agrees → ADD the ban
 *      (commitNewBanForBook, idempotent on book/country/year/scope).
 *   2. Else, if the row has a QA'd English work title, resolve by the
 *      English-title slug (Option A cross-language match) — again only MERGE
 *      when the author agrees. This catches a book already in the catalogue
 *      under its English title (e.g. "O Amante de Lady Chatterley" →
 *      lady-chatterley-s-lover).
 *   3. Else CREATE a new book + ban (commitParsedRow). If the Portuguese slug
 *      collides with a DIFFERENT-author book (e.g. three distinct "Lenine"),
 *      disambiguate the slug with the author surname so books.slug stays UNIQUE
 *      and the two works don't get wrongly merged.
 *
 * Author agreement is STRICT (normalized full-name or surname≥4 equality):
 * a missed cross-language match just yields a duplicate that the mandatory
 * post-import dupe sweep (scripts/README.md Stap 4) catches — far safer than a
 * wrong merge.
 *
 * Year doctrine: bans.year_started is NOT NULL, but Brandão's DATA is an
 * edition-OR-ban year. Per the recorded decision we use it as the ban year and
 * state the caveat in description_ban; books.first_published_year is left null
 * pending per-title PORBASE/BNP verification.
 *
 * Collective/anthology rows (author "Vários"/"Colectivo") are attached to the
 * canonical placeholder author "Various Authors" (id 455, slug 'various-authors').
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-portugal-estado-novo.ts                                   # dry-run (default seed = today)
 *   pnpm tsx --env-file=.env.local scripts/import-portugal-estado-novo.ts data/portugal-estado-novo-2026-06-28.json
 *   pnpm tsx --env-file=.env.local scripts/import-portugal-estado-novo.ts <seed> --apply
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

type SeedRow = {
  source_row_n: number
  title: string
  title_pt_raw: string
  title_english_meaningful: string | null
  authors: string[]
  author_raw: string
  author_collective: boolean
  country_code: string
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  reason_slug: string
  special_prohibition: boolean
  publisher: string | null
  source_data_year: number
  source_name: string
  source_url: string
}

const COLLECTIVE_AUTHOR = 'Various Authors' // canonical placeholder author (id 455, slug 'various-authors')
const SOURCE_TYPE = 'compilation'
const BAN_STATUS = 'historical' as const
const INCLUSION_RATIONALE =
  "Listed in José Brandão's compilation \"Livros Proibidos nos Anos da Ditadura de 1933 a 1974\", " +
  'the largest catalogue of books prohibited in Portugal under the Estado Novo censorship ' +
  '(prior censorship of books instituted by Decreto n.º 22 469 of 11 April 1933).'

const APPLY = process.argv.includes('--apply')
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const today = new Date().toISOString().slice(0, 10)
const FILE = resolve(__dirname, '..', fileArg ?? `data/portugal-estado-novo-${today}.json`)

function banDescription(r: SeedRow): string {
  let d =
    'Banned in Portugal under the Estado Novo censorship regime. Listed in José Brandão\'s ' +
    'compilation of books prohibited between 1933 and 1974 (prior censorship of books ' +
    'instituted by Decreto n.º 22 469 of 11 April 1933).'
  if (r.special_prohibition) {
    d +=
      ' Marked with a special prohibition that varied between the Metrópole and the Colónias, ' +
      'or whose censorship status changed over time.'
  }
  d +=
    ` The year (${r.source_data_year}) is Brandão's recorded "data da edição ou da proibição" ` +
    '(edition or prohibition year, not disambiguated) and is pending per-title verification ' +
    'against PORBASE/BNP.'
  return d
}

const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

function authorsAgree(rowAuthors: string[], bookAuthors: string[]): boolean {
  for (const ra of rowAuthors) {
    const a = normName(ra)
    if (!a) continue
    const aLast = a.split(' ').filter(Boolean).pop() ?? a
    for (const ba of bookAuthors) {
      const b = normName(ba)
      if (!b) continue
      if (a === b) return true
      const bLast = b.split(' ').filter(Boolean).pop() ?? b
      if (aLast.length >= 4 && aLast === bLast) return true
    }
  }
  return false
}

// Books created earlier in THIS run, keyed by their final slug. Lets the
// dry-run faithfully preview in-seed slug collisions (three distinct "Lenine"
// books, same-author re-listings collapsing) that the DB alone can't show
// because nothing is committed in dry-run. In apply mode it also saves a
// round-trip and keeps behaviour identical to dry-run.
type Known = { id: number; authors: string[] }
const runLedger = new Map<string, Known>()
let synthId = 0 // negative synthetic ids for dry-run-created books

async function dbLookup(pg: Client, slug: string): Promise<number | null> {
  const direct = await pg.query<{ id: number }>('select id from books where slug = $1', [slug])
  if (direct.rows.length > 0) return direct.rows[0].id
  const alias = await pg.query<{ book_id: number }>(
    'select book_id from book_slug_aliases where slug = $1',
    [slug],
  )
  return alias.rows.length > 0 ? alias.rows[0].book_id : null
}

async function bookAuthorNames(pg: Client, bookId: number): Promise<string[]> {
  const res = await pg.query<{ display_name: string }>(
    `select a.display_name
       from book_authors ba join authors a on a.id = ba.author_id
      where ba.book_id = $1`,
    [bookId],
  )
  return res.rows.map((r) => r.display_name)
}

// Unified resolution: in-run ledger first, then the DB.
async function lookupBySlug(pg: Client, slug: string): Promise<Known | null> {
  const fromRun = runLedger.get(slug)
  if (fromRun) return fromRun
  const id = await dbLookup(pg, slug)
  if (id === null) return null
  return { id, authors: await bookAuthorNames(pg, id) }
}

async function slugFree(pg: Client, slug: string): Promise<boolean> {
  return !runLedger.has(slug) && (await dbLookup(pg, slug)) === null
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { rows: SeedRow[]; source_name: string; source_url: string }
  const rows = raw.rows
  console.log(`\n── Portugal Estado Novo import ── ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${rows.length} seed rows`)

  const pg = newPgClient()
  await pg.connect()

  let createdBooks = 0
  let createdBans = 0
  let mergedPt = 0
  let mergedEn = 0
  let reusedBans = 0
  let disambiguated = 0
  let skipped = 0

  try {
    for (const r of rows) {
      const authors = r.author_collective || r.authors.length === 0 ? [COLLECTIVE_AUTHOR] : r.authors
      const ptSlug = slugify(r.title)
      if (!ptSlug) {
        skipped++
        console.log(`\n[${r.source_row_n}] ${r.title} — SKIP (empty slug)`)
        continue
      }

      // 1. Portuguese-title slug, author-verified
      let mergeId: number | null = null
      let mergeKind: 'pt' | 'en' | null = null
      const ptHit = await lookupBySlug(pg, ptSlug)
      if (ptHit && authorsAgree(authors, ptHit.authors)) {
        mergeId = ptHit.id
        mergeKind = 'pt'
      }

      // 2. English-title slug (Option A cross-language), author-verified
      if (!mergeId && r.title_english_meaningful) {
        const enSlug = slugify(r.title_english_meaningful)
        if (enSlug) {
          const enHit = await lookupBySlug(pg, enSlug)
          if (enHit && authorsAgree(authors, enHit.authors)) {
            mergeId = enHit.id
            mergeKind = 'en'
          }
        }
      }

      if (mergeId) {
        if (mergeKind === 'en') mergedEn++
        else mergedPt++
        console.log(
          `\n[${r.source_row_n}] ${r.title} — MERGE→book_${mergeId} (${mergeKind === 'en' ? 'cross-lang: ' + r.title_english_meaningful : 'pt-slug'})`,
        )
        if (!APPLY) continue
        const add: AddBanInput = {
          book_id: mergeId,
          country_code: r.country_code,
          scope_slug: r.scope_slug,
          action_type: r.action_type,
          ban_status: BAN_STATUS,
          year: r.source_data_year,
          reason_slug: r.reason_slug,
          description_ban: banDescription(r),
          source_url: r.source_url,
          source_name: r.source_name,
          source_type: SOURCE_TYPE,
        }
        const res = await commitNewBanForBook(add, pg)
        if (res.created) { createdBans++; console.log(`   + ban_${res.ban_id}`) }
        else { reusedBans++; console.log(`   = reused ban_${res.ban_id}`) }
        continue
      }

      // 3. NEW book — disambiguate the slug if it collides with a different book.
      let overrideSlug: string | null = null
      if (!(await slugFree(pg, ptSlug))) {
        const lastSlug = slugify(authors[0]?.split(' ').filter(Boolean).pop() ?? '') || 'x'
        let cand = `${ptSlug}-${lastSlug}`
        let n = 2
        while (!(await slugFree(pg, cand))) { cand = `${ptSlug}-${lastSlug}-${n++}` }
        overrideSlug = cand
        disambiguated++
      }

      console.log(
        `\n[${r.source_row_n}] ${r.title} — NEW book${overrideSlug ? ` [slug=${overrideSlug}]` : ''}` +
          `\n   ${r.country_code} ${r.source_data_year} ${r.scope_slug}/${r.action_type}/${r.reason_slug}` +
          `${r.special_prohibition ? ' ✱special' : ''}${r.title_english_meaningful ? `  en="${r.title_english_meaningful}"` : ''}` +
          `  author=${authors.join('/')}`,
      )
      const finalSlug = overrideSlug ?? ptSlug
      if (!APPLY) {
        createdBooks++
        createdBans++
        runLedger.set(finalSlug, { id: --synthId, authors })
        continue
      }

      const input: CommitInput = {
        title: r.title,
        title_english_meaningful: r.title_english_meaningful,
        slug_override: overrideSlug,
        authors,
        original_language: null,
        year: r.source_data_year,
        first_published_year: null,
        country_code: r.country_code,
        scope_slug: r.scope_slug,
        action_type: r.action_type,
        ban_status: BAN_STATUS,
        reason_slug: r.reason_slug,
        description_ban: banDescription(r),
        inclusion_rationale: INCLUSION_RATIONALE,
        source_url: r.source_url,
        source_name: r.source_name,
        source_type: SOURCE_TYPE,
      }
      const res = await commitParsedRow(input, pg)
      createdBooks++
      createdBans++
      runLedger.set(finalSlug, { id: res.book_id, authors })
      console.log(`   + book_${res.book_id} + ban_${res.ban_ids[0]}`)
    }

    const tail =
      `\n${APPLY ? 'Done' : 'Dry-run complete'}. ` +
      `New books: ${createdBooks}, new bans: ${createdBans}. ` +
      `Merged: ${mergedPt} pt-slug + ${mergedEn} cross-lang (${reusedBans} idempotent reuse). ` +
      `Disambiguated slugs: ${disambiguated}. Skipped: ${skipped}.` +
      (APPLY ? '' : '\nRe-run with --apply.')
    console.log(tail)
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
