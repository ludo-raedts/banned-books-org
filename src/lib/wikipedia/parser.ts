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
      rows: parseWikitable(slice, sec),
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
  section: SectionConfig,
): ParsedRow[] {
  const heading = section.heading
  const columns = section.columns
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
    const rows = parseRowCells(chunk, anchor, columns, section.multi_title_separator)
    out.push(...rows)
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
  multiTitleSeparator?: RegExp,
): ParsedRow[] {
  // Normalise inline `||` cell separators (Hong Kong page format:
  //   `| date || title || author || {{tick}} || ...`
  // — everything on one line) into the per-line `\n| cell` shape that the
  // line-loop below assumes. We do this BEFORE splitting on newlines so the
  // multi-cell single-line rows become canonical multi-line rows.
  // Note: `||` is a Wikipedia-table syntax token; it should not appear inside
  // arbitrary cell text on the pages we ingest, so a global replace is safe.
  const normalisedChunk = chunk.replace(/\s*\|\|\s*/g, '\n| ')
  const lines = normalisedChunk.split('\n')
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
      columns.notes_end ?? -1,
    ) + 1
  if (cells.length < expected) return []

  const workCell = cells[columns.title]
  const authorCell = cells[columns.authors]
  const dateCell = columns.year !== null ? cells[columns.year] : null
  const stateCell = columns.state !== null ? cells[columns.state] : null
  const notesEnd = columns.notes_end !== undefined
    ? columns.notes_end + 1   // inclusive end → exclusive slice
    : cells.length
  const notesCell = cells.slice(columns.notes, notesEnd).join(' ')

  // ── Title segmentation: 1 row by default, N rows when multi-title ─────
  // For Index Librorum-style rows where a single Works cell lists several
  // titles ("Title A;<br>Title B;<br>Title C"), we split BEFORE
  // wikitext-strip so the separator can look for markup-level boundaries
  // like `;<br>`. Splitting post-strip would mis-fire on titles that have
  // an internal `;` (e.g. "Religio Medici; the religion of a physician"
  // is a single title with a subtitle, not two works).
  const rawSegments: string[] = multiTitleSeparator
    ? workCell.split(multiTitleSeparator)
    : [workCell]
  const cleanedSegments = rawSegments
    .map(seg => stripWikitext(seg))
    .map(s => s.trim())
    .filter(s => s.length > 0)
  if (cleanedSegments.length === 0) {
    // No usable title in any segment → skip silently
    return []
  }

  // ── Common fields (shared across all titles for multi-title rows) ─────
  const { authors, author_meta, parser_flags: authorFlags } = parseAuthors(authorCell)
  const yearFromColumn = dateCell !== null ? parseYear(dateCell) : null
  const notesStripped = stripWikitext(notesCell)
  const stateStripped = stateCell !== null ? stripWikitext(stateCell) : null

  const baseFlags: QualityFlag[] = []
  if (authors.length === 0) baseFlags.push('no_author')
  if (/\{\{\s*(cn|citation needed)\b|\[citation needed\]/i.test(notesCell)) {
    baseFlags.push('citation_needed')
  }
  for (const f of authorFlags) baseFlags.push(f)

  const titleSegments = cleanedSegments

  const out: ParsedRow[] = []
  for (const segment of titleSegments) {
    // "+6 more" / "+N more" placeholders indicate the listed works are a
    // partial enumeration. These are not actual books; drop them.
    if (/^\+\s*\d+\s+more\b/i.test(segment)) continue

    const {
      title,
      title_native,
      title_transliterated,
      title_english_meaningful,
      year_extracted,
      needs_model_3_review,
    } = splitModel3Title(segment)

    // "All works" / "All works of theology" / etc. — Index Librorum
    // convention where a row's Works cell records that the Catholic Church
    // banned the author's entire output (or all output on a given subject)
    // rather than enumerating titles. Prefixing the author's name makes the
    // title unique per author and disambiguates the resulting books.slug.
    // Only fires when the section uses multi-title splitting (Index source).
    let finalTitle = title
    if (
      multiTitleSeparator
      && authors.length > 0
      && /^all works(\s+of\s+\w+)?$/i.test(title)
    ) {
      finalTitle = `${authors[0]} — ${title}`
    }

    const segmentYear = yearFromColumn ?? year_extracted
    const segmentFlags: QualityFlag[] = [...baseFlags]
    if (segmentYear === null) segmentFlags.push('incomplete_year')
    if (needs_model_3_review) segmentFlags.push('model_3_review_needed')

    out.push({
      year: segmentYear,
      title: finalTitle,
      title_native,
      title_transliterated,
      title_english_meaningful,
      authors,
      author_meta: author_meta.length > 0 ? author_meta : undefined,
      state: stateStripped && stateStripped.length > 0 ? stateStripped : null,
      notes_raw: notesStripped,
      source_anchor: anchor,
      quality_flags: segmentFlags,
    })
  }
  return out
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

// Trailing publication year in parens: "Jane Eyre (1847)". Restricted to
// 1500–2100 to avoid eating arbitrary 4-digit substrings like "Room 1984"
// (which would not match because the parens are required to be at end-of-
// string anyway).
const TRAILING_YEAR_PAREN = /\s*\((1[5-9]\d{2}|20\d{2}|2100)\)\s*$/

// Trailing publication-year range: "Death Note (2003 – 2006)" (China manga
// serialization runs), "Juliette (1797–1801)" (Index Librorum multi-volume),
// "Zhou Enlai (2003 or 2008)" (disputed dates). Takes the FIRST year as the
// canonical publication year. Both en-dash (–) and ASCII hyphen (-) accepted
// as the range separator; "or" handles the disjunction form.
const TRAILING_YEAR_RANGE_PAREN =
  /\s*\((1[5-9]\d{2}|20\d{2}|2100)\s*(?:[–-]|or)\s*(?:1[5-9]\d{2}|20\d{2}|2100)\)\s*$/i

// "(pub. YYYY)" / "(published YYYY)" variant — Index Librorum Prohibitorum
// rows use this form to flag the publication year of works listed alongside
// other annotations. The parens may appear in the MIDDLE of the title text
// (e.g. "Pensées (pub. 1670), with notes by Voltaire"), so we strip these
// independently of TRAILING_YEAR_PAREN.
const PUB_YEAR_PAREN_ANYWHERE =
  /\s*\((?:pub\.?|published)\s+(1[5-9]\d{2}|20\d{2}|2100)\)\s*/i

// Trailing English-translation parens for transliterated non-Latin titles:
// "ketāb-e sādeq-e hedāyat (The Book of Sadegh Hedayat)". Heuristic firing
// conditions (both must hold):
//   1. The leading title contains diacritics or transliteration marks typical
//      of Romanized non-Latin scripts (ā ē ī ō ū ḥ ṣ ṭ ẓ ḍ ʿ ʾ ʼ etc).
//      Pure-ASCII Latin titles are NOT eligible — that prevents
//      "New Portuguese Letters (Novas Cartas Portuguesas)" from getting
//      mis-split, since "New Portuguese Letters" is all ASCII.
//   2. The paren content is pure ASCII letters/punctuation — i.e. plausibly
//      an English gloss rather than another transliteration or year.
// The matched portion of the leading title is treated as a transliteration
// and surfaced via `title_transliterated` so the caller's downstream
// canonical-title logic (Sprint A doctrine: non-Latin → use transliteration)
// stays consistent.
const TRANSLITERATION_DIACRITICS =
  /[āēīōūĀĒĪŌŪḥṣṭẓḍṛḷĥŝẑṅñĩũĭŏěǎǐǒǔâêîôûñĝŝźżśćń̇ʿʾʼ̄̈̆̌]/
const TRAILING_ENGLISH_PAREN =
  /\s*\(([A-Za-z][A-Za-z0-9 \-'’.,!?:;]*)\)\s*$/

// "Native / Latin" bilingual title separator — Hong Kong format.
// Anchored to ` / ` with surrounding whitespace to avoid eating slashes in
// punctuation like dates ("4/2020").
const BILINGUAL_TITLE_SEPARATOR = /\s+\/\s+/

type Model3Split = {
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  year_extracted: number | null
  needs_model_3_review: boolean
}

function splitModel3Title(rawTitle: string): Model3Split {
  let working = rawTitle
  let year_extracted: number | null = null
  let title_native: string | null = null
  let title_transliterated: string | null = null
  let title_english_meaningful: string | null = null
  let needs_model_3_review = false

  // 0. "(pub. YYYY)" / "(published YYYY)" — Index Librorum convention.
  //    Strip first (anywhere in the title) so it doesn't interfere with the
  //    trailing-year detector below.
  const pubMatch = working.match(PUB_YEAR_PAREN_ANYWHERE)
  if (pubMatch) {
    year_extracted = parseInt(pubMatch[1], 10)
    working = working.replace(PUB_YEAR_PAREN_ANYWHERE, ' ').replace(/\s+/g, ' ').trim()
  }

  // 1. Trailing year — always strip, regardless of script. Caller decides
  //    whether to use year_extracted (only when no explicit year column).
  const yearMatch = working.match(TRAILING_YEAR_PAREN)
  if (yearMatch) {
    if (year_extracted === null) year_extracted = parseInt(yearMatch[1], 10)
    working = working.replace(TRAILING_YEAR_PAREN, '').trim()
  } else {
    // Range form: "(YYYY – YYYY)" / "(YYYY or YYYY)". Only consulted when
    // the single-year form didn't match, since matching both regexes against
    // the same paren is impossible.
    const rangeMatch = working.match(TRAILING_YEAR_RANGE_PAREN)
    if (rangeMatch) {
      if (year_extracted === null) year_extracted = parseInt(rangeMatch[1], 10)
      working = working.replace(TRAILING_YEAR_RANGE_PAREN, '').trim()
    }
  }

  // 1.5 Bilingual `Native-Script / Latin-Transliteration` title (Hong Kong
  //     book-censorship convention, e.g.
  //     `香港城邦論 : 一國兩制 / Xianggang cheng bang lun : yi guo liang zhi`).
  //     Per Sprint A doctrine the transliteration becomes the canonical
  //     `title` (slug-friendly), the native side fills `title_native`, and
  //     `title_transliterated` mirrors the canonical for consistency with
  //     other non-Latin sources. Pre-empts the parens-based splits below
  //     because the bilingual form has no parens.
  if (BILINGUAL_TITLE_SEPARATOR.test(working)) {
    const parts = working.split(BILINGUAL_TITLE_SEPARATOR)
    if (parts.length === 2) {
      const left = parts[0].trim()
      const right = parts[1].trim()
      if (NON_LATIN_SCRIPT_AUTHOR.test(left) && /[A-Za-z]/.test(right)) {
        title_native = left
        title_transliterated = right
        working = right
        needs_model_3_review = true
      }
    }
  }

  // 2. Native-script parens (anywhere in the title) — order before the
  //    English-paren detector so a row like "title (देवनागरी) (English)"
  //    gets both halves attributed correctly.
  const nativeMatch = working.match(NATIVE_SCRIPT_PAREN)
  if (nativeMatch) {
    title_native = nativeMatch[1].trim()
    working = working.replace(NATIVE_SCRIPT_PAREN, '').replace(/\s+/g, ' ').trim()
    needs_model_3_review = true
  }

  // 3. Explicit `(meaning: ...)` annotation (existing India case).
  const meaningMatch = working.match(MEANING_PAREN)
  if (meaningMatch) {
    title_english_meaningful = meaningMatch[1].trim()
    working = working.replace(MEANING_PAREN, '').replace(/\s+/g, ' ').trim()
    needs_model_3_review = true
  }

  // 4. Transliteration heuristic: if the leading title has transliteration
  //    diacritics AND a trailing pure-ASCII paren remains, split into
  //    title_transliterated + title_english_meaningful. Only fires when
  //    title_english_meaningful is still unset (avoids overwriting an
  //    explicit `(meaning: ...)` match above).
  if (!title_english_meaningful) {
    const engMatch = working.match(TRAILING_ENGLISH_PAREN)
    if (engMatch && TRANSLITERATION_DIACRITICS.test(working.replace(engMatch[0], ''))) {
      title_english_meaningful = engMatch[1].trim()
      const transliteration = working.replace(TRAILING_ENGLISH_PAREN, '').trim()
      title_transliterated = transliteration
      working = transliteration
      needs_model_3_review = true
    }
  }

  return {
    title: working.replace(/\s+/g, ' ').trim(),
    title_native,
    title_transliterated,
    title_english_meaningful,
    year_extracted,
    needs_model_3_review,
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
  //   {{Sort|sortkey|display}} → display (sortable-table wrapper on ALA page)
  //   {{Sortname|First|Last}}  → "First Last" (sortable name wrapper, ALA page)
  //   {{n/a|sort=X}}           → '' (rank-table "not applicable" cell, drop)
  s = s.replace(/\{\{\s*(?:nowrap|nobr)\s*\|([^{}]+)\}\}/gi, '$1')
  s = s.replace(/\{\{\s*lang\s*\|[^|{}]+\|([^{}]+)\}\}/gi, '$1')
  s = s.replace(/\{\{\s*nbsp\s*\}\}/gi, ' ')
  s = s.replace(/\{\{\s*nbh\s*\}\}/gi, '-')
  s = s.replace(/\{\{\s*spaces\s*\|[^{}]*\}\}/gi, ' ')
  // {{Sort|key|display}} — `display` may itself contain wikilinks but no
  // nested templates on the ALA page, so [^{}]* on the inner segment is safe.
  s = s.replace(/\{\{\s*sort\s*\|[^|{}]*\|([^{}]+)\}\}/gi, '$1')
  // {{Sortname|First|Last}} (optionally |Last|First style — keep both args
  // joined by a space, which gives "First Last" or "Last First" depending on
  // how the template was invoked; close enough for an author display name).
  s = s.replace(
    /\{\{\s*sortname\s*\|([^|{}]+)\|([^|{}]+?)(?:\|[^{}]*)?\}\}/gi,
    '$1 $2',
  )
  s = s.replace(/\{\{\s*n\/a\s*(?:\|[^{}]*)?\}\}/gi, ' ')
  // {{tick}} / {{cross}} (Wikipedia checkbox markers, common on the Hong Kong
  // book-censorship table). Preserve as a single Unicode char so a `notes`
  // column that spans checkbox cells keeps positional information — without
  // this they'd be stripped to whitespace by the generic template pass and
  // editors would see an empty description.
  s = s.replace(/\{\{\s*tick\s*\}\}/gi, '✓')
  s = s.replace(/\{\{\s*cross\s*\}\}/gi, '✗')
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

// "Lastname, Firstname" sorted-name pattern (Index Librorum convention).
// Both halves must look like proper names: 1-3 capitalized words, optional
// honorific abbreviation like "M." inside. We require EXACTLY one comma so
// we don't accidentally unflip "Smith, Jones, and Doe" (a 3-author list).
const SORTED_NAME =
  /^([A-Z][\p{L}'`’-]+(?:\s+(?:[A-Z][\p{L}'`’-]+|[A-Z]\.|de|van|von|der|le|la))*),\s+([A-Z][\p{L}'`’-]+(?:\s+(?:[A-Z][\p{L}'`’-]+|[A-Z]\.|de|van|von|der|le|la))*)$/u

function maybeUnflipSortedName(s: string): string {
  const m = s.match(SORTED_NAME)
  if (!m) return s
  return `${m[2].trim()} ${m[1].trim()}`
}

// "Native / Latin" bilingual author cell (Hong Kong book-censorship page
// convention: e.g. "陳雲 / Chen, Yun." → use the Latin form as the canonical
// display name). Detected by:
//   - exactly one ` / ` separator
//   - the LEFT side contains at least one non-Latin script character
//   - the RIGHT side starts with a Latin letter
// The native form is captured for diagnostic logging but is not surfaced to
// the importer's `authors` array yet — see the planned author-multilingualism
// follow-up (memory: project_author_multilingualism.md). For now we use the
// Latin form so downstream slugify + dedup + photo/bio enrichment work.
const BILINGUAL_AUTHOR_SEPARATOR = /\s+\/\s+/
const NON_LATIN_SCRIPT_AUTHOR =
  /[\p{Script=Han}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Hangul}\p{Script=Hebrew}\p{Script=Thai}]/u

// Returns the Latin form plus the captured native form when the input was a
// bilingual `Native / Latin` cell. When no bilingual pattern matches, returns
// the input unchanged and native=null. The Latin form has trailing periods
// stripped (HK convention adds them after surnames).
function maybeUnwrapBilingualAuthor(
  s: string,
): { display: string; name_native: string | null } {
  const parts = s.split(BILINGUAL_AUTHOR_SEPARATOR)
  if (parts.length !== 2) return { display: s, name_native: null }
  const [left, right] = parts.map(p => p.trim())
  if (!left || !right) return { display: s, name_native: null }
  if (NON_LATIN_SCRIPT_AUTHOR.test(left) && /^[A-Z]/.test(right)) {
    return {
      display: right.replace(/\.+\s*$/, ''),
      name_native: left,
    }
  }
  return { display: s, name_native: null }
}

export type ParseAuthorsResult = {
  authors: string[]
  // Per-author multilingual metadata, parallel-indexed to `authors`. Set
  // only when the source cell carried a native-script form alongside the
  // Latin display name. NULL otherwise. Surfaces as ParsedRow.author_meta
  // for downstream consumers (importer → authors.name_native).
  author_meta: Array<{ name_native: string | null } | null>
  parser_flags: QualityFlag[]
}

function parseAuthors(cell: string): ParseAuthorsResult {
  const stripped0 = stripWikitext(cell)
  if (!stripped0) return { authors: [], author_meta: [], parser_flags: [] }
  // Reject non-author placeholders that appear in the India page.
  if (/^(various|religious text|followers of\b|anonymous)\b/i.test(stripped0)) {
    return { authors: [], author_meta: [], parser_flags: [] }
  }
  // 1. Unwrap bilingual `Native / Latin` author cells (Hong Kong format).
  //    Must run BEFORE the sorted-name unflip because the right-hand-side
  //    of the bilingual pair is often itself in `Lastname, Firstname` form
  //    (e.g. "陳雲 / Chen, Yun." → "Chen, Yun" → unflip → "Yun Chen").
  // 2. Unflip "Lastname, Firstname" before the standard comma-split logic.
  //    Used by the Index Librorum Prohibitorum page where author cells are
  //    displayed in sorted form (e.g. "Machiavelli, Niccolo"). Without this,
  //    parseAuthors would emit two authors per cell.
  const { display, name_native } = maybeUnwrapBilingualAuthor(stripped0)
  const stripped = maybeUnflipSortedName(display)

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
      author_meta: cleaned.length > 0 ? [{ name_native }] : [],
      parser_flags: ['author_disjunction'],
    }
  }

  // Standard path: split on commas and " and ". Intentionally do NOT split
  // on " or " — that was already handled above. The native form (if any
  // was captured by the bilingual unwrap above) attaches to the FIRST
  // author only — the native cell is per-row, not per-author, on the HK
  // page; if a row had multiple authors with bilingual forms the source
  // would format them differently.
  const authors = stripped
    .split(/\s*,\s*|\s+and\s+/i)
    .map(s => stripAuthorPrefixes(s.trim()))
    .filter(s => s.length > 0)
  const author_meta = authors.map((_, i) =>
    i === 0 && name_native ? { name_native } : null,
  )
  return { authors, author_meta, parser_flags: [] }
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
