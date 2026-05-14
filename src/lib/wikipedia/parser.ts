// Wikitext → ParsedRow extraction.
//
// Two responsibilities:
//   1. Section detection (split the page on ==/=== headings).
//   2. Table parsing per matched section (one wikitable per section in our
//      configured pages; multi-table sections would need extension).
//
// Wikitext is regex-parsed, not AST-parsed. The grammar is simple enough
// (cells start with `|`, headers with `!`, rows separated by `|-`) that a
// few targeted patterns get us correct output on the India page; pulling in
// a full wikitext parser library is not justified for one source.

import type { ColumnMap, ParsedRow, QualityFlag, SectionConfig } from './types'

export type SectionParseResult = {
  section: SectionConfig
  rows: ParsedRow[]
}

export function parseWikipediaPage(
  wikitext: string,
  sections: readonly SectionConfig[],
): SectionParseResult[] {
  const headings = collectHeadings(wikitext)
  const out: SectionParseResult[] = []
  for (const sec of sections) {
    const found = headings.findIndex(h => h.heading === sec.heading)
    if (found < 0) {
      out.push({ section: sec, rows: [] })
      continue
    }
    // Section ends at the next heading whose level is the same OR shallower
    // (i.e. smaller `===` count). A level-2 `== Germany ==` extends past its
    // own level-3 sub-sections (`=== Weimar Republic ===` etc.) and only
    // ends at the next level-2 heading. Without this, multi-country pages
    // like List_of_books_banned_by_governments cut Germany off at its first
    // sub-heading, missing all tables inside.
    const targetLevel = headings[found].level
    const start = headings[found].endIndex
    const nextSameOrShallower = headings
      .slice(found + 1)
      .find(h => h.level <= targetLevel)
    const end = nextSameOrShallower
      ? nextSameOrShallower.startIndex
      : wikitext.length
    const slice = wikitext.slice(start, end)
    out.push({
      section: sec,
      rows: parseWikitable(slice, sec.heading, sec.columns),
    })
  }
  return out
}

type HeadingMatch = { level: number; heading: string; startIndex: number; endIndex: number }

function collectHeadings(wikitext: string): HeadingMatch[] {
  const re = /^(={2,})\s*(.+?)\s*\1\s*$/gm
  const out: HeadingMatch[] = []
  for (const m of wikitext.matchAll(re)) {
    if (m.index === undefined) continue
    out.push({
      level: m[1].length,
      heading: m[2].trim(),
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    })
  }
  return out
}

function parseWikitable(
  slice: string,
  heading: string,
  columns: ColumnMap,
): ParsedRow[] {
  const tableStart = slice.search(/\{\|\s*class="[^"]*wikitable/)
  if (tableStart < 0) return []
  const bodyStart = slice.indexOf('\n', tableStart) + 1
  // Match the first `|}` that begins its own line, terminating the table.
  const closeMatch = slice.slice(bodyStart).match(/\n\|\}/)
  if (!closeMatch || closeMatch.index === undefined) return []
  const body = slice.slice(bodyStart, bodyStart + closeMatch.index)

  // Split into row-chunks on `|-`. The first chunk is everything before the
  // first `|-` (which is the header definition for tables that open with
  // `|-` immediately, but in some pages includes inline meta). The header
  // chunk is filtered out below by `!`-prefix detection.
  const rawChunks = body
    .split(/^\|-.*$/m)
    .map(c => c.trim())
    .filter(c => c.length > 0)

  const anchor = sectionAnchor(heading)
  const out: ParsedRow[] = []
  for (const chunk of rawChunks) {
    if (isHeaderChunk(chunk)) continue
    const row = parseRowCells(chunk, anchor, columns)
    if (row !== null) out.push(row)
  }
  return out
}

function isHeaderChunk(chunk: string): boolean {
  // Header rows contain cells that start with `!`.
  return chunk.split('\n').some(line => line.trimStart().startsWith('!'))
}

function sectionAnchor(heading: string): string {
  // Wikipedia anchors replace spaces with underscores; other chars stay as-is.
  return heading.replace(/ /g, '_')
}

function parseRowCells(
  chunk: string,
  anchor: string,
  columns: ColumnMap,
): ParsedRow | null {
  const lines = chunk.split('\n')
  const cells: string[] = []
  let buf: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('|') && !line.startsWith('|}')) {
      if (buf.length > 0) cells.push(buf.join(' '))
      // Strip leading '|' and any attribute prefix `style="..." |`. Cells
      // sometimes embed attributes like `| style="..." | actual content`.
      let stripped = line.slice(1)
      const attrEnd = stripped.indexOf(' | ')
      if (/^[^|]*\|/.test(stripped) && attrEnd > -1 && attrEnd < 60) {
        stripped = stripped.slice(attrEnd + 3)
      }
      buf = [stripped.trim()]
    } else if (line.length > 0) {
      buf.push(line.trim())
    }
  }
  if (buf.length > 0) cells.push(buf.join(' '))

  const expected =
    Math.max(
      columns.title,
      columns.authors,
      columns.year ?? -1,
      columns.state ?? -1,
      columns.notes,
    ) + 1
  if (cells.length < expected) return null

  const workCell = cells[columns.title]
  const authorCell = cells[columns.authors]
  const dateCell = columns.year !== null ? cells[columns.year] : null
  const stateCell = columns.state !== null ? cells[columns.state] : null
  const notesCell = cells.slice(columns.notes).join(' ')

  const rawTitle = stripWikitext(workCell)
  if (!rawTitle) {
    // No title → skip silently (per spec). Caller logs the count of skipped.
    return null
  }
  const { title, title_native, title_english_meaningful, needs_model_3_review } =
    splitModel3Title(rawTitle)
  const { authors, parser_flags: authorFlags } = parseAuthors(authorCell)
  const year = dateCell !== null ? parseYear(dateCell) : null
  const notesStripped = stripWikitext(notesCell)
  const stateStripped = stateCell !== null ? stripWikitext(stateCell) : null

  const quality_flags: QualityFlag[] = []
  if (year === null) quality_flags.push('incomplete_year')
  if (authors.length === 0) quality_flags.push('no_author')
  // Detect citation-needed markers in the *raw* cell text before stripping,
  // because the stripper removes both {{cn}} and [citation needed].
  if (/\{\{\s*(cn|citation needed)\b|\[citation needed\]/i.test(notesCell)) {
    quality_flags.push('citation_needed')
  }
  if (needs_model_3_review) quality_flags.push('model_3_review_needed')
  for (const f of authorFlags) quality_flags.push(f)

  return {
    year,
    title,
    title_native,
    title_english_meaningful,
    authors,
    state: stateStripped && stateStripped.length > 0 ? stateStripped : null,
    notes_raw: notesStripped,
    source_anchor: anchor,
    quality_flags,
  }
}

// ----------------------------------------------------------------------------
// Model 3 title splitter
// ----------------------------------------------------------------------------
//
// Some Wikipedia entries pack multiple title forms into one cell, e.g.:
//   "Meendezhum Pandiyar Varalaru (மீண்டெழும் பாண்டியர் வரலாறு) (meaning: Resurgence of Pandiyan History)"
//
// The parser splits these into `title` / `title_native` / `title_english_meaningful`
// and flags the row for review. It deliberately does NOT assign
// title_native_script or original_language — those are editor decisions that
// land in the review queue.

// Native-script content between parens. Unicode ranges cover the scripts
// we expect in the India page (Devanagari + Indic family) plus the common
// non-Latin scripts that may appear in other Wikipedia sources later.
const NATIVE_SCRIPT_PAREN =
  /\s*\(([^)]*[ऀ-෿一-鿿぀-ヿ؀-ۿ֐-׿Ѐ-ӿ][^)]*)\)/

const MEANING_PAREN = /\s*\(meaning:\s*([^)]+)\)/i

type Model3Split = {
  title: string
  title_native: string | null
  title_english_meaningful: string | null
  needs_model_3_review: boolean
}

function splitModel3Title(rawTitle: string): Model3Split {
  const nativeMatch = rawTitle.match(NATIVE_SCRIPT_PAREN)
  const meaningMatch = rawTitle.match(MEANING_PAREN)
  if (!nativeMatch && !meaningMatch) {
    return {
      title: rawTitle,
      title_native: null,
      title_english_meaningful: null,
      needs_model_3_review: false,
    }
  }
  let stripped = rawTitle
  if (nativeMatch) stripped = stripped.replace(NATIVE_SCRIPT_PAREN, '')
  if (meaningMatch) stripped = stripped.replace(MEANING_PAREN, '')
  return {
    title: stripped.replace(/\s+/g, ' ').trim(),
    title_native: nativeMatch ? nativeMatch[1].trim() : null,
    title_english_meaningful: meaningMatch ? meaningMatch[1].trim() : null,
    needs_model_3_review: true,
  }
}

// ----------------------------------------------------------------------------
// Wikitext stripping helpers
// ----------------------------------------------------------------------------

export function stripWikitext(input: string): string {
  let s = input
  // Drop <ref>…</ref> blocks (with or without attributes; both inline and
  // self-closing variants).
  s = s.replace(/<ref\b[^>]*\/>/gi, ' ')
  s = s.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, ' ')
  // Drop HTML comments before stripping templates so `{{nowrap|X<!-- y -->}}`
  // doesn't leave dangling `-->` after template strip.
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  // Drop other inline HTML tags (<br>, <small>, <i>, etc.).
  s = s.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, ' ')
  // Content-preserving template expansions (must run BEFORE the strip-all
  // template pass below). Wikipedia commonly wraps cells in these without
  // changing semantics; if we just drop the whole `{{...}}` we lose the cell
  // (e.g. `{{nowrap|''[[Title]]''}}` → empty title).
  //   {{nowrap|X}} → X
  //   {{nobr|X}}   → X (alias)
  //   {{lang|en|X}} → X (drop language tag, keep text)
  //   {{nbsp}}     → ' '
  //   {{nbh}}      → '‑' (non-breaking hyphen → regular hyphen for our purposes)
  //   {{spaces|N}} → ' '
  s = s.replace(/\{\{\s*(?:nowrap|nobr)\s*\|([^{}]+)\}\}/gi, '$1')
  s = s.replace(/\{\{\s*lang\s*\|[^|{}]+\|([^{}]+)\}\}/gi, '$1')
  s = s.replace(/\{\{\s*nbsp\s*\}\}/gi, ' ')
  s = s.replace(/\{\{\s*nbh\s*\}\}/gi, '-')
  s = s.replace(/\{\{\s*spaces\s*\|[^{}]*\}\}/gi, ' ')
  // Templates: {{cn}}, {{cite ...}}, etc. Two passes to handle nested
  // single-level braces; deeper nesting is rare in this content.
  s = s.replace(/\{\{[^{}]*\}\}/g, ' ')
  s = s.replace(/\{\{[^{}]*\}\}/g, ' ')
  // [citation needed]
  s = s.replace(/\[citation needed\]/gi, ' ')
  // Wiki internal links: [[Foo|Bar]] -> Bar; [[Foo]] -> Foo.
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1')
  // External links: [http://x text] -> text; [http://x] -> ''.
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
  s = s.replace(/\[https?:\/\/\S+\]/g, ' ')
  // Italic / bold wiki markers.
  s = s.replace(/'''/g, '')
  s = s.replace(/''/g, '')
  // HTML entities (last semantic step, before whitespace collapse). Must
  // run after wikitext-strip so we don't decode entities living inside
  // removed <ref>/template blocks; must run before whitespace collapse so a
  // decoded &nbsp; → ' ' gets normalized away if it sits next to other
  // spaces. Trigger case: India's Sahara row had "Rs.&nbsp;2&nbsp;billion"
  // landing verbatim in bans.description.
  s = decodeHtmlEntities(s)
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&laquo;': '«',
  '&raquo;': '»',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
}

// Decode the HTML entities Wikipedia mixes into table cells. The named map
// above covers the entities observed in the India corpus and the common
// punctuation set; numeric (&#160;) and hex (&#xA0;) entities are decoded
// generically so a new source can throw whatever HTML it likes at us without
// requiring a code change. No external dependency: `he` / `html-entities`
// would carry hundreds of obscure entities (&zwnj; etc.) we don't need.
function decodeHtmlEntities(text: string): string {
  if (!text) return text
  let result = text
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    if (result.includes(entity)) {
      result = result.split(entity).join(char)
    }
  }
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(parseInt(code, 10)),
  )
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCodePoint(parseInt(code, 16)),
  )
  return result
}

// Word-isolated " or " between two author candidates. Word boundaries
// protect against false positives in author names that happen to contain
// the letters "or" (e.g. "Theodor Adorno", "Doctor Strange") — those have
// no standalone "or" token surrounded by whitespace.
const AUTHOR_DISJUNCTION = /\s+\bor\b\s+/i

export type ParseAuthorsResult = {
  authors: string[]
  parser_flags: QualityFlag[]
}

function parseAuthors(cell: string): ParseAuthorsResult {
  const stripped = stripWikitext(cell)
  if (!stripped) return { authors: [], parser_flags: [] }
  // Reject non-author placeholders that appear in the India page.
  if (/^(various|religious text|followers of\b|anonymous)\b/i.test(stripped)) {
    return { authors: [], parser_flags: [] }
  }

  // "X or Y" disjunction: alternative attribution that we cannot disambiguate
  // without external lookup. Keep only the first candidate and flag the row
  // for editorial review. This was the failure mode that produced
  // "Pandit M. A. Chamupati or Krishan Prashaad Prataab" as a single
  // author string in the first India --apply run.
  if (AUTHOR_DISJUNCTION.test(stripped)) {
    const first = stripped.split(AUTHOR_DISJUNCTION)[0]
    const cleaned = stripAuthorPrefixes(first.trim())
    return {
      authors: cleaned.length > 0 ? [cleaned] : [],
      parser_flags: ['author_disjunction'],
    }
  }

  // Standard path: split on commas and " and ". Intentionally do NOT split
  // on " or " — that was already handled above.
  const authors = stripped
    .split(/\s*,\s*|\s+and\s+/i)
    .map(s => stripAuthorPrefixes(s.trim()))
    .filter(s => s.length > 0)
  return { authors, parser_flags: [] }
}

// Strips editorial-role prefixes ("Edited by", "Editor:", "Ed.", "Eds.") so
// that "Edited by Maroof Raza" becomes "Maroof Raza". The editor of a volume
// is not the author of its banned content; we route these to the author
// field for now (no separate editor column exists), so at minimum the name
// must be clean.
const EDITOR_PREFIX = /^(edited by|editor:|edited:\s*|eds\.|ed\.)\s*/i

// Strips honorific / academic / religious prefixes so that the display_name
// in the `authors` table matches the existing title-less convention. Leaving
// a prefix in causes dedup misses when the same author appears elsewhere
// without the honorific — the trigger case for commit 8 was
// "Pandit M. A. Chamupati" (Wikipedia) vs "M.A. Chamupati" (DB) on the
// Rangila Rasul row. Trailing period is optional on the academic ones
// (Dr / Dr.). Religious / Indic honorifics added in commit 8 mostly need a
// bare-word match (Pandit, Sri, Shri, Swami, Maulana, Maulvi, Imam).
const ACADEMIC_PREFIXES: ReadonlyArray<RegExp> = [
  // commit 7 — academic / Western honorifics
  /^Dr\.?\s+/i,
  /^Prof\.?\s+/i,
  /^Mr\.?\s+/i,
  /^Mrs\.?\s+/i,
  /^Ms\.?\s+/i,
  /^Sir\s+/i,
  /^Lord\s+/i,
  // commit 8 — religious / Indic / Islamic honorifics
  /^Pandit\s+/i,
  /^Pt\.?\s+/i,
  /^Sri\s+/i,
  /^Shri\s+/i,
  /^Swami\s+/i,
  /^Maulana\s+/i,
  /^Maulvi\s+/i,
  /^Imam\s+/i,
]

function stripAuthorPrefixes(name: string): string {
  let s = name.replace(EDITOR_PREFIX, '').trim()
  for (const prefix of ACADEMIC_PREFIXES) {
    s = s.replace(prefix, '')
  }
  return s.trim()
}

function parseYear(cell: string): number | null {
  const stripped = stripWikitext(cell)
  const match = stripped.match(/(\d{4})/)
  if (!match) return null
  const y = parseInt(match[1], 10)
  if (y < 1500 || y > 2100) return null
  return y
}
