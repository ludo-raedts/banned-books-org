#!/usr/bin/env tsx
/**
 * Build the paid-download dataset ZIP.
 *
 * Pulls every relevant row from Supabase, writes CSVs + a denormalised JSON +
 * a SQLite database + README + LICENSE, then bundles them as
 * `private/dataset.zip`. The download endpoint streams that file directly.
 *
 * Run locally with:  pnpm build:dataset
 * Vercel runs it as part of `next build` (see package.json).
 *
 * The script is idempotent — running it twice produces the same archive
 * (modulo the timestamp in metadata).
 */

import archiver from 'archiver'
import Database from 'better-sqlite3'
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchAll, writeCsv, makeAdminClient } from './lib/dataset-io'

const ROOT = process.cwd()
const STAGING_DIR = join(ROOT, 'private', '_dataset_build')
const OUTPUT_ZIP = join(ROOT, 'private', 'dataset.zip')

// ─── Public-facing schema ────────────────────────────────────────────────────
// Anything internal-only (e.g. inclusion_rationale) is filtered before export.
const BOOK_COLUMNS = [
  'id', 'slug', 'title', 'original_language', 'first_published_year',
  'isbn13', 'openlibrary_work_id', 'gutenberg_id', 'genres',
  'description_book', 'description_ban', 'censorship_context', 'extended_context',
  'warning_level', 'cover_url', 'created_at',
  // Appended 2026-05-25 — additive, kept at end so existing buyer schemas
  // parsing earlier snapshots stay compatible.
  'title_native', 'title_native_script', 'title_transliterated',
  'title_english_meaningful', 'archive_org_id', 'data_quality_status',
  'updated_at',
] as const
const AUTHOR_COLUMNS = [
  'id', 'slug', 'display_name', 'birth_year', 'death_year', 'birth_country', 'bio',
  // Appended 2026-05-25 — see BOOK_COLUMNS note.
  'name_native', 'name_transliterated', 'name_english', 'original_language',
  'is_placeholder', 'data_quality_status', 'updated_at',
] as const
const BAN_COLUMNS = [
  'id', 'book_id', 'country_code', 'scope_id', 'action_type', 'status',
  'region', 'institution', 'year_started', 'year_ended', 'actor',
  'description', 'confidence', 'created_at',
] as const
const COUNTRY_COLUMNS = ['code', 'name_en', 'slug', 'description'] as const
const REASON_COLUMNS = ['id', 'slug', 'label_en', 'description'] as const
const SCOPE_COLUMNS = ['id', 'slug', 'label_en'] as const
const SOURCE_COLUMNS = [
  'id', 'source_name', 'source_url', 'source_type', 'accessed_at',
  // Appended 2026-05-25.
  'verification_status',
] as const

async function main() {
  const startedAt = Date.now()
  console.log('▸ Building dataset…')

  const supabase = makeAdminClient()

  // 1. Pull all data in parallel
  console.log('  · Fetching from Supabase')
  const [
    books, authors, bookAuthors, bans, banReasonLinks, banSourceLinks,
    countries, reasons, scopes, sources,
  ] = await Promise.all([
    fetchAll(supabase, 'books',            BOOK_COLUMNS.join(','),         'id', 250),
    fetchAll(supabase, 'authors',          AUTHOR_COLUMNS.join(','),       'id'),
    fetchAll(supabase, 'book_authors',     'book_id, author_id, role',     'book_id,author_id'),
    fetchAll(supabase, 'bans',             BAN_COLUMNS.join(','),          'id'),
    fetchAll(supabase, 'ban_reason_links', 'ban_id, reason_id',            'ban_id,reason_id'),
    fetchAll(supabase, 'ban_source_links', 'ban_id, source_id, locator',   'ban_id,source_id'),
    fetchAll(supabase, 'countries',        COUNTRY_COLUMNS.join(','),      'code'),
    fetchAll(supabase, 'reasons',          REASON_COLUMNS.join(','),       'id'),
    fetchAll(supabase, 'scopes',           SCOPE_COLUMNS.join(','),        'id'),
    fetchAll(supabase, 'ban_sources',      SOURCE_COLUMNS.join(','),       'id'),
  ])

  console.log(`    books=${books.length} authors=${authors.length} bans=${bans.length} sources=${sources.length}`)

  // 2. Reset staging dir
  rmSync(STAGING_DIR, { recursive: true, force: true })
  mkdirSync(STAGING_DIR, { recursive: true })

  // 3. Write CSVs
  console.log('  · Writing CSVs')
  await Promise.all([
    writeCsv(STAGING_DIR, 'books.csv',            BOOK_COLUMNS,    books),
    writeCsv(STAGING_DIR, 'authors.csv',          AUTHOR_COLUMNS,  authors),
    writeCsv(STAGING_DIR, 'book_authors.csv',     ['book_id', 'author_id', 'role'], bookAuthors),
    writeCsv(STAGING_DIR, 'bans.csv',             BAN_COLUMNS,     bans),
    writeCsv(STAGING_DIR, 'ban_reason_links.csv', ['ban_id', 'reason_id'], banReasonLinks),
    writeCsv(STAGING_DIR, 'ban_source_links.csv', ['ban_id', 'source_id', 'locator'], banSourceLinks),
    writeCsv(STAGING_DIR, 'countries.csv',        COUNTRY_COLUMNS, countries),
    writeCsv(STAGING_DIR, 'reasons.csv',          REASON_COLUMNS,  reasons),
    writeCsv(STAGING_DIR, 'scopes.csv',           SCOPE_COLUMNS,   scopes),
    writeCsv(STAGING_DIR, 'ban_sources.csv',      SOURCE_COLUMNS,  sources),
  ])

  // 4. Write denormalised JSON (most useful for casual analysts)
  console.log('  · Writing dataset.json')
  const json = buildDenormalisedJson({
    books, authors, bookAuthors, bans, banReasonLinks, banSourceLinks,
    countries, reasons, scopes, sources,
  })
  await writeFile(join(STAGING_DIR, 'dataset.json'), JSON.stringify(json, null, 2), 'utf8')

  // 5. Write SQLite
  console.log('  · Writing dataset.sqlite')
  buildSqlite(join(STAGING_DIR, 'dataset.sqlite'), {
    books, authors, bookAuthors, bans, banReasonLinks, banSourceLinks,
    countries, reasons, scopes, sources,
  })

  // 6. Write README + LICENSE
  await writeFile(join(STAGING_DIR, 'README.md'), readme({ books, bans, countries, sources }), 'utf8')
  await writeFile(join(STAGING_DIR, 'LICENSE.txt'), license(), 'utf8')

  // 7. Zip
  console.log('  · Packing zip')
  await mkdir(join(ROOT, 'private'), { recursive: true })
  await packZip(STAGING_DIR, OUTPUT_ZIP)

  // 8. Cleanup staging
  rmSync(STAGING_DIR, { recursive: true, force: true })

  // 9. Stamp the build time in mv_refresh_log so the admin card knows
  const { error: stampError } = await supabase.from('mv_refresh_log').upsert(
    { key: 'dataset_built_at', updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (stampError) console.warn('  ! mv_refresh_log update failed:', stampError.message)

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`✓ Built ${OUTPUT_ZIP} in ${elapsed}s`)
}

// ─── Denormalised JSON ───────────────────────────────────────────────────────

function buildDenormalisedJson(d: {
  books: Record<string, unknown>[]
  authors: Record<string, unknown>[]
  bookAuthors: Record<string, unknown>[]
  bans: Record<string, unknown>[]
  banReasonLinks: Record<string, unknown>[]
  banSourceLinks: Record<string, unknown>[]
  countries: Record<string, unknown>[]
  reasons: Record<string, unknown>[]
  scopes: Record<string, unknown>[]
  sources: Record<string, unknown>[]
}) {
  const authorById = indexBy(d.authors, 'id')
  const countryByCode = indexBy(d.countries, 'code')
  const reasonById = indexBy(d.reasons, 'id')
  const scopeById = indexBy(d.scopes, 'id')
  const sourceById = indexBy(d.sources, 'id')

  const authorsByBook = groupBy(d.bookAuthors, 'book_id')
  const reasonsByBan = groupBy(d.banReasonLinks, 'ban_id')
  const sourcesByBan = groupBy(d.banSourceLinks, 'ban_id')
  const bansByBook = groupBy(d.bans, 'book_id')

  const books = d.books.map((b) => {
    const authors = (authorsByBook.get(String(b.id)) ?? []).map((ba) => {
      const a = authorById.get(String(ba.author_id))
      return a ? {
        name: a.display_name,
        slug: a.slug,
        role: ba.role,
        name_native: a.name_native ?? null,
        name_transliterated: a.name_transliterated ?? null,
        name_english: a.name_english ?? null,
        original_language: a.original_language ?? null,
        is_placeholder: a.is_placeholder === true,
      } : null
    }).filter(Boolean)

    const bans = (bansByBook.get(String(b.id)) ?? []).map((ban) => {
      const country = countryByCode.get(String(ban.country_code))
      const scope = ban.scope_id ? scopeById.get(String(ban.scope_id)) : null
      const reasons = (reasonsByBan.get(String(ban.id)) ?? [])
        .map((l) => reasonById.get(String(l.reason_id)))
        .filter(Boolean)
        .map((r) => ({ slug: r!.slug, label: r!.label_en }))
      const sources = (sourcesByBan.get(String(ban.id)) ?? [])
        .map((l) => {
          const s = sourceById.get(String(l.source_id))
          return s ? {
            name: s.source_name,
            url: s.source_url,
            type: s.source_type,
            locator: l.locator,
            verification_status: s.verification_status ?? null,
          } : null
        })
        .filter(Boolean)
      return {
        country_code: ban.country_code,
        country_name: country?.name_en ?? null,
        scope: scope ? { slug: scope.slug, label: scope.label_en } : null,
        action_type: ban.action_type,
        status: ban.status,
        year_started: ban.year_started,
        year_ended: ban.year_ended,
        region: ban.region,
        institution: ban.institution,
        actor: ban.actor,
        description: ban.description,
        confidence: ban.confidence,
        reasons,
        sources,
      }
    })

    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      title_native: b.title_native ?? null,
      title_native_script: b.title_native_script ?? null,
      title_transliterated: b.title_transliterated ?? null,
      title_english_meaningful: b.title_english_meaningful ?? null,
      authors,
      original_language: b.original_language,
      first_published_year: b.first_published_year,
      isbn13: b.isbn13,
      openlibrary_work_id: b.openlibrary_work_id,
      gutenberg_id: b.gutenberg_id,
      archive_org_id: b.archive_org_id ?? null,
      genres: b.genres,
      description: b.description_book,
      description_ban: b.description_ban,
      censorship_context: b.censorship_context,
      extended_context: b.extended_context,
      warning_level: b.warning_level,
      data_quality_status: b.data_quality_status ?? null,
      cover_url: b.cover_url,
      bans,
    }
  })

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'https://www.banned-books.org',
      counts: {
        books: d.books.length,
        bans: d.bans.length,
        authors: d.authors.length,
        countries: d.countries.length,
        sources: d.sources.length,
      },
      schema_version: 1,
      license: 'See LICENSE.txt — personal/research use only.',
    },
    books,
  }
}

function indexBy(rows: Record<string, unknown>[], key: string) {
  const m = new Map<string, Record<string, unknown>>()
  for (const r of rows) m.set(String(r[key]), r)
  return m
}

function groupBy(rows: Record<string, unknown>[], key: string) {
  const m = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = String(r[key])
    const arr = m.get(k) ?? []
    arr.push(r)
    m.set(k, arr)
  }
  return m
}

// ─── SQLite ──────────────────────────────────────────────────────────────────

function buildSqlite(path: string, d: {
  books: Record<string, unknown>[]
  authors: Record<string, unknown>[]
  bookAuthors: Record<string, unknown>[]
  bans: Record<string, unknown>[]
  banReasonLinks: Record<string, unknown>[]
  banSourceLinks: Record<string, unknown>[]
  countries: Record<string, unknown>[]
  reasons: Record<string, unknown>[]
  scopes: Record<string, unknown>[]
  sources: Record<string, unknown>[]
}) {
  if (existsSync(path)) rmSync(path)
  const db = new Database(path)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE books (
      id TEXT PRIMARY KEY, slug TEXT, title TEXT, original_language TEXT,
      first_published_year INTEGER, isbn13 TEXT, openlibrary_work_id TEXT,
      gutenberg_id TEXT, genres TEXT, description_book TEXT, description_ban TEXT,
      censorship_context TEXT, extended_context TEXT, warning_level TEXT,
      cover_url TEXT, created_at TEXT,
      title_native TEXT, title_native_script TEXT, title_transliterated TEXT,
      title_english_meaningful TEXT, archive_org_id TEXT,
      data_quality_status TEXT, updated_at TEXT
    );
    CREATE TABLE authors (
      id TEXT PRIMARY KEY, slug TEXT, display_name TEXT,
      birth_year INTEGER, death_year INTEGER, birth_country TEXT, bio TEXT,
      name_native TEXT, name_transliterated TEXT, name_english TEXT,
      original_language TEXT, is_placeholder INTEGER,
      data_quality_status TEXT, updated_at TEXT
    );
    CREATE TABLE book_authors (
      book_id TEXT, author_id TEXT, role TEXT,
      PRIMARY KEY (book_id, author_id)
    );
    CREATE TABLE bans (
      id TEXT PRIMARY KEY, book_id TEXT, country_code TEXT, scope_id TEXT,
      action_type TEXT, status TEXT, region TEXT, institution TEXT,
      year_started INTEGER, year_ended INTEGER, actor TEXT, description TEXT,
      confidence TEXT, created_at TEXT
    );
    CREATE TABLE ban_reason_links (
      ban_id TEXT, reason_id TEXT, PRIMARY KEY (ban_id, reason_id)
    );
    CREATE TABLE ban_source_links (
      ban_id TEXT, source_id TEXT, locator TEXT,
      PRIMARY KEY (ban_id, source_id)
    );
    CREATE TABLE countries (
      code TEXT PRIMARY KEY, name_en TEXT, slug TEXT, description TEXT
    );
    CREATE TABLE reasons (
      id TEXT PRIMARY KEY, slug TEXT, label_en TEXT, description TEXT
    );
    CREATE TABLE scopes (
      id TEXT PRIMARY KEY, slug TEXT, label_en TEXT
    );
    CREATE TABLE ban_sources (
      id TEXT PRIMARY KEY, source_name TEXT, source_url TEXT,
      source_type TEXT, accessed_at TEXT, verification_status TEXT
    );
    CREATE INDEX idx_bans_book_id ON bans(book_id);
    CREATE INDEX idx_bans_country ON bans(country_code);
    CREATE INDEX idx_book_authors_book ON book_authors(book_id);
    CREATE INDEX idx_ban_reason_links_ban ON ban_reason_links(ban_id);
    CREATE INDEX idx_ban_source_links_ban ON ban_source_links(ban_id);
  `)

  const insert = (table: string, columns: readonly string[], rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return
    const placeholders = columns.map(() => '?').join(', ')
    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
    const tx = db.transaction((batch: Record<string, unknown>[]) => {
      for (const row of batch) {
        stmt.run(...columns.map((c) => sqliteValue(row[c])))
      }
    })
    tx(rows)
  }

  insert('books',            BOOK_COLUMNS, d.books)
  insert('authors',          AUTHOR_COLUMNS, d.authors)
  insert('book_authors',     ['book_id', 'author_id', 'role'], d.bookAuthors)
  insert('bans',             BAN_COLUMNS, d.bans)
  insert('ban_reason_links', ['ban_id', 'reason_id'], d.banReasonLinks)
  insert('ban_source_links', ['ban_id', 'source_id', 'locator'], d.banSourceLinks)
  insert('countries',        COUNTRY_COLUMNS, d.countries)
  insert('reasons',          REASON_COLUMNS, d.reasons)
  insert('scopes',           SCOPE_COLUMNS, d.scopes)
  insert('ban_sources',      SOURCE_COLUMNS, d.sources)

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
}

function sqliteValue(v: unknown): string | number | bigint | Buffer | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return v.join('|')
  return JSON.stringify(v)
}

// ─── ZIP ─────────────────────────────────────────────────────────────────────

function packZip(sourceDir: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

// ─── README + LICENSE text ───────────────────────────────────────────────────

function readme(d: {
  books: unknown[]; bans: unknown[]; countries: unknown[]; sources: unknown[]
}) {
  return `# Banned Books — Dataset

This archive is a structured snapshot of every documented ban, restriction,
and challenge in the Banned Books catalogue at the time of purchase.

- Books:     ${d.books.length.toLocaleString('en')}
- Bans:      ${d.bans.length.toLocaleString('en')}
- Countries: ${d.countries.length.toLocaleString('en')}
- Sources:   ${d.sources.length.toLocaleString('en')}

Generated: ${new Date().toISOString()}
Source:    https://www.banned-books.org

## Files

- **books.csv / authors.csv / bans.csv / countries.csv / reasons.csv / scopes.csv / ban_sources.csv**
  Relational tables. Join on \`id\` / \`book_id\` / \`ban_id\` / etc.
- **book_authors.csv / ban_reason_links.csv / ban_source_links.csv** — many-to-many join tables.
- **dataset.json** — single denormalised file. Each book has its bans nested,
  with country names, reason labels, and source URLs already resolved. The
  easiest format for one-off analyses.
- **dataset.sqlite** — single SQLite database with all tables and indexes.
  Open in DB Browser for SQLite or query directly: \`sqlite3 dataset.sqlite\`.

## Field notes

- \`bans.status\` is one of \`active\`, \`lifted\`, \`historical\`, \`unknown\`.
- \`bans.action_type\` distinguishes formal bans, restrictions, and documented challenges.
- \`bans.confidence\` reflects how thoroughly we could verify the ban from sources.
- \`books.warning_level\` is an editorial flag for content notes (e.g. graphic violence).
- \`books.description_ban\` and \`books.censorship_context\` are editorial summaries
  written for the public site; cite as such if quoting.
- Genres are pipe-separated in CSVs (\`|\`) and arrays in JSON.
- \`books.title_native\` / \`title_native_script\` / \`title_transliterated\` /
  \`title_english_meaningful\` hold the multilingual title variants for
  non-English works (e.g. Solzhenitsyn's *Архипелаг ГУЛАГ* → *Arkhipelag GULAG*
  → *The Gulag Archipelago*). NULL where the canonical \`title\` already
  reflects the dominant published form.
- \`authors.name_native\` / \`name_transliterated\` / \`name_english\` /
  \`original_language\` mirror the same pattern for author names. \`display_name\`
  remains the slug-canonical, Anglo-friendly form regardless.
- \`authors.is_placeholder\` flags generic bucket records ("Anonymous",
  "Various", "Unknown") that aggregate unrelated books. Filter these out
  if you're computing per-author statistics.
- \`books.data_quality_status\` and \`authors.data_quality_status\` are one of
  \`confident\` (high-confidence canonical-id + descriptions + extra evidence),
  \`default\` (imported, no hard verification), or \`flagged\` (at least one
  data-quality problem). Useful for filtering down to the high-confidence
  subset for academic citation.
- \`books.archive_org_id\` is the archive.org identifier (path segment after
  \`/details/\`) when a full-text scan is available; NULL otherwise.
- \`ban_sources.verification_status\` is one of \`verified\` (URL works and
  archived), \`pending\` (source exists but archive attempt failed), \`broken\`
  (URL returns 4xx/5xx), or \`unverified\` (never attempted). NULL on older
  rows that pre-date the verification pipeline.
- \`books.updated_at\` and \`authors.updated_at\` bump on every edit, so you
  can detect what changed between two dataset snapshots.

## Coverage caveats

The catalogue is heavily biased toward English-language reporting. Bans in
authoritarian states (China, Russia, Iran, Saudi Arabia, North Korea) are far
more common than the data shows — they are simply less documented in sources
we index. The United States appearing prominently reflects systematic
reporting infrastructure (PEN America, ALA), not uniquely American censorship.

## Updates

The dataset is regenerated when the underlying database is updated. Your
download link stays valid for 30 days; revisit it for the latest snapshot
within that window. After 30 days, contact us for a renewed link.

## License

See LICENSE.txt. In short: personal and research use only. Cite as
"Banned Books (https://www.banned-books.org), accessed [date]". Redistribution
or commercial reuse requires a separate license.

## Questions

Reply to your purchase confirmation, or reach out via
https://www.banned-books.org/about#get-in-touch
`
}

function license() {
  return `Banned Books Dataset — License

Copyright © Banned Books (https://www.banned-books.org). All rights reserved.

By purchasing this dataset you receive a perpetual, non-exclusive,
non-transferable license to:

  1. Use the data for personal research, journalism, academic work, or
     internal analysis.
  2. Quote, cite, and reference the data in publications, with attribution
     to "Banned Books (https://www.banned-books.org)".
  3. Build derivative analyses, visualisations, and reports — including
     ones you publish — provided the underlying dataset itself is not
     redistributed in whole or in substantial part.

You may NOT, without a separate written license:

  · Redistribute, resell, or republish the dataset (in whole or in part)
    as a downloadable product, API, database service, or scraped clone.
  · Use the data to power a competing catalogue, search interface, or
    paid service.
  · Remove or obscure the source attribution.

The data is provided "as is" without warranty of any kind. Coverage is
incomplete and biased toward English-language reporting; see README.md.

For commercial licensing, redistribution rights, or institutional access,
contact: https://www.banned-books.org/about#get-in-touch
`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
