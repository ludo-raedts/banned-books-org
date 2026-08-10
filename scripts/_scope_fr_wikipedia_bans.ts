#!/usr/bin/env tsx
/**
 * Scope the French Wikipedia article "Liste de livres censurés en France"
 * as a potential ban-data source. Read-only — produces a markdown report at
 * `data/fr-wikipedia-bans-scope.md` listing candidate entries, classification
 * (book vs periodical), and overlap with current `bans` table (country_code
 * = 'FR'). No DB writes, no Firecrawl credits used (uses local markdown
 * snapshot fetched via firecrawl earlier).
 *
 * Run:
 *   1. firecrawl scrape "https://fr.wikipedia.org/wiki/Liste_de_livres_censur%C3%A9s_en_France" \
 *        --only-main-content --format markdown -o /tmp/fr-list.md
 *   2. pnpm tsx --env-file=.env.local scripts/_scope_fr_wikipedia_bans.ts
 *
 * Sections parsed:
 *   • "Publications ayant été interdites en application de l'article 14"
 *     — interior ministry bans 1949-1999. Largest section (~2000 lines).
 *   • "Livres condamnés en France par la justice"
 *     — court-ordered condemnations.
 *   • "Liste des publications interdites de vente aux mineurs"
 *     — youth-protection limits.
 *   • Period sub-sections (Ancien Régime, Révolution, …) — sparse.
 *
 * Per-entry format expected:
 *   - [Author](wiki-url), _Title_: JO du DATE, p.PAGE; (autorisée le DATE)
 *   - _Periodical Title_; (description); [JO du DATE, p.PAGE]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const INPUT = '/tmp/fr-list.md'
const REPORT = join(process.cwd(), 'data/fr-wikipedia-bans-scope.md')

type Section =
  | 'article-14' // interior ministry bans 1949-99 (mostly periodicals + some books)
  | 'court-condemnation' // court rulings
  | 'youth-protection' // 1949 commission bans
  | 'historical' // Ancien Régime → 3e République sections
  | 'unknown'

type Entry = {
  raw: string
  section: Section
  governmentContext: string | null // e.g. "par Jules Moch (gouvernement Henri Queuille - 1948-1949)"
  author: string | null
  title: string
  year: number | null
  joCitation: string | null // "JO du 14 mars 1950, p.2827"
  authorised: string | null // "autorisée le 21 mars 1953"
  classification: 'book' | 'periodical' | 'unknown'
  sourceUrl: string
}

// ── Parse ──────────────────────────────────────────────────────────────────

const SECTION_HEADERS: Array<{ re: RegExp; section: Section }> = [
  {
    re: /^### Publications ayant été interdites en application de l'article 14/,
    section: 'article-14',
  },
  {
    re: /^### Livres condamnés en France par la justice/,
    section: 'court-condemnation',
  },
  {
    re: /^### Liste des publications interdites de vente aux mineurs/,
    section: 'youth-protection',
  },
  {
    re: /^### Sous (l'Ancien Régime|la Révolution|le Consulat|la Première Restauration|les cent jours|la Seconde Restauration|la monarchie|le Gouvernement provisoire|la Deuxième République|le Second Empire|le Gouvernement de la Défense|l'Assemblée nationale de 1871|la Troisième République|l'État français|le Gouvernement provisoire de la République)/,
    section: 'historical',
  },
]

// "##### par [Jules Moch](url) (gouvernement Henri Queuille - 1948-1949)" —
// captures the responsible minister + parliament context.
const GOVERNMENT_RE = /^#{4,5} par /

// Bullet items: "- _Title_: ..." or "- [Author](url), _Title_: ..."
const BULLET_RE = /^- (.+)$/

// Author detection — tries two shapes in order:
//   1. Markdown-link author: "[Henry Miller](url), _Sexus_: …"
//   2. Plain-text author:    "Mary Yeates, _La Discrimination raciale_; …"
// The plain-text path is needed because many entries in this Wikipedia
// article cite authors without internal links (especially for foreign /
// less-notable writers). The plain-text capture stops at the first comma
// before an italic-underscored title, and requires the candidate to start
// with a capital letter so we don't snag periodical descriptions.
const AUTHOR_LINK_RE = /^\[([^\]]+)\]\([^)]+\),\s*/
const AUTHOR_PLAIN_RE = /^([A-ZÀ-ÖØ-Þ][\p{L}\p{M}'.\-\s]{1,80}?),\s*(?=_)/u

// Pull title from underscored italics: "_Sexus_". After extraction we strip
// any markdown-link bleed-through (`Title](url)` artefacts that survive when
// the source had `_[Title](url)_`).
const TITLE_RE = /_([^_\n]{2,})_/

function cleanTitle(raw: string): string {
  // If a markdown link bleeds in, cut at the `]( boundary.
  const cut = raw.indexOf('](')
  const sliced = cut >= 0 ? raw.slice(0, cut).replace(/^\[/, '') : raw
  // Strip leading/trailing brackets that survive (e.g., `[Title`).
  return sliced.replace(/^\[+|\]+$/g, '').trim()
}

// JO citation: "JO du 14 mars 1950, p.2827" or "[JO du 14 mars 1950, p.2827]"
const JO_RE = /\[?JO du (\d+\s*(?:er)?\s*[a-zéûôî]+\s*\d{4})(?:,\s*p\.\d+)?/i

// Year from any "DDDD" sequence. Range: 1500-2099 — covers the historical
// laws section (1500s onward) AND modern bans (Reynouard 2000 was being
// missed by the old 1500-1999 regex).
const YEAR_RE = /\b(1[5-9]\d{2}|20[0-2]\d)\b/

// "autorisée le 6 novembre 1968" — when the ban was lifted.
const AUTHORISED_RE = /autoris[ée]e? le ([^[;)]+)/i

// Heuristics for periodical-vs-book detection. Periodical entries in this
// list typically (a) have no author link, (b) describe the work as "(revue
// X)" or "(journal Y)" or "(hebdomadaire Z)", (c) reference Cyrillic /
// non-Latin language ("publication soviétique", "journal en langue
// roumaine"). Books usually have an author link.
const PERIODICAL_KW =
  /(revue|journal|hebdomadaire|publication|bulletin|gazette|magazine|quotidien|presse|périodique|almanach|calendrier|annales)\b/i

function classifyAsBookOrPeriodical(
  author: string | null,
  rawAfterTitle: string,
): 'book' | 'periodical' | 'unknown' {
  if (PERIODICAL_KW.test(rawAfterTitle)) return 'periodical'
  if (author) return 'book'
  return 'unknown'
}

function parse(md: string): Entry[] {
  const lines = md.split('\n')
  const entries: Entry[] = []
  let section: Section = 'unknown'
  let government: string | null = null

  for (const rawLine of lines) {
    // Section header?
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

    // Government sub-heading?
    if (GOVERNMENT_RE.test(rawLine)) {
      // Strip the leading ##### and markdown links to get a clean label.
      government = rawLine
        .replace(/^#+ /, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
      continue
    }

    if (section === 'unknown') continue

    const bullet = rawLine.match(BULLET_RE)
    if (!bullet) continue
    const body = bullet[1]

    // Skip stub markers and bullet lines that are obviously not entries.
    if (/Cette section est vide/.test(body)) continue
    if (body.length < 4) continue

    // Author extraction (optional). Try markdown-link first; fall back to
    // plain-text capture before the italic title.
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

    // Title.
    const t = rest.match(TITLE_RE)
    if (!t) continue
    const title = cleanTitle(t[1])
    if (title.length < 2) continue
    const afterTitle = rest.slice(rest.indexOf(t[0]) + t[0].length)

    // JO citation (needed — otherwise it's probably not a ban-event line).
    const j = afterTitle.match(JO_RE) || body.match(JO_RE)
    if (!j) continue
    const joCitation = j[0].replace(/^\[/, '')

    // Year.
    const y = j[1].match(YEAR_RE)
    const year = y ? parseInt(y[1], 10) : null

    const auth = afterTitle.match(AUTHORISED_RE)
    const authorised = auth ? auth[1].trim() : null

    const classification = classifyAsBookOrPeriodical(author, afterTitle)

    entries.push({
      raw: body,
      section,
      governmentContext: government,
      author,
      title,
      year,
      joCitation,
      authorised,
      classification,
      sourceUrl: 'https://fr.wikipedia.org/wiki/Liste_de_livres_censurés_en_France',
    })
  }

  return entries
}

// ── DB overlap check ──────────────────────────────────────────────────────

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
    for (const r of data as Array<{ book_id: number; books: { title: string } | Array<{ title: string }> }>) {
      const b = r.books
      const title = Array.isArray(b) ? b[0]?.title : b?.title
      if (title) titles.add(normalize(title))
    }
    if (data.length < PAGE) break
  }
  return titles
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Report ────────────────────────────────────────────────────────────────

function renderReport(
  entries: Entry[],
  existing: Set<string>,
): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  // Bucket by section + classification + whether already in DB.
  const total = entries.length
  const bySection = new Map<Section, Entry[]>()
  for (const e of entries) {
    if (!bySection.has(e.section)) bySection.set(e.section, [])
    bySection.get(e.section)!.push(e)
  }

  const books = entries.filter(e => e.classification === 'book')
  const periodicals = entries.filter(e => e.classification === 'periodical')
  const unknown = entries.filter(e => e.classification === 'unknown')

  const newBooks = books.filter(e => !existing.has(normalize(e.title)))
  const matchedBooks = books.filter(e => existing.has(normalize(e.title)))

  const lines: string[] = []
  lines.push('# Frans Wikipedia ban-data — scope-rapport')
  lines.push('')
  lines.push(`Gegenereerd ${now}. Bron: \`Liste de livres censurés en France\` (fr.wikipedia.org). Read-only audit; geen DB-writes.`)
  lines.push('')
  lines.push('## Totalen')
  lines.push('')
  lines.push(`- **Geparseerde entries**: ${total}`)
  lines.push(`- Boeken: ${books.length}`)
  lines.push(`- Periodieken: ${periodicals.length}`)
  lines.push(`- Onbekende classificatie: ${unknown.length}`)
  lines.push('')
  lines.push(`- **Boeken die al in DB staan** (titel-match): ${matchedBooks.length}`)
  lines.push(`- **Boeken NIEUW** (delta met huidige FR-bans): ${newBooks.length}`)
  lines.push('')

  lines.push('## Per sectie')
  lines.push('')
  lines.push('| sectie | totaal | boeken | periodieken | onbekend |')
  lines.push('|---|---:|---:|---:|---:|')
  for (const [s, arr] of bySection.entries()) {
    const b = arr.filter(e => e.classification === 'book').length
    const p = arr.filter(e => e.classification === 'periodical').length
    const u = arr.filter(e => e.classification === 'unknown').length
    lines.push(`| ${s} | ${arr.length} | ${b} | ${p} | ${u} |`)
  }
  lines.push('')

  lines.push('## Boek-overlap met huidige DB')
  lines.push('')
  if (matchedBooks.length === 0) {
    lines.push('_Geen titel-overlap gevonden tussen de Wikipedia-lijst en de huidige 52 FR-bans._')
  } else {
    lines.push('| jaar | auteur | titel | JO-citatie |')
    lines.push('|---:|---|---|---|')
    for (const e of matchedBooks.slice(0, 30)) {
      lines.push(
        `| ${e.year ?? '?'} | ${e.author ?? '_(anon)_'} | ${e.title} | ${e.joCitation ?? ''} |`,
      )
    }
    if (matchedBooks.length > 30)
      lines.push(`| … en nog ${matchedBooks.length - 30} | | | |`)
  }
  lines.push('')

  lines.push(`## Top ${Math.min(50, newBooks.length)} nieuwe boeken (kandidaten voor import)`)
  lines.push('')
  newBooks.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
  lines.push('| jaar | auteur | titel | sectie | regering | JO-citatie | opgeheven |')
  lines.push('|---:|---|---|---|---|---|---|')
  for (const e of newBooks.slice(0, 50)) {
    lines.push(
      `| ${e.year ?? '?'} | ${e.author ?? '_(anon)_'} | ${e.title} | ${e.section} | ${e.governmentContext ?? ''} | ${e.joCitation ?? ''} | ${e.authorised ?? ''} |`,
    )
  }
  if (newBooks.length > 50)
    lines.push(`| … en nog ${newBooks.length - 50} | | | | | | |`)
  lines.push('')

  // Sample of periodicals — for the user to judge whether these belong in
  // the dataset at all (banned-books.org or banned-publications.org?).
  lines.push(`## Sample periodieken (eerste 20)`)
  lines.push('')
  lines.push('Voor context: het overgrote deel van de art. 14-sectie zijn Koude-Oorlog-periodieken (Sovjet/Spaanse/Italiaanse kranten). Beslissing nodig: passen die binnen "banned books"-scope?')
  lines.push('')
  lines.push('| jaar | titel | JO-citatie |')
  lines.push('|---:|---|---|')
  for (const e of periodicals.slice(0, 20)) {
    lines.push(`| ${e.year ?? '?'} | ${e.title} | ${e.joCitation ?? ''} |`)
  }
  lines.push('')

  return lines.join('\n')
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(INPUT)) {
    console.error(`Missing snapshot: ${INPUT}`)
    console.error('Run first:')
    console.error(
      "  firecrawl scrape 'https://fr.wikipedia.org/wiki/Liste_de_livres_censur%C3%A9s_en_France' --only-main-content --format markdown -o /tmp/fr-list.md",
    )
    process.exit(1)
  }

  const md = readFileSync(INPUT, 'utf8')
  console.log(`Parsing ${md.split('\n').length} lines from snapshot…`)
  const entries = parse(md)
  console.log(`  Parsed ${entries.length} candidate entries`)

  console.log('Fetching existing FR bans for overlap check…')
  const sb = adminClient()
  const existing = await fetchExistingFrTitles(sb)
  console.log(`  ${existing.size} existing FR bans (by normalized title)`)

  const report = renderReport(entries, existing)
  writeFileSync(REPORT, report)
  console.log(`\nReport → ${REPORT}`)

  // Console summary.
  const books = entries.filter(e => e.classification === 'book')
  const periodicals = entries.filter(e => e.classification === 'periodical')
  const newBooks = books.filter(e => !existing.has(normalize(e.title)))
  console.log('')
  console.log('── Summary ──')
  console.log(`  Total parsed   : ${entries.length}`)
  console.log(`  Books          : ${books.length}`)
  console.log(`  Periodicals    : ${periodicals.length}`)
  console.log(`  Books NEW      : ${newBooks.length}`)
  console.log(`  Books in DB    : ${books.length - newBooks.length}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
