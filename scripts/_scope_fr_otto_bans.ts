#!/usr/bin/env tsx
/**
 * Scope the Liste Otto (WWII Nazi-Vichy book ban) from Wikisource — the
 * actual title-by-title list that the Wikipedia Liste_Otto article only
 * summarises. Read-only — produces `data/fr-otto-bans-scope.md`. No
 * Firecrawl credits used (uses local markdown snapshots).
 *
 * Source files (scraped once via firecrawl, stored in /tmp):
 *   /tmp/fr-otto-a-ki.md  — Liste des ouvrages interdits (A à Ki)
 *   /tmp/fr-otto-kl-z.md  — Liste des ouvrages interdits (Kl à Z)
 *
 * Each Wikisource page is a markdown table:
 *   | AUTHOR LASTNAME Firstname. — _Title_ (year). | Publisher. |
 * with continuation rows for the same author:
 *   | » _Other Title_ (year).                       | Publisher. |
 *
 * Variants observed:
 *   • Asterisk-prefixed titles: `_*Title_` — original German-language ed.
 *   • Multiple titles per row separated by <br> rendered to "<br>" or
 *     two consecutive entries.
 *   • Some titles include parenthetical subtitle like "(Guerre secrète)".
 *   • Year often parenthesised; sometimes missing entirely.
 *
 * Historical context: the Otto list banned books for being authored by
 * Jews, communists, anti-Nazis, or for content the Vichy/Nazi
 * authorities found undesirable. EVERY entry here was banned for
 * ideological reasons under occupation. Editorial classification
 * (suggest-editorial-classification-gpt.ts) will run after import to
 * surface those that warrant additional framing.
 *
 *   pnpm tsx --env-file=.env.local scripts/_scope_fr_otto_bans.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const INPUT_FILES = [
  '/tmp/fr-otto-a-ki.md',
  '/tmp/fr-otto-kl-z.md',
]
const REPORT = join(process.cwd(), 'data/fr-otto-bans-scope.md')
const SOURCE_URL_BASE =
  'https://fr.wikisource.org/wiki/Ouvrages_litt%C3%A9raires_non_d%C3%A9sirables_en_France'
const BAN_YEAR = 1943 // The third (most complete) edition's publication.

type Entry = {
  author: string | null
  title: string
  publishedYear: number | null
  publisher: string | null
  germanEdition: boolean // marked with `*` in source
  rawRow: string
}

// ── Parse ──────────────────────────────────────────────────────────────────

// Skip rows that are table headers, separators, or non-data.
const SKIP_RE = /^\| ?-+ ?\| ?-+ ?\|?$/

// "AUTHOR FAMILY-NAME Firstname. — _Title_ (1939)."
// Some sources use NBSP, en-dash, em-dash interchangeably. We accept any of
// `—`, `–`, `-` after the author segment.
const ROW_RE =
  /^([\p{Lu}][\p{L}'\- .,]*?)\.\s*[—–-]+\s*(.+?)\s*\|\s*(.*?)\s*\|?$/u

// Continuation row: `» _Other Title_`
const CONT_RE = /^»\s*(.+?)\s*\|\s*(.*?)\s*\|?$/u

// Pull title text from `_…_` (or `*Title*` rare variant). Asterisk-prefixed
// titles are German editions — we record that flag separately.
function extractTitleAndYear(s: string): {
  title: string
  publishedYear: number | null
  germanEdition: boolean
} | null {
  // Try underscored italics first.
  const m = s.match(/_(\\?\*)?([^_]+?)_/)
  if (!m) return null
  const germanEdition = !!m[1]
  const titleRaw = m[2]
    .replace(/\\?\*/g, '')
    .replace(/^[«"']+|[»"']+$/g, '')
    .trim()
  // Year in parens after the title.
  const tail = s.slice(s.indexOf(m[0]) + m[0].length)
  const yMatch = tail.match(/\((\d{4})\)/)
  const publishedYear = yMatch ? parseInt(yMatch[1], 10) : null
  return { title: titleRaw, publishedYear, germanEdition }
}

function parseFile(md: string): Entry[] {
  const out: Entry[] = []
  let lastAuthor: string | null = null

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) continue
    if (SKIP_RE.test(line)) continue

    // Strip outer pipes.
    const body = line.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '')

    // Header row?
    if (/auteurs et titres/i.test(body) || /^\s*$/.test(body)) continue

    // Split by single pipe → [authors+titles, publisher]
    const cells = body.split(/\s*\|\s*/)
    if (cells.length < 2) continue
    const left = cells[0]
    const publisher = (cells[1] || '').replace(/\.$/, '').trim() || null

    // Some rows contain multiple titles via <br>. Process each chunk
    // individually so each gets its own entry.
    const chunks = left.split(/<br\s*\/?>/i)

    for (const chunkRaw of chunks) {
      const chunk = chunkRaw.trim()
      if (!chunk) continue

      // Continuation?
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
          rawRow: line,
        })
        continue
      }

      // Regular row.
      const m = chunk.match(ROW_RE)
      if (m) {
        const author = m[1].replace(/\s+/g, ' ').trim()
        lastAuthor = author
        const tw = extractTitleAndYear(m[2] + ' | ' + (publisher ?? ''))
        if (!tw) continue
        out.push({
          author,
          title: tw.title,
          publishedYear: tw.publishedYear,
          publisher,
          germanEdition: tw.germanEdition,
          rawRow: line,
        })
        continue
      }

      // Fall-back: try author detection at the *segment* level (e.g.
      // continuations after a <br> that aren't `»` prefixed but begin
      // with a new lastname).
      const fallback = chunk.match(
        /^([\p{Lu}][\p{L}'\- .,]*?)\.\s*[—–-]+\s*(.+)$/u,
      )
      if (fallback) {
        const author = fallback[1].replace(/\s+/g, ' ').trim()
        lastAuthor = author
        const tw = extractTitleAndYear(fallback[2])
        if (!tw) continue
        out.push({
          author,
          title: tw.title,
          publishedYear: tw.publishedYear,
          publisher,
          germanEdition: tw.germanEdition,
          rawRow: line,
        })
      }
    }
  }

  return out
}

// ── DB overlap ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchExistingFrTitles(
  sb: ReturnType<typeof adminClient>,
): Promise<Set<string>> {
  const PAGE = 1000
  const titles = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('bans')
      .select('book_id, books!inner(title)')
      .eq('country_code', 'FR')
      .order('book_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as Array<{ books: { title: string } | Array<{ title: string }> }>) {
      const b = r.books
      const title = Array.isArray(b) ? b[0]?.title : b?.title
      if (title) titles.add(normalize(title))
    }
    if (data.length < PAGE) break
  }
  return titles
}

// ── Report ────────────────────────────────────────────────────────────────

function renderReport(entries: Entry[], existing: Set<string>): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const newEntries = entries.filter(e => !existing.has(normalize(e.title)))
  const matched = entries.filter(e => existing.has(normalize(e.title)))

  // Count by publisher (top 10).
  const byPublisher = new Map<string, number>()
  for (const e of entries) {
    const p = e.publisher ?? '(unknown)'
    byPublisher.set(p, (byPublisher.get(p) ?? 0) + 1)
  }
  const topPublishers = [...byPublisher.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Count by author (top 15 — most-banned authors on the list).
  const byAuthor = new Map<string, number>()
  for (const e of entries) {
    if (!e.author) continue
    byAuthor.set(e.author, (byAuthor.get(e.author) ?? 0) + 1)
  }
  const topAuthors = [...byAuthor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  const lines: string[] = []
  lines.push('# Liste Otto — scope-rapport')
  lines.push('')
  lines.push(
    `Gegenereerd ${now}. Bron: Wikisource, "Ouvrages littéraires non désirables en France" (3e éd., 1943). Read-only audit.`,
  )
  lines.push('')
  lines.push('Historische context: Nazi-Vichy ban-lijst onder Duitse bezetting (Liste Otto). De 3e editie (mei 1943) is de meest complete. Elke entry hier was verboden om ideologische redenen (auteur was Joods/communist/antifascist, of inhoud was anti-Duits). Bij import zal `suggest-editorial-classification-gpt.ts` per record beslissen welke editorial framing nodig is.')
  lines.push('')
  lines.push('## Totalen')
  lines.push('')
  lines.push(`- **Geparseerde entries**: ${entries.length}`)
  lines.push(`- Met auteur: ${entries.filter(e => e.author).length}`)
  lines.push(`- Duitse-editie markering (\`*\` in source): ${entries.filter(e => e.germanEdition).length}`)
  lines.push(`- **Boeken al in DB** (titel-match): ${matched.length}`)
  lines.push(`- **Boeken NIEUW**: ${newEntries.length}`)
  lines.push('')

  lines.push('## Top 15 auteurs op de lijst (meest verboden titels)')
  lines.push('')
  lines.push('| auteur | aantal titels |')
  lines.push('|---|---:|')
  for (const [a, n] of topAuthors) lines.push(`| ${a} | ${n} |`)
  lines.push('')

  lines.push('## Top 10 uitgevers')
  lines.push('')
  lines.push('| uitgever | titels |')
  lines.push('|---|---:|')
  for (const [p, n] of topPublishers) lines.push(`| ${p} | ${n} |`)
  lines.push('')

  if (matched.length > 0) {
    lines.push(`## Overlap met huidige DB (${matched.length})`)
    lines.push('')
    lines.push('| auteur | titel | uitgever | publ. jaar |')
    lines.push('|---|---|---|---:|')
    for (const e of matched.slice(0, 30)) {
      lines.push(
        `| ${e.author ?? '_(anon)_'} | ${e.title} | ${e.publisher ?? ''} | ${e.publishedYear ?? ''} |`,
      )
    }
    if (matched.length > 30)
      lines.push(`| … en nog ${matched.length - 30} | | | |`)
    lines.push('')
  } else {
    lines.push('## Overlap met huidige DB')
    lines.push('')
    lines.push('_Geen titel-overlap gevonden — de Otto-lijst is volledig complementair aan onze huidige 52 FR-bans._')
    lines.push('')
  }

  lines.push(`## Sample 50 nieuwe entries`)
  lines.push('')
  lines.push('| auteur | titel | uitgever | publ. jaar | DE-ed. |')
  lines.push('|---|---|---|---:|:-:|')
  for (const e of newEntries.slice(0, 50)) {
    lines.push(
      `| ${e.author ?? '_(anon)_'} | ${e.title} | ${e.publisher ?? ''} | ${e.publishedYear ?? ''} | ${e.germanEdition ? '✓' : ''} |`,
    )
  }
  if (newEntries.length > 50)
    lines.push(`| … en nog ${newEntries.length - 50} | | | | |`)
  lines.push('')

  return lines.join('\n')
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  for (const f of INPUT_FILES) {
    if (!existsSync(f)) {
      console.error(`Missing snapshot: ${f}`)
      process.exit(1)
    }
  }

  console.log('Parsing Otto list snapshots…')
  const entries: Entry[] = []
  for (const f of INPUT_FILES) {
    const md = readFileSync(f, 'utf8')
    const parsed = parseFile(md)
    console.log(`  ${f}: ${parsed.length} entries`)
    entries.push(...parsed)
  }
  console.log(`  Total: ${entries.length}`)

  console.log('Fetching existing FR bans for overlap check…')
  const sb = adminClient()
  const existing = await fetchExistingFrTitles(sb)
  console.log(`  ${existing.size} existing FR bans`)

  writeFileSync(REPORT, renderReport(entries, existing))
  console.log(`\nReport → ${REPORT}`)

  const matched = entries.filter(e => existing.has(normalize(e.title)))
  console.log('')
  console.log('── Summary ──')
  console.log(`  Total parsed   : ${entries.length}`)
  console.log(`  Books in DB    : ${matched.length}`)
  console.log(`  Books NEW      : ${entries.length - matched.length}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
