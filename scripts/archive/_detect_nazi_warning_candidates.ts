#!/usr/bin/env tsx
/**
 * Detector: scan the books catalogue for entries that likely warrant a
 * `context` or `extended` warning_level under the project's editorial
 * policy — specifically Nazi-ideology grondteksten, Holocaust-denial
 * tracts, and prominent Nazi-collaborator memoirs.
 *
 * Read-only. Produces a prioritized markdown review list at
 * `data/nazi-warning-candidates.md`. No DB writes. The intended workflow:
 *
 *   1. Run this detector — produces a candidate list ranked by signal-strength
 *   2. Filter the admin /books view to "Unclassified" — cross-reference IDs
 *   3. For each genuine candidate, manually set warning_level via admin
 *      (or via the `_apply_fr_nazi_warning_tiers.ts` pattern in bulk)
 *
 * Signals (each contributes to a numeric score):
 *   • Author is a known Nazi figure / Holocaust denier / fascist ideologue
 *   • Title keyword matches (Holocaust, Mein Kampf, Aryan, …) in any language
 *   • Description / censorship_context contains denial / Nazi-content markers
 *   • Banned in countries that target such content explicitly
 *     (DE Volksverhetzung, FR Gayssot Act, AT Verbotsgesetz)
 *
 * Books that already have a non-none tier are excluded — we don't want to
 * re-flag the 13 context + 8 extended entries already curated.
 *
 *   pnpm tsx --env-file=.env.local scripts/_detect_nazi_warning_candidates.ts
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const PAGE = 1000
const REPORT = join(process.cwd(), 'data/nazi-warning-candidates.md')

// ── Signal vocabularies ───────────────────────────────────────────────────

// Known Nazi figures, Holocaust deniers, prominent fascist ideologues.
// Case-insensitive substring match against author display_name. Curated
// list — keep additions deliberate; this drives a review queue, not auto-
// apply.
const NAZI_AUTHORS: Array<{ name: string; tier: 'extended' | 'context'; note: string }> = [
  // — Foundational Nazi ideologues (extended candidate-pool) —
  { name: 'Adolf Hitler', tier: 'extended', note: 'Nazi regime founder' },
  { name: 'Alfred Rosenberg', tier: 'extended', note: 'NSDAP chief theorist' },
  { name: 'Joseph Goebbels', tier: 'extended', note: 'Reich propaganda minister' },
  { name: 'Heinrich Himmler', tier: 'extended', note: 'Reichsführer-SS' },
  { name: 'Julius Streicher', tier: 'extended', note: 'Der Stürmer publisher' },

  // — Holocaust deniers / revisionists (context) —
  { name: 'Vincent Reynouard', tier: 'context', note: 'Holocaust denier' },
  { name: 'Jürgen Graf', tier: 'context', note: 'Holocaust denier' },
  { name: 'Robert Faurisson', tier: 'context', note: 'Holocaust denier' },
  { name: 'Roger Garaudy', tier: 'context', note: 'Holocaust denier (later career)' },
  { name: 'Carlo Mattogno', tier: 'context', note: 'Holocaust denier' },
  { name: 'Ernst Zündel', tier: 'context', note: 'Holocaust denier' },
  { name: 'Germar Rudolf', tier: 'context', note: 'Holocaust denier' },
  { name: 'David Irving', tier: 'context', note: 'Holocaust denier / historian struck off' },
  { name: 'Arthur Butz', tier: 'context', note: 'Holocaust denier' },

  // — Nazi-collaborator authors (context) —
  { name: 'Léon Degrelle', tier: 'context', note: 'Belgian Rexist / Waffen-SS' },
  { name: 'Lucien Rebatet', tier: 'context', note: 'Vichy collaborator, Les Décombres' },
  { name: 'Robert Brasillach', tier: 'context', note: 'Vichy collaborator (executed 1945)' },
  { name: 'Marcel Déat', tier: 'context', note: 'Vichy collaborator' },
  { name: 'Pierre Drieu La Rochelle', tier: 'context', note: 'Vichy collaborator' },
  { name: 'Louis-Ferdinand Céline', tier: 'context', note: 'Antisemitic pamphlets specifically' },

  // — Other ideological / propagandist authors with established editorial precedent —
  { name: 'Henry Ford', tier: 'context', note: '"The International Jew" specifically' },
  { name: 'Houston Stewart Chamberlain', tier: 'context', note: 'racial theorist' },
]

// Title keyword patterns. Each weighted: high (strong indicator), medium
// (suggestive), low (weak). Multiple keywords stack.
const TITLE_KEYWORDS: Array<{ re: RegExp; weight: number; note: string }> = [
  { re: /Mein Kampf/i, weight: 5, note: 'Mein Kampf title' },
  { re: /Mythus des zwanzigsten|Myth of the Twentieth/i, weight: 5, note: 'Rosenberg foundational' },
  { re: /Protocols of the (Learned )?Elders of Zion|Protocoles des sages/i, weight: 5, note: 'antisemitic forgery' },
  { re: /Turner Diaries/i, weight: 5, note: 'foundational text' },
  { re: /\bHolocaust(e)?\b.*\b(scanner|mythe|mensonge|denial|fraud|hoax|industry|hoax)\b/i, weight: 4, note: 'Holocaust + denial-frame' },
  { re: /(négationnisme|negationism|révisionnisme historique)/i, weight: 4, note: 'denial framing' },
  { re: /\bAryan\b.*(race|supremacy|Nordic)/i, weight: 3, note: 'Aryan race rhetoric' },
  { re: /(National-Socialism|Nazional ?Sozialismus).*\b(ideology|grundlagen|principles)/i, weight: 3, note: 'NS ideology' },
  { re: /\b(Stürmer|Sturmer)\b/i, weight: 3, note: 'Der Stürmer' },
  { re: /\bSS\b.*Brigade|Waffen-?SS/i, weight: 2, note: 'SS-themed' },
]

// Description / censorship_context phrases.
const DESCRIPTION_KEYWORDS: Array<{ re: RegExp; weight: number; note: string }> = [
  { re: /Holocaust denial|negate the Holocaust|negationist/i, weight: 4, note: 'desc: Holocaust denial' },
  { re: /Nazi ideologue|Nazi theorist|NSDAP propaganda/i, weight: 3, note: 'desc: Nazi-ideologue framing' },
  { re: /(Waffen-?SS|Wehrmacht).*(memoir|apologia)/i, weight: 3, note: 'desc: Wehrmacht/SS apologia' },
  { re: /antisemit|anti-semit|judéophob/i, weight: 2, note: 'desc: antisemitic content' },
  { re: /Gayssot Act|Auschwitz Lie|Verbotsgesetz/i, weight: 3, note: 'desc: legal-framework citation' },
  { re: /Volksverhetzung/i, weight: 3, note: 'desc: DE incitement law' },
]

// ── Detection ──────────────────────────────────────────────────────────────

type Book = {
  id: number
  slug: string
  title: string
  description_book: string | null
  description_ban: string | null
  censorship_context: string | null
  warning_level: string | null
  authors: string[]
}

type Candidate = {
  book: Book
  score: number
  signals: string[]
  proposedTier: 'context' | 'extended'
}

function evaluate(b: Book): Candidate | null {
  const signals: string[] = []
  let score = 0
  let strongestTier: 'context' | 'extended' = 'context'

  // Author matches.
  for (const a of b.authors) {
    for (const m of NAZI_AUTHORS) {
      if (a.toLowerCase().includes(m.name.toLowerCase())) {
        signals.push(`author:${m.name} (${m.note})`)
        score += m.tier === 'extended' ? 5 : 3
        if (m.tier === 'extended') strongestTier = 'extended'
      }
    }
  }

  // Title.
  for (const k of TITLE_KEYWORDS) {
    if (k.re.test(b.title)) {
      signals.push(`title:${k.note}`)
      score += k.weight
      if (k.weight >= 5) strongestTier = 'extended'
    }
  }

  // Description / context fields.
  const descBlob = [b.description_book, b.description_ban, b.censorship_context]
    .filter(Boolean)
    .join(' ')
  for (const k of DESCRIPTION_KEYWORDS) {
    if (k.re.test(descBlob)) {
      signals.push(k.note)
      score += k.weight
    }
  }

  if (score === 0) return null
  return { book: b, score, signals, proposedTier: strongestTier }
}

// ── Data fetch ─────────────────────────────────────────────────────────────

async function fetchUnclassifiedBooks(
  sb: ReturnType<typeof adminClient>,
): Promise<Book[]> {
  const out: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select(
        'id, slug, title, description_book, description_ban, censorship_context, warning_level, book_authors(authors(display_name))',
      )
      .eq('warning_level', 'none')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as Array<{
      id: number
      slug: string
      title: string
      description_book: string | null
      description_ban: string | null
      censorship_context: string | null
      warning_level: string | null
      book_authors: Array<{ authors: { display_name: string } | Array<{ display_name: string }> }>
    }>) {
      const authors: string[] = []
      for (const link of r.book_authors ?? []) {
        const a = link.authors
        if (Array.isArray(a)) authors.push(...a.map(x => x.display_name))
        else if (a?.display_name) authors.push(a.display_name)
      }
      out.push({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description_book: r.description_book,
        description_ban: r.description_ban,
        censorship_context: r.censorship_context,
        warning_level: r.warning_level,
        authors,
      })
    }
    if (data.length < PAGE) break
  }
  return out
}

// ── Report ────────────────────────────────────────────────────────────────

function renderReport(cands: Candidate[], totalScanned: number): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  cands.sort((a, b) => b.score - a.score || a.book.id - b.book.id)

  const extendedCands = cands.filter(c => c.proposedTier === 'extended')
  const contextCands = cands.filter(c => c.proposedTier === 'context')

  const lines: string[] = []
  lines.push('# Nazi / Holocaust-denial warning-tier candidates')
  lines.push('')
  lines.push(`Gegenereerd ${now}. Scanned ${totalScanned} books with warning_level='none'. ${cands.length} candidate(s) flagged.`)
  lines.push('')
  lines.push('**Workflow**: review elke kandidaat in `/admin/books` → filter "Unclassified" → zoek op title / id → handmatig de juiste tier zetten in admin. Of: gebruik dezelfde pattern als `_apply_fr_nazi_warning_tiers.ts` voor een batch-update.')
  lines.push('')
  lines.push('De detector kijkt naar drie soorten signalen:')
  lines.push('1. Auteur op de curated lijst (Nazi-figuren, Holocaust-deniers, collaborators)')
  lines.push('2. Titel-keywords (Mein Kampf, Aryan, "Protocols of...", "Holocaust + denial-frame")')
  lines.push('3. Beschrijvings-keywords ("Holocaust denial", "Nazi ideologue", "Volksverhetzung", "Gayssot Act")')
  lines.push('')
  lines.push('Score per candidate is een ruwe optelsom van signal-weights. Hogere score = sterker geval.')
  lines.push('')

  lines.push(`## Voorgestelde tier: extended (${extendedCands.length})`)
  lines.push('')
  if (extendedCands.length === 0) {
    lines.push('_Geen voorstellen._')
  } else {
    lines.push('| score | id | title | author | signals |')
    lines.push('|---:|---:|---|---|---|')
    for (const c of extendedCands) {
      lines.push(
        `| ${c.score} | ${c.book.id} | [${c.book.title}](/books/${c.book.slug}) | ${c.book.authors.join(' / ') || '_(anon)_'} | ${c.signals.join('; ')} |`,
      )
    }
  }
  lines.push('')

  lines.push(`## Voorgestelde tier: context (${contextCands.length})`)
  lines.push('')
  if (contextCands.length === 0) {
    lines.push('_Geen voorstellen._')
  } else {
    lines.push('| score | id | title | author | signals |')
    lines.push('|---:|---:|---|---|---|')
    for (const c of contextCands) {
      lines.push(
        `| ${c.score} | ${c.book.id} | [${c.book.title}](/books/${c.book.slug}) | ${c.book.authors.join(' / ') || '_(anon)_'} | ${c.signals.join('; ')} |`,
      )
    }
  }
  lines.push('')

  return lines.join('\n')
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const sb = adminClient()
  console.log('Fetching unclassified books (warning_level=none)…')
  const books = await fetchUnclassifiedBooks(sb)
  console.log(`  ${books.length} books scanned`)

  const cands: Candidate[] = []
  for (const b of books) {
    const c = evaluate(b)
    if (c) cands.push(c)
  }

  writeFileSync(REPORT, renderReport(cands, books.length))

  console.log('')
  console.log('── Summary ──')
  console.log(`  Candidates flagged: ${cands.length}`)
  console.log(`  → extended tier  : ${cands.filter(c => c.proposedTier === 'extended').length}`)
  console.log(`  → context tier   : ${cands.filter(c => c.proposedTier === 'context').length}`)
  console.log('')
  console.log(`Report → ${REPORT}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
