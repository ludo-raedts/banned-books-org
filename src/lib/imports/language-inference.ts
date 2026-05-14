// Deterministic script + language inference for the import-review form
// pre-fill. Pure functions, no DB access, no LLM calls.
//
// Two layers:
//   1. detectScript(text)  — counts Unicode-block characters and returns the
//      dominant script tag (latin, cyrillic, han, devanagari, tamil, …).
//   2. inferLanguage(...)  — maps (script, country_code, state) to an
//      ISO-639-1 two-letter code. Most non-Latin scripts have a 1-to-1
//      language mapping; the ambiguous ones (cyrillic, arabic, devanagari,
//      han) use the source country as a tiebreaker.
//
// Design notes:
//   - Script names match what already lives in books.title_native_script
//     (free-text per migration 20260512074200) and the documented values in
//     that migration's comment. We use the un-suffixed `han` for written
//     Chinese; the LLM-side ScriptType enum has han_traditional/_simplified
//     but those distinctions aren't reliable from Unicode blocks alone.
//   - Latin-script titles deliberately get NO language suggestion: too
//     ambiguous without document-level context. Editor fills in by hand.
//   - When the result is uncertain (mixed scripts, no clear majority), we
//     return null rather than guessing wrong. The review form falls back to
//     an empty input — same as today.

export type DetectedScript =
  | 'latin'
  | 'cyrillic'
  | 'han'
  | 'hiragana'
  | 'katakana'
  | 'hangul'
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'bengali'
  | 'gurmukhi'
  | 'gujarati'
  | 'oriya'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'sinhala'
  | 'thai'
  | 'lao'
  | 'khmer'
  | 'myanmar'
  | 'tibetan'
  | 'georgian'
  | 'armenian'
  | 'greek'
  | 'ethiopic'
  | 'mixed'

// Each entry tests one code-point at a time. Order matters only when ranges
// overlap (they don't here). Spaces, punctuation, ASCII digits are ignored
// upstream so they never reach this check.
const SCRIPT_RANGES: Array<{ script: DetectedScript; test: (cp: number) => boolean }> = [
  { script: 'hiragana',   test: cp => cp >= 0x3040 && cp <= 0x309F },
  { script: 'katakana',   test: cp => (cp >= 0x30A0 && cp <= 0x30FF) || (cp >= 0x31F0 && cp <= 0x31FF) },
  { script: 'hangul',     test: cp => (cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0x3130 && cp <= 0x318F) },
  { script: 'han',        test: cp => (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2A6DF) },
  { script: 'cyrillic',   test: cp => (cp >= 0x0400 && cp <= 0x04FF) || (cp >= 0x0500 && cp <= 0x052F) },
  { script: 'arabic',     test: cp => (cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0750 && cp <= 0x077F) || (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF) },
  { script: 'hebrew',     test: cp => cp >= 0x0590 && cp <= 0x05FF },
  { script: 'devanagari', test: cp => cp >= 0x0900 && cp <= 0x097F },
  { script: 'bengali',    test: cp => cp >= 0x0980 && cp <= 0x09FF },
  { script: 'gurmukhi',   test: cp => cp >= 0x0A00 && cp <= 0x0A7F },
  { script: 'gujarati',   test: cp => cp >= 0x0A80 && cp <= 0x0AFF },
  { script: 'oriya',      test: cp => cp >= 0x0B00 && cp <= 0x0B7F },
  { script: 'tamil',      test: cp => cp >= 0x0B80 && cp <= 0x0BFF },
  { script: 'telugu',     test: cp => cp >= 0x0C00 && cp <= 0x0C7F },
  { script: 'kannada',    test: cp => cp >= 0x0C80 && cp <= 0x0CFF },
  { script: 'malayalam',  test: cp => cp >= 0x0D00 && cp <= 0x0D7F },
  { script: 'sinhala',    test: cp => cp >= 0x0D80 && cp <= 0x0DFF },
  { script: 'thai',       test: cp => cp >= 0x0E00 && cp <= 0x0E7F },
  { script: 'lao',        test: cp => cp >= 0x0E80 && cp <= 0x0EFF },
  { script: 'tibetan',    test: cp => cp >= 0x0F00 && cp <= 0x0FFF },
  { script: 'myanmar',    test: cp => cp >= 0x1000 && cp <= 0x109F },
  { script: 'georgian',   test: cp => (cp >= 0x10A0 && cp <= 0x10FF) || (cp >= 0x2D00 && cp <= 0x2D2F) },
  { script: 'ethiopic',   test: cp => cp >= 0x1200 && cp <= 0x137F },
  { script: 'khmer',      test: cp => cp >= 0x1780 && cp <= 0x17FF },
  { script: 'armenian',   test: cp => cp >= 0x0530 && cp <= 0x058F },
  { script: 'greek',      test: cp => (cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF) },
  // Latin includes basic, supplement, extended-A/B, IPA, and Latin-with-
  // diacritics ranges. Comes last so non-Latin scripts win in priority.
  { script: 'latin',      test: cp => (cp >= 0x0041 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F) || (cp >= 0x1E00 && cp <= 0x1EFF) },
]

// Code-points that should be ignored entirely (don't count toward any script).
// Spaces, ASCII digits, common punctuation. Anything we can't classify (rare
// symbols, emoji) is just dropped from the ratio calculation.
function isIgnorable(cp: number): boolean {
  if (cp <= 0x002F) return true                    // controls + punctuation < '0'
  if (cp >= 0x0030 && cp <= 0x0039) return true    // ASCII digits
  if (cp >= 0x003A && cp <= 0x0040) return true    // : ; < = > ? @
  if (cp >= 0x005B && cp <= 0x0060) return true    // [ \ ] ^ _ `
  if (cp >= 0x007B && cp <= 0x007E) return true    // { | } ~
  if (cp === 0x00A0) return true                   // non-breaking space
  if (cp >= 0x2000 && cp <= 0x206F) return true    // general punctuation block
  if (cp >= 0x3000 && cp <= 0x303F) return true    // CJK symbols and punctuation
  if (cp >= 0xFF00 && cp <= 0xFF0F) return true    // fullwidth punctuation
  return false
}

/**
 * Detect the dominant script in a string. Returns:
 *   - a single script tag if ≥70% of classified characters belong to that script
 *   - 'mixed' if multiple non-Latin scripts coexist without a clear majority
 *   - null if no classifiable characters at all (or input empty)
 *
 * Latin counts as a script but only "wins" if there are no non-Latin
 * characters at all — a transliterated title with one stray native-script
 * character is dominated by the native script. This matches the way the
 * parser already separates `title` from `title_native`.
 */
export function detectScript(text: string | null | undefined): DetectedScript | null {
  if (!text) return null
  const counts = new Map<DetectedScript, number>()
  let totalNonLatin = 0
  let latinCount = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (isIgnorable(cp)) continue
    const match = SCRIPT_RANGES.find(r => r.test(cp))
    if (!match) continue
    counts.set(match.script, (counts.get(match.script) ?? 0) + 1)
    if (match.script === 'latin') latinCount++
    else totalNonLatin++
  }

  if (counts.size === 0) return null

  // Any non-Latin presence dominates Latin. Pick the largest non-Latin script.
  if (totalNonLatin > 0) {
    const nonLatinEntries = Array.from(counts.entries())
      .filter(([s]) => s !== 'latin')
      .sort((a, b) => b[1] - a[1])
    const [top, topCount] = nonLatinEntries[0]
    // Japanese mixed-script handling: a string with both kana and han is
    // Japanese, return 'han' would mis-classify it. If we see hiragana or
    // katakana at all alongside han, the kana wins (they're the giveaway
    // for Japanese — Chinese doesn't use them).
    const hiragana = counts.get('hiragana') ?? 0
    const katakana = counts.get('katakana') ?? 0
    if ((hiragana > 0 || katakana > 0) && counts.get('han')) {
      return hiragana >= katakana ? 'hiragana' : 'katakana'
    }
    // If the top non-Latin script holds ≥70% of non-Latin chars, return it.
    // Otherwise the title genuinely mixes scripts — return 'mixed'.
    if (topCount / totalNonLatin >= 0.7) return top
    return 'mixed'
  }

  // Pure-Latin (with or without diacritics).
  if (latinCount > 0) return 'latin'
  return null
}

// ----------------------------------------------------------------------------
// Script → ISO-639-1 language code, with country-code tiebreakers.
// ----------------------------------------------------------------------------

// Scripts that map 1:1 to a single language. No country-context needed.
const UNAMBIGUOUS_SCRIPT_LANG: Partial<Record<DetectedScript, string>> = {
  tamil:     'ta',
  gujarati:  'gu',
  gurmukhi:  'pa',
  telugu:    'te',
  kannada:   'kn',
  malayalam: 'ml',
  oriya:     'or',
  sinhala:   'si',
  thai:      'th',
  lao:       'lo',
  khmer:     'km',
  myanmar:   'my',
  tibetan:   'bo',
  georgian:  'ka',
  armenian:  'hy',
  greek:     'el',
  hebrew:    'he',
  ethiopic:  'am',
  hiragana:  'ja',
  katakana:  'ja',
  hangul:    'ko',
}

// Cyrillic: pick by country. Default to Russian when country is unknown
// (matches the population-weighted prior — Russian is the most-banned-in
// language by a wide margin for Cyrillic source corpora).
const CYRILLIC_BY_COUNTRY: Record<string, string> = {
  RU: 'ru', UA: 'uk', BY: 'be', BG: 'bg', RS: 'sr', ME: 'sr',
  MK: 'mk', KZ: 'kk', KG: 'ky', MN: 'mn', TJ: 'tg', MD: 'ro',
}

// Arabic script across the Islamic world. Default to Arabic; specific
// countries override to local Iranian/South-Asian languages.
const ARABIC_BY_COUNTRY: Record<string, string> = {
  IR: 'fa', AF: 'fa', TJ: 'fa',
  PK: 'ur', IN: 'ur',
  // Default 'ar' for AE, SA, EG, MA, DZ, TN, LB, SY, IQ, JO, etc.
}

// Han script: Chinese unless the source is Japanese (caught by hiragana
// presence upstream, never reaches here as 'han'). Country mostly redundant
// — kept for completeness.
const HAN_BY_COUNTRY: Record<string, string> = {
  CN: 'zh', HK: 'zh', TW: 'zh', SG: 'zh', MO: 'zh', MY: 'zh',
}

// Devanagari serves Hindi, Marathi, Sanskrit, Nepali, Konkani. India sources
// default to Hindi; Nepal to Nepali. State-level disambiguation (Maharashtra
// → Marathi) lives in inferLanguage() below.
const DEVANAGARI_BY_COUNTRY: Record<string, string> = {
  IN: 'hi', NP: 'ne',
}

// Bengali script: Bengali (Bangladesh/West Bengal) or Assamese (Assam).
const BENGALI_BY_COUNTRY: Record<string, string> = {
  BD: 'bn', IN: 'bn',
}

// Indian state -> language override for Devanagari + Bengali ambiguity.
// Only fires when (script, country) is one of (devanagari, IN) or
// (bengali, IN). Keys are case-insensitive substrings of state cell.
const INDIAN_STATE_DEVANAGARI_OVERRIDES: Array<{ match: RegExp; lang: string }> = [
  { match: /maharashtra/i, lang: 'mr' },
  { match: /\bmarathi\b/i, lang: 'mr' },
]
const INDIAN_STATE_BENGALI_OVERRIDES: Array<{ match: RegExp; lang: string }> = [
  { match: /assam/i,       lang: 'as' },
  { match: /\bassamese\b/i, lang: 'as' },
]

/**
 * Map a detected script + source country (+ optional Indian state) to an
 * ISO-639-1 two-letter code. Returns null when:
 *   - script is 'latin' (too ambiguous without document context)
 *   - script is 'mixed' or null
 *   - the script-country combination has no default (e.g. tibetan + non-CN/IN)
 *
 * The caller (review form) should treat null as "leave the field empty for
 * the editor to fill", same as today.
 */
export function inferLanguage(
  script: DetectedScript | null,
  countryCode: string | null | undefined,
  state: string | null | undefined,
): string | null {
  if (!script || script === 'mixed' || script === 'latin') return null

  const unambig = UNAMBIGUOUS_SCRIPT_LANG[script]
  if (unambig) return unambig

  const cc = countryCode?.toUpperCase() ?? null

  if (script === 'cyrillic') {
    if (cc && CYRILLIC_BY_COUNTRY[cc]) return CYRILLIC_BY_COUNTRY[cc]
    return 'ru'
  }

  if (script === 'arabic') {
    if (cc && ARABIC_BY_COUNTRY[cc]) return ARABIC_BY_COUNTRY[cc]
    return 'ar'
  }

  if (script === 'han') {
    if (cc && HAN_BY_COUNTRY[cc]) return HAN_BY_COUNTRY[cc]
    return 'zh'
  }

  if (script === 'devanagari') {
    if (cc === 'IN' && state) {
      const hit = INDIAN_STATE_DEVANAGARI_OVERRIDES.find(o => o.match.test(state))
      if (hit) return hit.lang
    }
    if (cc && DEVANAGARI_BY_COUNTRY[cc]) return DEVANAGARI_BY_COUNTRY[cc]
    return 'hi'
  }

  if (script === 'bengali') {
    if (cc === 'IN' && state) {
      const hit = INDIAN_STATE_BENGALI_OVERRIDES.find(o => o.match.test(state))
      if (hit) return hit.lang
    }
    if (cc && BENGALI_BY_COUNTRY[cc]) return BENGALI_BY_COUNTRY[cc]
    return 'bn'
  }

  return null
}

/**
 * Convenience wrapper used by the review form: given a `title_native` blob
 * plus source context, return both the script tag and the inferred language
 * code. Either may be null. Returns `{ script: null, language: null }` when
 * the input has no classifiable characters.
 */
export function inferScriptAndLanguage(
  titleNative: string | null | undefined,
  countryCode: string | null | undefined,
  state: string | null | undefined,
): { script: DetectedScript | null; language: string | null } {
  const script = detectScript(titleNative)
  const language = inferLanguage(script, countryCode, state)
  return { script, language }
}
