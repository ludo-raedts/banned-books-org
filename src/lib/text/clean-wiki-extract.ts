/**
 * Clean up the artefacts Wikipedia leaves in author / book extracts:
 *   1. HTML entities (`&#160;`, `&amp;`) returned by `prop=extracts` when
 *      the `explaintext` flag is not set
 *   2. Bracketed IPA pronunciations (`[vlɐˈdʲimʲɪr ...]`) that read as line
 *      noise to non-linguists
 *   3. The "pronounced …" / "<Language> pronunciation:" labels left behind
 *      after the bracket is removed
 *
 * Foreign-script content (Cyrillic, Greek, CJK, …) is preserved — only the
 * phonetic transcription and its label are stripped.
 */

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

export function decodeHtmlEntities(text: string): string {
  if (!text) return text
  let s = text
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    if (s.includes(entity)) s = s.split(entity).join(char)
  }
  s = s.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(parseInt(code, 10)),
  )
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCodePoint(parseInt(code, 16)),
  )
  return s
}

// IPA Extensions (U+0250–U+02AF), Spacing Modifier Letters (U+02B0–U+02FF),
// and the IPA tie bar U+0361. These code-points appear in phonetic
// transcriptions (ɐ, ʲ, ˈ, ː, ͡) but not in ordinary running prose, so a
// bracket that contains any of them is an IPA segment rather than e.g. an
// Old-Style date like "[O.S. 10 April]".
const IPA_SIGNAL = /[ɐ-˿͡]/u

export function cleanWikiExtract(text: string): string {
  if (!text) return text
  let s = decodeHtmlEntities(text)

  s = s.replace(/\s*\[[^\]]*\]/g, (m) => (IPA_SIGNAL.test(m) ? '' : m))

  // Drop "<Lang> pronunciation:" / "pronounced" residue left over after the
  // bracketed IPA disappeared. Anchored on a following punctuation mark so
  // we don't accidentally eat the word "pronounced" when it's part of normal
  // prose ("the book was pronounced obscene").
  s = s.replace(
    /,?\s*(?:[A-Z][a-zA-Z]+\s+)?pronunciation:?\s*(?=[;,.)])/g,
    '',
  )
  s = s.replace(/,?\s*\bpronounced\b\s*(?=[;,.)])/g, '')

  // A bare language label like "(Spanish: ; …)" or "…, French:; …" left
  // behind once the IPA it introduced is gone — drop the label, keep what
  // follows. The label-with-content form ("Russian: Влади…") is preserved
  // because the colon is then followed by real text, not by punctuation.
  s = s.replace(/\(\s*[A-Z][a-zA-Z]+:\s*[;,]\s*/g, '(')
  s = s.replace(/,\s*[A-Z][a-zA-Z]+:\s*(?=[;,)])/g, '')

  // Fix the whitespace/punctuation glitches the strips leave behind:
  //   "Набоков ; 22"  → "Набоков; 22"
  //   "(  Russian"    → "(Russian"
  //   "(;"            → "("
  //   double spaces   → single
  s = s.replace(/\s+([;,.)])/g, '$1')
  s = s.replace(/\(\s+/g, '(')
  s = s.replace(/\(\s*[;,]\s*/g, '(')
  s = s.replace(/[ \t]{2,}/g, ' ')

  return s.trim()
}
