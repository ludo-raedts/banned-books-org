#!/usr/bin/env tsx
/**
 * Import French ministerial bans under Article 14 of the loi du 16 juillet
 * 1949, as catalogued in the Wikipedia article "Liste de livres censurés en
 * France". Source snapshot: /tmp/fr-list.md.
 *
 * Strategy:
 *   1. Re-parse the Wikipedia article (same parser as
 *      `_scope_fr_wikipedia_bans.ts`).
 *   2. Filter to entries classified as books (not periodicals — those are
 *      out of scope for v1; ~1300 foreign-language Cold War newspapers we
 *      may revisit separately).
 *   3. For each: derive year_started from JO citation, build CommitInput
 *      with per-entry minister/government context + JO provenance.
 *   4. Skip entries already in DB (commitParsedRow handles
 *      (book_id, country_code, year_started) idempotency).
 *
 * Reason_slug: default `political` (Article 14 is fundamentally a
 * political-regulatory tool). The 1956 Olympia Press batch under minister
 * Jean Gilbert-Jules is set to `obscenity` per the historical record.
 * `suggest-editorial-classification-gpt.ts` will refine after import.
 *
 *   pnpm tsx --env-file=.env.local scripts/import-fr-article14.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-fr-article14.ts --limit=10
 *   pnpm tsx --env-file=.env.local scripts/import-fr-article14.ts --apply
 */

import { readFileSync, existsSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitParsedRow, type CommitInput } from '../src/lib/imports/review-commit'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG.slice(8), 10) || 0) : 0

const INPUT = '/tmp/fr-list.md'
const WIKIPEDIA_URL =
  'https://fr.wikipedia.org/wiki/Liste_de_livres_censurés_en_France'

const COUNTRY_CODE = 'FR'
const SCOPE_SLUG = 'government'
const ACTION_TYPE = 'banned' as const
const DEFAULT_REASON = 'political'

// ── Parse (matches _scope_fr_wikipedia_bans.ts) ───────────────────────────

type Section = 'article-14' | 'court-condemnation' | 'youth-protection' | 'historical' | 'unknown'

const SECTION_HEADERS: Array<{ re: RegExp; section: Section }> = [
  { re: /^### Publications ayant été interdites en application de l'article 14/, section: 'article-14' },
  { re: /^### Livres condamnés en France par la justice/, section: 'court-condemnation' },
  { re: /^### Liste des publications interdites de vente aux mineurs/, section: 'youth-protection' },
  { re: /^### Sous (l'Ancien Régime|la Révolution|le Consulat|la Première Restauration|les cent jours|la Seconde Restauration|la monarchie|le Gouvernement provisoire|la Deuxième République|le Second Empire|le Gouvernement de la Défense|l'Assemblée nationale de 1871|la Troisième République|l'État français|le Gouvernement provisoire de la République)/, section: 'historical' },
]

const GOVERNMENT_RE = /^#{4,5} par /
const BULLET_RE = /^- (.+)$/
const AUTHOR_LINK_RE = /^\[([^\]]+)\]\([^)]+\),\s*/
const AUTHOR_PLAIN_RE = /^([A-ZÀ-ÖØ-Þ][\p{L}\p{M}'.\-\s]{1,80}?),\s*(?=_)/u
const TITLE_RE = /_([^_\n]{2,})_/
const JO_RE = /\[?JO du (\d+\s*(?:er)?\s*[a-zéûôî]+\s*\d{4})(?:,\s*p\.\d+)?/i
const YEAR_RE = /\b(1[5-9]\d{2}|20[0-2]\d)\b/
const AUTHORISED_RE = /autoris[ée]e? le ([^[;)]+)/i
const PERIODICAL_KW =
  /(revue|journal|hebdomadaire|publication|bulletin|gazette|magazine|quotidien|presse|périodique|almanach|calendrier|annales)\b/i

function cleanTitle(raw: string): string {
  const cut = raw.indexOf('](')
  const sliced = cut >= 0 ? raw.slice(0, cut).replace(/^\[/, '') : raw
  return sliced.replace(/^\[+|\]+$/g, '').trim()
}

type Entry = {
  section: Section
  governmentContext: string | null
  author: string | null
  title: string
  year: number | null
  yearEnded: number | null
  joCitation: string | null
  authorisedText: string | null
  classification: 'book' | 'periodical' | 'unknown'
}

function parse(md: string): Entry[] {
  const lines = md.split('\n')
  const out: Entry[] = []
  let section: Section = 'unknown'
  let government: string | null = null

  for (const rawLine of lines) {
    let matched = false
    for (const { re, section: s } of SECTION_HEADERS) {
      if (re.test(rawLine)) {
        section = s
        government = null
        matched = true
        break
      }
    }
    if (matched) continue

    if (GOVERNMENT_RE.test(rawLine)) {
      government = rawLine.replace(/^#+ /, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
      continue
    }
    if (section === 'unknown') continue

    const bullet = rawLine.match(BULLET_RE)
    if (!bullet) continue
    const body = bullet[1]
    if (/Cette section est vide/.test(body) || body.length < 4) continue

    let author: string | null = null
    let rest = body
    const aLink = body.match(AUTHOR_LINK_RE)
    if (aLink) {
      author = aLink[1]
      rest = body.slice(aLink[0].length)
    } else {
      const aPlain = body.match(AUTHOR_PLAIN_RE)
      if (aPlain) {
        author = aPlain[1].trim()
        rest = body.slice(aPlain[0].length)
      }
    }

    const t = rest.match(TITLE_RE)
    if (!t) continue
    const title = cleanTitle(t[1])
    if (title.length < 2) continue
    const afterTitle = rest.slice(rest.indexOf(t[0]) + t[0].length)

    const j = afterTitle.match(JO_RE) || body.match(JO_RE)
    if (!j) continue
    const joCitation = j[0].replace(/^\[/, '')
    const y = j[1].match(YEAR_RE)
    const year = y ? parseInt(y[1], 10) : null

    const auth = afterTitle.match(AUTHORISED_RE)
    const authorisedText = auth ? auth[1].trim() : null
    const yearEndedMatch = authorisedText ? authorisedText.match(YEAR_RE) : null
    const yearEnded = yearEndedMatch ? parseInt(yearEndedMatch[1], 10) : null

    const isPeriodical = PERIODICAL_KW.test(afterTitle)
    const classification: Entry['classification'] = isPeriodical
      ? 'periodical'
      : author
        ? 'book'
        : 'unknown'

    out.push({
      section,
      governmentContext: government,
      author,
      title,
      year,
      yearEnded,
      joCitation,
      authorisedText,
      classification,
    })
  }
  return out
}

// ── Reason heuristic ──────────────────────────────────────────────────────

// The 1956 December batch under minister Jean Gilbert-Jules was the famous
// Olympia Press obscenity sweep — Henry Miller's Sexus, Fanny Hill, etc.
function reasonFor(e: Entry): string {
  if (e.governmentContext && /Gilbert-Jules/.test(e.governmentContext)) {
    return 'obscenity'
  }
  // The Reynouard / Graf / Rosenberg cases are political (Holocaust
  // denial / Nazi apologetics). The editorial-classification GPT will add
  // the warning-tier framing; the underlying reason stays 'political'.
  return DEFAULT_REASON
}

// ── Description ───────────────────────────────────────────────────────────

function buildDescription(e: Entry): string {
  const parts: string[] = []
  parts.push(
    `Banned by French ministerial decree under Article 14 of the Loi n° 49-956 du 16 juillet 1949 sur les publications destinées à la jeunesse.`,
  )
  if (e.governmentContext) parts.push(`Decree ${e.governmentContext}.`)
  if (e.joCitation) parts.push(`Citation: ${e.joCitation}.`)
  if (e.authorisedText)
    parts.push(`Ban lifted: ${e.authorisedText}${e.yearEnded ? ` (year ${e.yearEnded})` : ''}.`)
  return parts.join(' ')
}

function buildInclusionRationale(e: Entry): string {
  return (
    `Imported from the Wikipedia article "Liste de livres censurés en France" — ` +
    `specifically the section on Article 14 ministerial bans. The Journal ` +
    `officiel citation provides the primary-source verification: ${e.joCitation ?? '(no citation)'}.`
  )
}

function toCommitInput(e: Entry): CommitInput {
  const author = e.author ?? 'Anonymous'
  return {
    title: e.title,
    authors: [author],
    year: e.year!, // guarded by entry filter below
    first_published_year: null,
    country_code: COUNTRY_CODE,
    scope_slug: SCOPE_SLUG,
    action_type: ACTION_TYPE,
    ban_status: e.yearEnded ? 'historical' : 'active',
    reason_slug: reasonFor(e),
    description_ban: buildDescription(e),
    inclusion_rationale: buildInclusionRationale(e),
    source_url: WIKIPEDIA_URL,
    source_name: `Wikipedia — Liste de livres censurés en France${e.joCitation ? ` (${e.joCitation})` : ''}`,
    source_type: 'wikipedia',
    original_language: 'fr',
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(INPUT)) {
    console.error(`Missing snapshot: ${INPUT}`)
    console.error(
      `Re-scrape with:\n  firecrawl scrape '${WIKIPEDIA_URL}' --only-main-content --format markdown -o ${INPUT}`,
    )
    process.exit(1)
  }

  console.log(
    `\n── import-fr-article14 ── (${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT ? `, limit=${LIMIT}` : ''})\n`,
  )

  const md = readFileSync(INPUT, 'utf8')
  console.log(`Parsing ${md.split('\n').length} lines…`)
  const all = parse(md)
  console.log(`  Total entries: ${all.length}`)

  // Filter to import-ready: book classification AND a year_started.
  const books = all.filter(e => e.classification === 'book' && e.year !== null)
  const periodicals = all.filter(e => e.classification === 'periodical').length
  const unknown = all.filter(e => e.classification === 'unknown').length
  const skipped = all.length - books.length
  console.log(
    `  Books with year:    ${books.length}`,
  )
  console.log(`  Periodicals (skip):  ${periodicals}`)
  console.log(`  Unknown (skip):      ${unknown}`)
  console.log(`  Total to import:     ${books.length}\n`)

  const targets = LIMIT > 0 ? books.slice(0, LIMIT) : books

  // Preview.
  console.log('Sample (first 10):')
  for (const e of targets.slice(0, 10)) {
    const r = reasonFor(e)
    console.log(
      `  ${String(e.year).padEnd(4)} ${r.padEnd(10)} ${(e.author ?? 'anon').padEnd(25)} — ${e.title}`,
    )
  }
  console.log('')

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write to DB.')
    console.log(
      `\nReminder: after --apply, run suggest-editorial-classification-gpt.ts to refine warning-tier framing for Holocaust-denial / Nazi-apologia entries.`,
    )
    return
  }

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
        if (i % 10 === 0 || i === targets.length - 1) {
          console.log(
            `  [${i + 1}/${targets.length}] ok book_${result.book_id} ban_${result.ban_ids[0]} ${e.year} — ${input.authors[0]} — ${input.title}`,
          )
        }
      } catch (err) {
        failed++
        failures.push({ entry: e, err: (err as Error).message })
        console.log(
          `  [${i + 1}/${targets.length}] ✗ ${e.year} ${input.authors[0]} — ${input.title}: ${(err as Error).message}`,
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
      console.log(`    ${f.entry.year} ${f.entry.author} — ${f.entry.title}: ${f.err}`)
    }
  }
  console.log(
    `\nNext: run suggest-editorial-classification-gpt.ts to add editorial framing where warranted.`,
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
