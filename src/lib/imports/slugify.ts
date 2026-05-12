// Generate a URL slug from a human-readable string.
//
// Why this lives here: prior to Sprint A, three import scripts each carried
// their own copy of a `toSlug()` that had no Unicode-normalisation step. An
// accented character such as `á` is not in `[a-z0-9]`, so it collapsed into
// the hyphen-fill: `Julián Is a Mermaid` produced `juli-n-is-a-mermaid`.
// Step 0 of the multilingual import plan caught this. See
// docs/sprint-a/step-0-findings.md §1.
//
// Strategy:
//   1. Pre-expand ligatures and digraphs that NFD does NOT decompose
//      (œ → oe, ß → ss, …). These are single codepoints, not base+combining,
//      so the NFD pass below would otherwise leave them and they would be
//      stripped by the `[^a-z0-9]+` filter.
//   2. NFD-normalise to split accented codepoints into base letter + combining
//      mark, then strip the combining-mark range (U+0300..U+036F).
//   3. Lowercase and apply the historical hyphen-fill rule.
//
// Limitation: for non-Latin scripts (Cyrillic, Han, Arabic, …) NFD produces
// no Latin base letters, so the result is the empty string. The Sprint A
// import pipeline therefore slugs from `title_transliterated` (Latin
// romanisation) rather than `title_native` for those entries.

const LIGATURE_MAP: Array<[RegExp, string]> = [
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/æ/g, 'ae'],
  [/Æ/g, 'AE'],
  [/ß/g, 'ss'],
  [/ø/g, 'o'],
  [/Ø/g, 'O'],
  [/đ/g, 'd'],
  [/Đ/g, 'D'],
  [/ł/g, 'l'],
  [/Ł/g, 'L'],
]

export function slugify(s: string): string {
  let out = s
  for (const [pattern, replacement] of LIGATURE_MAP) {
    out = out.replace(pattern, replacement)
  }
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’‚‛'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
