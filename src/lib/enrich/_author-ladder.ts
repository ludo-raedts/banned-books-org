// Shared helper: for an author with up to 4 name variants
// (display_name + name_native + name_transliterated + name_english),
// produce an ordered list of names to try against external APIs
// (Wikidata, Wikimedia Commons SPARQL, openverse, etc.) for bio + photo
// enrichment.
//
// Mirrors src/lib/enrich/_title-ladder.ts. Same Anglo-centric API logic:
//   - For non-English authors `name_english` (a known anglicised pen name)
//     beats everything when present, since Wikidata indexes English labels.
//     `display_name` is the slug-canonical form and usually already a
//     transliteration / anglicisation, so it's the strong fallback.
//   - `name_transliterated` (BGN/PCGN / Pinyin) is the next best fallback
//     for cases where display_name diverged from the standard romanisation.
//   - `name_native` is last — useful for Wikidata's native-label lookup
//     when no Latin variant matched.
//   - English authors: just `display_name`; alt-fields are NULL by design.

export type AuthorVariantSource =
  | 'canonical'           // authors.display_name
  | 'english'             // authors.name_english (known pen name)
  | 'transliterated'      // authors.name_transliterated
  | 'native'              // authors.name_native

export type AuthorVariant = {
  name: string
  source: AuthorVariantSource
}

export type AuthorFields = {
  display_name: string
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
  original_language: string | null
}

export function authorLadder(author: AuthorFields): AuthorVariant[] {
  const out: AuthorVariant[] = []
  const seen = new Set<string>()
  const push = (raw: string | null, source: AuthorVariantSource) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ name: trimmed, source })
  }

  const isNonEnglish =
    author.original_language && author.original_language !== 'en'

  if (isNonEnglish) {
    // English pen name first — best Anglo-API hit rate
    push(author.name_english, 'english')
  }
  push(author.display_name, 'canonical')
  if (!isNonEnglish) {
    // English author — still try alt-fields in case display_name diverged
    push(author.name_english, 'english')
  }
  push(author.name_transliterated, 'transliterated')
  push(author.name_native, 'native')

  return out
}
