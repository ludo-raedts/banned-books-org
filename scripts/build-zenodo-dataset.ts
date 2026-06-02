#!/usr/bin/env tsx
/**
 * Build the OPEN, citeable dataset for deposit on Zenodo (CC-BY-4.0).
 *
 * This is deliberately NOT the same export as the paid commercial ZIP
 * (scripts/build-dataset.ts). The open version is the *verifiable censorship
 * core*: the structured facts about who banned what, where, when, why, and on
 * whose authority — plus the source citations that let a researcher check each
 * one. The paid version keeps the editorial prose, convenience formats
 * (SQLite/JSON), and enrichment (ISBNs, covers, descriptions, bios).
 *
 * The principle: facts about censorship are open; editorial prose and
 * convenience formats are paid. The reason TAXONOMY (slug) is open; the written
 * description_ban paragraph is paid.
 *
 * Output (CSV only, all join keys resolved to public slugs):
 *   books.csv        slug, title, first_published_year, original_language, author_slugs
 *   authors.csv      slug, display_name, birth_country
 *   bans.csv         ban_id, book_slug, country_code, year_started, year_ended,
 *                    action_type, status, scope
 *   ban_reasons.csv  ban_id, reason_slug, reason_label
 *   ban_sources.csv  ban_id, source_name, source_url, source_type,
 *                    verification_status, accessed_at, locator
 *   countries.csv    code, name_en
 * plus schema.json (machine-readable column types + joins), README.md, LICENSE.txt.
 *
 * Usage:
 *   pnpm tsx scripts/build-zenodo-dataset.ts          # dry-run: counts only, writes nothing
 *   pnpm tsx scripts/build-zenodo-dataset.ts --apply  # write private/zenodo/
 *
 * Idempotent: --apply wipes and recreates the output dir each run.
 *
 * The actual Zenodo deposit (account, metadata form, publish, DOI capture) is a
 * manual browser step. This script only produces the files.
 */

import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchAll, writeCsv, makeAdminClient, type Row } from './lib/dataset-io'

const ROOT = process.cwd()
const OUTPUT_DIR = join(ROOT, 'private', 'zenodo')
const APPLY = process.argv.includes('--apply')

// ─── Source columns pulled from Supabase (OPEN fields only) ───────────────────
// Anything not listed here is never read: no isbn13, no cover_url, no
// description_*, no bios, no photo_url, no enrichment. The split is enforced by
// omission — paid-only columns simply don't appear below.
const SRC_BOOK_COLUMNS    = ['id', 'slug', 'title', 'first_published_year', 'original_language'] as const
const SRC_AUTHOR_COLUMNS  = ['id', 'slug', 'display_name', 'birth_country'] as const
const SRC_BAN_COLUMNS      = ['id', 'book_id', 'country_code', 'scope_id', 'action_type', 'status', 'year_started', 'year_ended'] as const
const SRC_COUNTRY_COLUMNS = ['code', 'name_en'] as const
const SRC_REASON_COLUMNS  = ['id', 'slug', 'label_en'] as const
const SRC_SCOPE_COLUMNS   = ['id', 'slug'] as const
const SRC_SOURCE_COLUMNS  = ['id', 'source_name', 'source_url', 'source_type', 'verification_status', 'accessed_at'] as const

// ─── Output CSV schemas (the public, slug-keyed shape) ────────────────────────
const OUT_BOOKS       = ['slug', 'title', 'first_published_year', 'original_language', 'author_slugs'] as const
const OUT_AUTHORS     = ['slug', 'display_name', 'birth_country'] as const
const OUT_BANS         = ['ban_id', 'book_slug', 'country_code', 'year_started', 'year_ended', 'action_type', 'status', 'scope'] as const
const OUT_BAN_REASONS = ['ban_id', 'reason_slug', 'reason_label'] as const
const OUT_BAN_SOURCES = ['ban_id', 'source_name', 'source_url', 'source_type', 'verification_status', 'accessed_at', 'locator'] as const
const OUT_COUNTRIES   = ['code', 'name_en'] as const

async function main() {
  const startedAt = Date.now()
  console.log(`▸ Building Zenodo open dataset… ${APPLY ? '(--apply: will write files)' : '(dry-run: counts only)'}`)

  const supabase = makeAdminClient()

  console.log('  · Fetching from Supabase (open fields only)')
  const [
    books, authors, bookAuthors, bans, banReasonLinks, banSourceLinks,
    countries, reasons, scopes, sources,
  ] = await Promise.all([
    fetchAll(supabase, 'books',            SRC_BOOK_COLUMNS.join(','),    'id'),
    fetchAll(supabase, 'authors',          SRC_AUTHOR_COLUMNS.join(','),  'id'),
    fetchAll(supabase, 'book_authors',     'book_id, author_id',          'book_id,author_id'),
    fetchAll(supabase, 'bans',             SRC_BAN_COLUMNS.join(','),     'id'),
    fetchAll(supabase, 'ban_reason_links', 'ban_id, reason_id',           'ban_id,reason_id'),
    fetchAll(supabase, 'ban_source_links', 'ban_id, source_id, locator',  'ban_id,source_id'),
    fetchAll(supabase, 'countries',        SRC_COUNTRY_COLUMNS.join(','), 'code'),
    fetchAll(supabase, 'reasons',          SRC_REASON_COLUMNS.join(','),  'id'),
    fetchAll(supabase, 'scopes',           SRC_SCOPE_COLUMNS.join(','),   'id'),
    fetchAll(supabase, 'ban_sources',      SRC_SOURCE_COLUMNS.join(','),  'id'),
  ])

  // ─── Lookups ────────────────────────────────────────────────────────────────
  const bookSlugById   = new Map<string, string>()
  for (const b of books) if (b.slug) bookSlugById.set(String(b.id), String(b.slug))
  const authorSlugById = new Map<string, string>()
  for (const a of authors) if (a.slug) authorSlugById.set(String(a.id), String(a.slug))
  const scopeSlugById  = new Map<string, string>()
  for (const s of scopes) if (s.slug) scopeSlugById.set(String(s.id), String(s.slug))
  const reasonById     = new Map<string, Row>()
  for (const r of reasons) reasonById.set(String(r.id), r)
  const sourceById     = new Map<string, Row>()
  for (const s of sources) sourceById.set(String(s.id), s)

  // book_id → [author_slug, …] (sorted for deterministic output)
  const authorSlugsByBook = new Map<string, string[]>()
  for (const ba of bookAuthors) {
    const slug = authorSlugById.get(String(ba.author_id))
    if (!slug) continue
    const key = String(ba.book_id)
    const arr = authorSlugsByBook.get(key) ?? []
    arr.push(slug)
    authorSlugsByBook.set(key, arr)
  }
  for (const arr of authorSlugsByBook.values()) arr.sort()

  // ─── books.csv ────────────────────────────────────────────────────────────
  const outBooks: Row[] = books
    .filter((b) => b.slug)
    .map((b) => ({
      slug: b.slug,
      title: b.title,
      first_published_year: b.first_published_year,
      original_language: b.original_language,
      // pipe-separated, matching the repo CSV array convention; carries the
      // book↔author link so authors.csv is joinable without a separate table.
      author_slugs: authorSlugsByBook.get(String(b.id)) ?? [],
    }))

  // ─── authors.csv ──────────────────────────────────────────────────────────
  const outAuthors: Row[] = authors
    .filter((a) => a.slug)
    .map((a) => ({ slug: a.slug, display_name: a.display_name, birth_country: a.birth_country }))

  // ─── bans.csv ───────────────────────────────────────────────────────────────
  // Drop any ban whose book has no slug — referential integrity for the open set.
  const keptBanIds = new Set<string>()
  const outBans: Row[] = []
  for (const ban of bans) {
    const bookSlug = bookSlugById.get(String(ban.book_id))
    if (!bookSlug) continue
    keptBanIds.add(String(ban.id))
    outBans.push({
      ban_id: ban.id,
      book_slug: bookSlug,
      country_code: ban.country_code,
      year_started: ban.year_started,
      year_ended: ban.year_ended,
      action_type: ban.action_type,
      status: ban.status,
      scope: ban.scope_id ? (scopeSlugById.get(String(ban.scope_id)) ?? '') : '',
    })
  }

  // ─── ban_reasons.csv (the open taxonomy, per ban) ───────────────────────────
  const outBanReasons: Row[] = []
  for (const link of banReasonLinks) {
    if (!keptBanIds.has(String(link.ban_id))) continue
    const reason = reasonById.get(String(link.reason_id))
    if (!reason) continue
    outBanReasons.push({ ban_id: link.ban_id, reason_slug: reason.slug, reason_label: reason.label_en })
  }

  // ─── ban_sources.csv (citations, denormalised onto each ban) ────────────────
  const outBanSources: Row[] = []
  for (const link of banSourceLinks) {
    if (!keptBanIds.has(String(link.ban_id))) continue
    const src = sourceById.get(String(link.source_id))
    if (!src) continue
    outBanSources.push({
      ban_id: link.ban_id,
      source_name: src.source_name,
      source_url: src.source_url,
      source_type: src.source_type,
      verification_status: src.verification_status,
      accessed_at: src.accessed_at,
      locator: link.locator,
    })
  }

  // ─── countries.csv ────────────────────────────────────────────────────────
  const outCountries: Row[] = countries.map((c) => ({ code: c.code, name_en: c.name_en }))

  // ─── Report ──────────────────────────────────────────────────────────────
  const tables: Array<[string, readonly string[], Row[]]> = [
    ['books.csv',       OUT_BOOKS,       outBooks],
    ['authors.csv',     OUT_AUTHORS,     outAuthors],
    ['bans.csv',        OUT_BANS,        outBans],
    ['ban_reasons.csv', OUT_BAN_REASONS, outBanReasons],
    ['ban_sources.csv', OUT_BAN_SOURCES, outBanSources],
    ['countries.csv',   OUT_COUNTRIES,   outCountries],
  ]

  console.log('\n  Row counts per output table:')
  for (const [name, , rows] of tables) {
    console.log(`    ${name.padEnd(18)} ${rows.length.toLocaleString('en').padStart(8)}`)
  }
  // Distinct-entity sanity checks (NOT raw ban rows — see ranking doctrine).
  const distinctCountriesWithBans = new Set(outBans.map((b) => b.country_code)).size
  const distinctBooksWithBans     = new Set(outBans.map((b) => b.book_slug)).size
  console.log('\n  Distinct-entity checks (the canonical metrics):')
  console.log(`    distinct books with ≥1 ban      ${String(distinctBooksWithBans).padStart(8)}`)
  console.log(`    distinct countries with ≥1 ban  ${String(distinctCountriesWithBans).padStart(8)}`)
  console.log(`    raw ban rows (supporting only)  ${String(outBans.length).padStart(8)}`)

  const droppedBans = bans.length - outBans.length
  if (droppedBans > 0) {
    console.log(`\n  ! Dropped ${droppedBans} ban row(s) with no slugged book (referential-integrity filter).`)
  }

  if (!APPLY) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`\n✓ Dry-run complete in ${elapsed}s. Re-run with --apply to write ${OUTPUT_DIR}/`)
    return
  }

  // ─── Write ──────────────────────────────────────────────────────────────
  rmSync(OUTPUT_DIR, { recursive: true, force: true })
  mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log(`\n  · Writing CSVs to ${OUTPUT_DIR}`)
  await Promise.all(tables.map(([name, cols, rows]) => writeCsv(OUTPUT_DIR, name, cols, rows)))

  console.log('  · Writing schema.json')
  await writeFile(join(OUTPUT_DIR, 'schema.json'), JSON.stringify(buildSchema(), null, 2), 'utf8')

  console.log('  · Writing README.md + LICENSE.txt')
  await writeFile(
    join(OUTPUT_DIR, 'README.md'),
    readme({
      books: outBooks.length,
      bans: outBans.length,
      sources: outBanSources.length,
      distinctBooksWithBans,
      distinctCountriesWithBans,
    }),
    'utf8',
  )
  await writeFile(join(OUTPUT_DIR, 'LICENSE.txt'), license(), 'utf8')

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n✓ Wrote ${OUTPUT_DIR}/ in ${elapsed}s`)
}

// ─── Machine-readable schema ─────────────────────────────────────────────────

function buildSchema() {
  return {
    name: 'Banned Books — Open Censorship Core',
    license: 'CC-BY-4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://www.banned-books.org',
    description:
      'The open, verifiable core of the Banned Books catalogue: structured facts about book bans, restrictions, and challenges, with the reason taxonomy and source citations. Editorial prose, convenience formats (SQLite/JSON), and enrichment (ISBNs, covers, descriptions, bios) are excluded and available in the commercial dataset.',
    array_separator: '|',
    null_encoding: 'empty string',
    tables: {
      books: {
        file: 'books.csv',
        primary_key: 'slug',
        description: 'One row per documented work.',
        columns: {
          slug: { type: 'string', description: 'Stable public identifier; the join key used by bans.book_slug and the path segment in /books/{slug}.' },
          title: { type: 'string', description: 'Canonical (dominant published) title.' },
          first_published_year: { type: 'integer|null', description: 'Year the work was first published. Can be negative / pre-1000 CE for ancient works.' },
          original_language: { type: 'string|null', description: 'ISO-ish language code of the original work.' },
          author_slugs: { type: 'string|null', description: "Pipe-separated ('|') list of authors.slug for this work. Empty when no author is recorded. Carries the book↔author relationship (no separate join table)." },
        },
      },
      authors: {
        file: 'authors.csv',
        primary_key: 'slug',
        description: 'One row per author. Joined from books.author_slugs (pipe-split).',
        columns: {
          slug: { type: 'string', description: 'Stable public identifier; referenced by books.author_slugs.' },
          display_name: { type: 'string', description: 'Slug-canonical, Anglo-friendly display form of the name.' },
          birth_country: { type: 'string|null', description: 'ISO country code of the author’s birth country, where known.' },
        },
      },
      bans: {
        file: 'bans.csv',
        primary_key: 'ban_id',
        description: 'One row per documented ban / restriction / challenge EVENT. A single title banned in many US school districts produces many rows (see the district-vs-aggregate note in the data descriptor).',
        columns: {
          ban_id: { type: 'string', description: 'Surrogate row key (UUID). Join key for ban_reasons.ban_id and ban_sources.ban_id.' },
          book_slug: { type: 'string', description: 'Foreign key → books.slug.' },
          country_code: { type: 'string', description: 'Foreign key → countries.code. Includes defunct states (USSR, East Germany, etc.).' },
          year_started: { type: 'integer|null', description: 'Year the ban took effect, where known.' },
          year_ended: { type: 'integer|null', description: 'Year the ban was lifted; empty if still in force or unknown.' },
          action_type: { type: 'string', description: 'Distinguishes formal bans, restrictions, and documented challenges.' },
          status: { type: 'string', description: 'One of active, lifted, historical, unknown.' },
          scope: { type: 'string|null', description: 'Scope slug (e.g. school, government, prison) resolved from the scopes taxonomy. Empty if unscoped.' },
        },
      },
      ban_reasons: {
        file: 'ban_reasons.csv',
        description: 'Many-to-many: the structured reason taxonomy applied to each ban. Zero or more rows per ban.',
        columns: {
          ban_id: { type: 'string', description: 'Foreign key → bans.ban_id.' },
          reason_slug: { type: 'string', description: 'Stable taxonomy slug (e.g. lgbtq, political, religious, sexual-content).' },
          reason_label: { type: 'string', description: 'Human-readable English label for the reason slug.' },
        },
      },
      ban_sources: {
        file: 'ban_sources.csv',
        description: 'Many-to-many: the source citation(s) backing each ban, denormalised onto the ban. Zero or more rows per ban.',
        columns: {
          ban_id: { type: 'string', description: 'Foreign key → bans.ban_id.' },
          source_name: { type: 'string', description: 'Name of the source (e.g. "PEN America Index of School Book Bans").' },
          source_url: { type: 'string|null', description: 'URL of the source document.' },
          source_type: { type: 'string|null', description: 'Category of source (advocacy index, news, government record, encyclopaedia, etc.).' },
          verification_status: { type: 'string|null', description: 'One of verified (URL works and archived), pending (archive attempt failed), broken (URL 4xx/5xx), unverified (never attempted). Empty on rows pre-dating the verification pipeline.' },
          accessed_at: { type: 'string|null', description: 'ISO date the source was last accessed/verified.' },
          locator: { type: 'string|null', description: 'In-source locator (page, row, entry id) pinpointing the citation within source_url.' },
        },
      },
      countries: {
        file: 'countries.csv',
        primary_key: 'code',
        description: 'Country lookup. Referenced by bans.country_code.',
        columns: {
          code: { type: 'string', description: 'Country code (ISO 3166-1 alpha-2 where applicable; custom codes for defunct states).' },
          name_en: { type: 'string', description: 'English country name.' },
        },
      },
    },
    joins: [
      'books.author_slugs (pipe-split) → authors.slug',
      'bans.book_slug → books.slug',
      'bans.country_code → countries.code',
      'ban_reasons.ban_id → bans.ban_id',
      'ban_sources.ban_id → bans.ban_id',
    ],
    counting_doctrine:
      'Rank on DISTINCT books or DISTINCT countries, never on raw ban-row counts. bans.csv contains one row per event; US titles appear many times because each school-district removal is a separate event, which inflates raw row counts ~2-3x relative to distinct titles. See the data descriptor for the full distinct-books-vs-raw-events explanation.',
  }
}

// ─── README + LICENSE ────────────────────────────────────────────────────────

function readme(d: {
  books: number; bans: number; sources: number
  distinctBooksWithBans: number; distinctCountriesWithBans: number
}) {
  return `# Banned Books — Open Censorship Core

The open, citeable core of the Banned Books catalogue (https://www.banned-books.org),
released under **CC-BY-4.0** for research and reuse.

This is the *verifiable censorship core*: structured facts about who banned what,
where, when, why, and on whose authority — with the reason taxonomy and source
citations that let you check each one. It is deliberately **not** the same as the
commercial dataset, which additionally contains editorial prose, convenience
formats (SQLite/JSON), and enrichment (ISBNs, covers, descriptions, author bios).

- Books:                       ${d.books.toLocaleString('en')}
- Ban events (raw rows):       ${d.bans.toLocaleString('en')}
- Distinct books with a ban:   ${d.distinctBooksWithBans.toLocaleString('en')}
- Distinct countries with a ban:${' '}${d.distinctCountriesWithBans.toLocaleString('en')}
- Source citations:            ${d.sources.toLocaleString('en')}

## Files

| File | Grain | Join key |
|------|-------|----------|
| books.csv | one per work | slug (PK) |
| authors.csv | one per author | slug (PK) |
| bans.csv | one per ban EVENT | ban_id (PK), book_slug → books.slug |
| ban_reasons.csv | many per ban | ban_id → bans.ban_id |
| ban_sources.csv | many per ban | ban_id → bans.ban_id |
| countries.csv | one per country | code (PK) |

Arrays (\`books.author_slugs\`) are pipe-separated (\`|\`). NULLs are empty strings.
See \`schema.json\` for the machine-readable column types and the full join map.

## How to count (important)

Rank on **distinct books** or **distinct countries**, never on raw ban rows.
\`bans.csv\` holds one row per *event*: a single US title banned across many school
districts produces many rows, inflating raw counts ~2-3x relative to distinct
titles. The full distinct-books-vs-raw-events explanation is in the data
descriptor that accompanies the Zenodo deposit.

## Coverage caveats

The catalogue is heavily biased toward English-language reporting. Bans in
authoritarian states (China, Russia, Iran, Saudi Arabia, North Korea) are far
more common than the data shows — they are simply less documented. The United
States appears prominently because it has systematic reporting infrastructure
(PEN America, ALA), not because it uniquely censors. The data descriptor's
"Known gaps and limitations" section covers this in full.

## License & citation

Released under CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/). You may
share and adapt the data for any purpose, including commercially, provided you
give attribution. See LICENSE.txt.

Cite the **concept DOI** (resolves to the latest version) — see the data
descriptor and the Zenodo record for the DOI once published. Suggested attribution:
"Banned Books — Open Censorship Core, banned-books.org, CC-BY-4.0."

Editorial prose and enrichment are not in this open release; they are available
in the commercial dataset at https://www.banned-books.org/dataset.
`
}

function license() {
  return `Banned Books — Open Censorship Core
Copyright (c) Banned Books (https://www.banned-books.org).

This dataset is licensed under the Creative Commons Attribution 4.0
International License (CC-BY-4.0).

You are free to:
  - Share — copy and redistribute the material in any medium or format
  - Adapt — remix, transform, and build upon the material for any purpose,
    even commercially.

Under the following terms:
  - Attribution — You must give appropriate credit, provide a link to the
    license, and indicate if changes were made. Suggested credit:
    "Banned Books — Open Censorship Core, banned-books.org, CC-BY-4.0",
    citing the Zenodo concept DOI.

Full license text: https://creativecommons.org/licenses/by/4.0/legalcode

Note: this CC-BY-4.0 release covers the OPEN censorship core only. The editorial
prose (descriptions, censorship context), enrichment (ISBNs, covers, author
bios), and convenience formats (SQLite/JSON) are NOT part of this release and
remain under the commercial license at https://www.banned-books.org/dataset.
`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
