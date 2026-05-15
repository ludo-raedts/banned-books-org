// Shared helper: for a book with up to 4 title variants
// (title, title_english_meaningful, title_transliterated, title_native),
// produce an ordered list of titles to try against external APIs
// (OpenLibrary, Google Books, Wikipedia, etc.).
//
// Anglo-centric API hit-rate logic:
//   - For non-English books the English-meaning variant has the HIGHEST hit
//     rate on OpenLibrary/Google Books — those catalogues are dominated by
//     English-language records. So we try `title_english_meaningful` FIRST
//     when original_language is set and not 'en'.
//   - For English books the canonical `title` is already optimal; alt-titles
//     are either null or identical (legacy migration set title_native = title
//     for en/fr books), so they're effectively no-ops.
//   - Transliteration is a Latin-script romanisation — moderate hit rate.
//   - Native script is the least useful for these APIs (worth trying as a
//     last resort for completeness, e.g. Wikipedia search).
//
// Returned items expose the source so callers can record which variant scored.

export type TitleVariantSource =
  | 'canonical'
  | 'english_meaningful'
  | 'transliterated'
  | 'native'

export type TitleVariant = {
  title: string
  source: TitleVariantSource
}

export type BookTitleFields = {
  title: string
  title_english_meaningful: string | null
  title_transliterated: string | null
  title_native: string | null
  original_language: string | null
}

export function titleLadder(book: BookTitleFields): TitleVariant[] {
  const out: TitleVariant[] = []
  const seen = new Set<string>()
  const push = (raw: string | null, source: TitleVariantSource) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ title: trimmed, source })
  }

  const isNonEnglish =
    book.original_language && book.original_language !== 'en'

  if (isNonEnglish) {
    // English meaning first — best Anglo-API hit rate
    push(book.title_english_meaningful, 'english_meaningful')
  }
  push(book.title, 'canonical')
  if (!isNonEnglish) {
    // English book — still try alt-titles in case the canonical missed
    push(book.title_english_meaningful, 'english_meaningful')
  }
  push(book.title_transliterated, 'transliterated')
  push(book.title_native, 'native')

  return out
}
