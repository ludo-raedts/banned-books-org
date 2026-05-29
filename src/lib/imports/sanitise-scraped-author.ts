// Defensive cleanup for author names produced by HTML scrapers that bleed
// list-section headers, role prefixes, or book metadata into the author
// field. Detected in the 2026-05-27 PEN-Belarus import audit; 13 records
// had to be repaired retroactively. This sanitiser catches the same
// patterns at import time so a re-scrape can't reproduce them.
//
// Returns `{ cleanName, reason }`:
//   - `cleanName: string` when the input could be cleaned to a real name
//   - `cleanName: null`   when the input is not a name at all (e.g.
//                         book title accidentally pushed onto the authors
//                         array) and should be skipped
//   - `reason: string | null` names which pattern fired, for log output;
//     null when the input passed through untouched
//
// All patterns target structural artefacts only (section headers, role
// prefixes, garbage punctuation). Honorifics and academic suffixes are
// handled separately by canonicaliseAuthorName().

export type Sanitised = { cleanName: string | null; reason: string | null }

// "Author (Country) DD.MM.YYYY (N items):" — the list-section heading on
// the Belarus site, accidentally captured by the scraper as the first
// item's author.
const SECTION_HEADER_SUFFIX =
  /\s*\(([A-Za-z][\w\s]+)\)\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+\(\d+\s+items\):?\s*$/

// Role prefixes: "Translations — X", "ed. by X", "Foreword by X", "illus.
// by X", …. Optional dash separator after the role word covers
// "Translations — X". `illus.` and the full `illustrated by` cover comics
// credits that the PEN scraper attached to the author field for graphic
// novels (Chip Zdarsky, Stevie Lewis, …).
const ROLE_PREFIX =
  /^(?:Translations?|Translated by|ed\.\s+by|Edited by|Editor:?|Foreword by|Preface by|Introduction by|Compiled by|Illustrated by|illus\.\s+by)\s*[-–—:]?\s*/i

// Trailing "et al" / ",Etc" tags that label an unnamed second author. Drop
// them — the named author stays as-is.
const TRAILING_ETC =
  /\s*[,;]?\s*(et\s+al\.?|etc\.?|and\s+others?)\s*$/i

// Garbage at the start: ") – ", "— ", "- ", ", " etc. left over from
// regex/split splits in the scraper.
const GARBAGE_PREFIX = /^[)\s\-–—,;:]+/

// "(Real Name) Pen Name" — Malay/Indonesian convention where the real
// civil name sits in leading parens followed by the pseudonym. The
// inverse "Pen Name (Real Name)" is already handled by the import dedupe
// (single canonical row); only this reverse form trips up slug uniqueness.
const REVERSE_PEN_NAME = /^\(([^)]+)\)\s*(.+)$/

// Trailing standalone "(Country)" or "(USA)" tag with no other content —
// only triggers when nothing follows the close paren. Avoids stripping
// legitimate parenthesised disambiguators that may appear mid-name.
const TRAILING_COUNTRY = /\s+\((USA|UK|UAE|U\.S\.A\.|U\.K\.|[A-Z][a-z]+)\)\s*$/

// "Title – Author" — when the scraper concatenated a book reference with
// the actual author. We only accept the post-dash segment as a name when
// it looks like a Western personal name (≤4 capitalised tokens).
const DASH_AUTHOR = /^(.+?)\s+[\-–—]\s+([A-ZА-ЯĀ-ʯ][\p{L}'-]+(?:\s+[A-ZА-ЯĀ-ʯ][\p{L}'-]+){1,3})\s*$/u

// Title-with-unmatched-paren — clearly a book title that ended up in the
// authors array (e.g. "Murder on Makajonka Street (Warsaw"). Reject.
const UNMATCHED_PAREN_TITLE = /^[A-Z][^()]*\s+\([A-Z][\p{L}\s]+$/u

export function sanitiseScrapedAuthor(raw: string): Sanitised {
  let name = raw.trim()
  if (!name) return { cleanName: null, reason: 'empty' }
  let reason: string | null = null
  const fire = (r: string) => { reason = reason ?? r }

  // Hard-reject: misplaced book title with city tail.
  if (UNMATCHED_PAREN_TITLE.test(name)) {
    return { cleanName: null, reason: 'unmatched-paren-title-swap' }
  }

  // Strip garbage prefix first so later patterns line up.
  {
    const s = name.replace(GARBAGE_PREFIX, '').trim()
    if (s !== name) { name = s; fire('garbage-prefix') }
  }

  // Strip section-header suffix.
  {
    const s = name.replace(SECTION_HEADER_SUFFIX, '').trim()
    if (s !== name) { name = s; fire('section-header') }
  }

  // Strip role prefix.
  {
    const s = name.replace(ROLE_PREFIX, '').trim()
    if (s !== name) { name = s; fire('role-prefix') }
  }

  // Strip trailing "et al" / ",Etc" / "and others".
  {
    const s = name.replace(TRAILING_ETC, '').trim()
    if (s !== name) { name = s; fire('trailing-etc') }
  }

  // Reverse pen-name: "(Real) Pen" → "Pen".
  {
    const m = REVERSE_PEN_NAME.exec(name)
    if (m && m[2].trim().length >= 2) {
      name = m[2].trim()
      fire('reverse-pen-name')
    }
  }

  // Trailing country tag (only if reason already triggered OR name now has 3+
  // tokens, to avoid eating legitimate (USA)/(UK)/(Japan) disambiguators
  // when that's all we have).
  {
    const s = name.replace(TRAILING_COUNTRY, '').trim()
    if (s !== name && (reason || s.split(/\s+/).length >= 2)) {
      name = s
      fire('trailing-country')
    }
  }

  // Title-prepended author: take the post-dash personal-name segment.
  {
    const m = DASH_AUTHOR.exec(name)
    if (m) {
      name = m[2].trim()
      fire('title-dash-author')
    }
  }

  return { cleanName: name || null, reason }
}
