#!/usr/bin/env tsx
/**
 * Import Liste Otto (3rd edition, mai 1943) — the Nazi-Vichy book ban list
 * for occupied France. 934 entries parsed from Wikisource.
 *
 * Source: https://fr.wikisource.org/wiki/Ouvrages_littéraires_non_désirables_en_France
 *   • A-Ki sub-page → /tmp/fr-otto-a-ki.md
 *   • Kl-Z sub-page → /tmp/fr-otto-kl-z.md
 *
 * Strategy:
 *   1. Re-parse both snapshots (same parser logic as
 *      `_scope_fr_otto_bans.ts`).
 *   2. Normalize author name: source uses "LASTNAME Firstname"
 *      (ALL-CAPS lastname). We flip to "Firstname Lastname" Title Case so
 *      the display_name matches the existing convention (e.g. "Stefan
 *      Zweig" not "ZWEIG Stefan").
 *   3. Commit via `commitParsedRow` — the canonical import helper. It
 *      handles author dedup-by-slug, book dedup-by-(slug,author), ban
 *      uniqueness, and ban_source_links wiring in one transaction.
 *
 * Editorial-classification:
 *   This script does NOT set warning_level on the imported books. Run
 *   `suggest-editorial-classification-gpt.ts` after import to flag entries
 *   that warrant 'context' or 'extended' framing (Nazi-collaborator
 *   memoirs, antisemitic tracts, occupation-era propaganda). That keeps
 *   the historical-fact layer (this script) cleanly separated from the
 *   editorial-framing layer.
 *
 * Idempotent: re-running --apply will skip books that already have a FR
 * ban with year_started=1940 (commitParsedRow checks via (book_id,
 * country_code, year_started) uniqueness).
 *
 *   pnpm tsx --env-file=.env.local scripts/import-fr-otto.ts                # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-fr-otto.ts --limit=10     # first 10
 *   pnpm tsx --env-file=.env.local scripts/import-fr-otto.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-fr-otto.ts --apply --limit=50
 */

import { readFileSync, existsSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitParsedRow, type CommitInput } from '../src/lib/imports/review-commit'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG.slice(8), 10) || 0) : 0

const INPUT_FILES: Array<{ path: string; subList: 'A-Ki' | 'Kl-Z' }> = [
  { path: '/tmp/fr-otto-a-ki.md', subList: 'A-Ki' },
  { path: '/tmp/fr-otto-kl-z.md', subList: 'Kl-Z' },
]

const WIKISOURCE_BASE =
  'https://fr.wikisource.org/wiki/Ouvrages_littéraires_non_désirables_en_France'

// Shared ban metadata for every Otto entry.
const BAN_YEAR_STARTED = 1940 // German occupation begins; Otto-I appears in autumn 1940.
const COUNTRY_CODE = 'FR'
const SCOPE_SLUG = 'government'
const ACTION_TYPE = 'banned' as const
const BAN_STATUS = 'historical' as const
const REASON_SLUG = 'political' // umbrella; per-entry reasons (racial, religious) are
// not derivable from the source — the editorial-classification pass will
// add more nuanced context after import.

// ── Parse (identical to _scope_fr_otto_bans.ts) ───────────────────────────

type Entry = {
  author: string | null
  title: string
  publishedYear: number | null
  publisher: string | null
  germanEdition: boolean
  subList: 'A-Ki' | 'Kl-Z'
}

const SKIP_RE = /^\| ?-+ ?\| ?-+ ?\|?$/
const ROW_RE =
  /^([\p{Lu}][\p{L}'\- .,]*?)\.\s*[—–-]+\s*(.+?)\s*\|\s*(.*?)\s*\|?$/u
const CONT_RE = /^»\s*(.+?)\s*\|\s*(.*?)\s*\|?$/u

function extractTitleAndYear(s: string): {
  title: string
  publishedYear: number | null
  germanEdition: boolean
} | null {
  const m = s.match(/_(\\?\*)?([^_]+?)_/)
  if (!m) return null
  const germanEdition = !!m[1]
  const titleRaw = m[2]
    .replace(/\\?\*/g, '')
    .replace(/^[«"']+|[»"']+$/g, '')
    .trim()
  const tail = s.slice(s.indexOf(m[0]) + m[0].length)
  const yMatch = tail.match(/\((\d{4})\)/)
  const publishedYear = yMatch ? parseInt(yMatch[1], 10) : null
  return { title: titleRaw, publishedYear, germanEdition }
}

function parseFile(md: string, subList: 'A-Ki' | 'Kl-Z'): Entry[] {
  const out: Entry[] = []
  let lastAuthor: string | null = null

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) continue
    if (SKIP_RE.test(line)) continue
    const body = line.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '')
    if (/auteurs et titres/i.test(body) || /^\s*$/.test(body)) continue

    const cells = body.split(/\s*\|\s*/)
    if (cells.length < 2) continue
    const left = cells[0]
    const publisher = (cells[1] || '').replace(/\.$/, '').trim() || null

    const chunks = left.split(/<br\s*\/?>/i)

    for (const chunkRaw of chunks) {
      const chunk = chunkRaw.trim()
      if (!chunk) continue

      if (chunk.startsWith('»')) {
        if (!lastAuthor) continue
        const cont = chunk.match(/»\s*(.+)/)
        if (!cont) continue
        const tw = extractTitleAndYear(cont[1])
        if (!tw) continue
        out.push({
          author: lastAuthor,
          title: tw.title,
          publishedYear: tw.publishedYear,
          publisher,
          germanEdition: tw.germanEdition,
          subList,
        })
        continue
      }

      const m = chunk.match(ROW_RE)
      if (m) {
        lastAuthor = m[1].replace(/\s+/g, ' ').trim()
        const tw = extractTitleAndYear(m[2])
        if (!tw) continue
        out.push({
          author: lastAuthor,
          title: tw.title,
          publishedYear: tw.publishedYear,
          publisher,
          germanEdition: tw.germanEdition,
          subList,
        })
        continue
      }

      const fallback = chunk.match(
        /^([\p{Lu}][\p{L}'\- .,]*?)\.\s*[—–-]+\s*(.+)$/u,
      )
      if (fallback) {
        lastAuthor = fallback[1].replace(/\s+/g, ' ').trim()
        const tw = extractTitleAndYear(fallback[2])
        if (!tw) continue
        out.push({
          author: lastAuthor,
          title: tw.title,
          publishedYear: tw.publishedYear,
          publisher,
          germanEdition: tw.germanEdition,
          subList,
        })
      }
    }
  }

  return out
}

// ── Author name normalization ─────────────────────────────────────────────

// Convert "BENDA J" → "J. Benda", "BARDANNE Joan" → "Joan Bardanne",
// "ABDER RAHMANE FITRAWE" → "Abder Rahmane Fitrawe". The rule: leading
// run of ALL-CAPS tokens (possibly hyphenated) is the surname; remaining
// tokens are the first name(s). Single-letter caps are kept as initials
// with a trailing period.
function normalizeAuthorName(raw: string): string {
  const tokens = raw.trim().split(/\s+/)
  if (tokens.length === 0) return raw

  const surnameTokens: string[] = []
  const firstNameTokens: string[] = []
  let stillSurname = true
  for (const t of tokens) {
    const cleaned = t.replace(/[.,]$/, '')
    // `+` (not `*`) requires ≥ 2 chars total: prevents a single-letter
    // all-caps token like "L" or "I" — which the source uses as a first
    // initial after the lastname — from being absorbed into the surname.
    if (stillSurname && /^[\p{Lu}][\p{Lu}'\-]+$/u.test(cleaned)) {
      surnameTokens.push(cleaned)
    } else {
      stillSurname = false
      firstNameTokens.push(t)
    }
  }

  if (surnameTokens.length === 0) return raw // nothing all-caps; leave as-is

  const titleCase = (s: string) =>
    s
      .toLowerCase()
      .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep: string, letter: string) =>
        sep + letter.toUpperCase(),
      )

  const surname = titleCase(surnameTokens.join(' '))

  if (firstNameTokens.length === 0) {
    // Whole input was ALL-CAPS — return title-cased surname as the whole name.
    return surname
  }

  const firstName = firstNameTokens
    .map(t => {
      const cleaned = t.replace(/[.,]$/, '')
      if (/^[\p{Lu}]$/u.test(cleaned)) return `${cleaned}.`
      return titleCase(cleaned)
    })
    .join(' ')

  return `${firstName} ${surname}`
}

// ── Source + description builders ─────────────────────────────────────────

function buildSourceUrl(e: Entry): string {
  return `${WIKISOURCE_BASE}/Liste_${e.subList}`
}

function buildSourceName(e: Entry): string {
  return `Liste Otto, 3e édition (1943) — Liste des ouvrages interdits (${e.subList})`
}

function buildDescription(e: Entry): string {
  const publisherClause = e.publisher ? ` Listed publisher: ${e.publisher}.` : ''
  const yearClause = e.publishedYear
    ? ` Originally published in ${e.publishedYear}.`
    : ''
  const germanClause = e.germanEdition
    ? ' Marked as German-language edition in the source list.'
    : ''
  return (
    `Banned in occupied France under the German occupation (1940-1944). ` +
    `Appeared in the 3rd edition (mai 1943) of the Liste Otto — "Ouvrages ` +
    `littéraires non désirables en France" — compiled by the Syndicat des ` +
    `éditeurs at the direction of the German Propaganda-Abteilung.` +
    publisherClause +
    yearClause +
    germanClause
  )
}

function buildInclusionRationale(e: Entry): string {
  return (
    `Imported from the 3rd edition (mai 1943) of the Liste Otto via ` +
    `Wikisource. The Liste Otto is the canonical Nazi-Vichy ban list for ` +
    `occupied France; every entry on it was withdrawn from sale by the ` +
    `Syndicat des éditeurs at the direction of the German Propaganda-` +
    `Abteilung. Sub-list: ${e.subList}.`
  )
}

// ── Build CommitInput ──────────────────────────────────────────────────────

// Otto list catalogues some authors as "Toutes ses œuvres" — meaning ALL
// their works were banned, regardless of title. This is an author-level
// blanket ban, but we model it as a single book record. Many authors share
// this exact title string, so we suffix the author name to keep the slug
// unique (and signal at-a-glance that this is a blanket-works entry).
const BLANKET_WORKS_RE = /^Toutes ses œuvres\.?$/i

function titleFor(rawTitle: string, normalizedAuthor: string): string {
  const t = rawTitle.trim()
  if (BLANKET_WORKS_RE.test(t)) {
    return `Toutes ses œuvres (${normalizedAuthor})`
  }
  return t
}

function toCommitInput(e: Entry): CommitInput {
  const author = e.author ? normalizeAuthorName(e.author) : 'Anonymous'
  return {
    title: titleFor(e.title, author),
    authors: [author],
    year: BAN_YEAR_STARTED,
    first_published_year: e.publishedYear,
    country_code: COUNTRY_CODE,
    scope_slug: SCOPE_SLUG,
    action_type: ACTION_TYPE,
    ban_status: BAN_STATUS,
    reason_slug: REASON_SLUG,
    description_ban: buildDescription(e),
    inclusion_rationale: buildInclusionRationale(e),
    source_url: buildSourceUrl(e),
    source_name: buildSourceName(e),
    source_type: 'web', // Wikisource — public web archive of the 1943 print
    original_language: 'fr',
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  for (const f of INPUT_FILES) {
    if (!existsSync(f.path)) {
      console.error(`Missing snapshot: ${f.path}`)
      console.error('Re-scrape with:')
      console.error(
        `  firecrawl scrape "${WIKISOURCE_BASE}/Liste_${f.subList}" --only-main-content --format markdown -o ${f.path}`,
      )
      process.exit(1)
    }
  }

  console.log(
    `\n── import-fr-otto ── (${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT ? `, limit=${LIMIT}` : ''})\n`,
  )

  console.log('Parsing snapshots…')
  const entries: Entry[] = []
  for (const f of INPUT_FILES) {
    const md = readFileSync(f.path, 'utf8')
    const parsed = parseFile(md, f.subList)
    console.log(`  ${f.path}: ${parsed.length} entries`)
    entries.push(...parsed)
  }
  console.log(`  Total: ${entries.length}`)

  const targets = LIMIT > 0 ? entries.slice(0, LIMIT) : entries
  console.log(`  Processing: ${targets.length}\n`)

  // Dry-run preview: print the first 10 normalized rows.
  console.log('Sample (first 10, normalized):')
  for (const e of targets.slice(0, 10)) {
    const normAuthor = e.author ? normalizeAuthorName(e.author) : 'Anonymous'
    const yearText = e.publishedYear ? ` (${e.publishedYear})` : ''
    console.log(`  ${normAuthor.padEnd(35)} — ${e.title}${yearText}`)
  }
  console.log('')

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write to DB.')
    console.log(
      '\nReminder: after --apply, run `suggest-editorial-classification-gpt.ts --apply` to flag entries that warrant editorial framing.',
    )
    return
  }

  // APPLY phase — open one pg connection and commit serially. Serial is
  // fine for 934 records and avoids transaction contention.
  const pg = newPgClient()
  await pg.connect()
  console.log('Applying…\n')
  let created = 0
  let failed = 0
  const failures: Array<{ entry: Entry; err: string }> = []
  try {
    for (const [i, e] of targets.entries()) {
      const input = toCommitInput(e)
      try {
        const result = await commitParsedRow(input, pg)
        created++
        if (i % 25 === 0 || i === targets.length - 1) {
          console.log(
            `  [${i + 1}/${targets.length}] ok book_${result.book_id} ban_${result.ban_ids[0]} — ${input.authors[0]} — ${input.title}`,
          )
        }
      } catch (err) {
        failed++
        failures.push({ entry: e, err: (err as Error).message })
        console.log(
          `  [${i + 1}/${targets.length}] ✗ ${input.authors[0]} — ${input.title}: ${(err as Error).message}`,
        )
      }
    }
  } finally {
    await pg.end()
  }

  console.log('\n── Summary ──')
  console.log(`  Created: ${created}`)
  console.log(`  Failed:  ${failed}`)
  if (failures.length > 0) {
    console.log('\n  First 10 failures:')
    for (const f of failures.slice(0, 10)) {
      console.log(`    ${f.entry.author} — ${f.entry.title}: ${f.err}`)
    }
  }
  console.log(
    '\nNext: run suggest-editorial-classification-gpt.ts on the new books to add editorial framing where warranted.',
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
