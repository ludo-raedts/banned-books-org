// "Same title?" comparison for title vs title_native. Deliberately looser than
// string equality: a native title that differs only in typography (curly vs
// straight apostrophe, œ/æ ligatures, diacritics, spacing) adds no search
// token and would render as a silly echo — real case: "L’Espagne au coeur"
// with title_native "L'Espagne au cœur". Cross-script pairs are untouched:
// normalization never makes 活着 equal to "To Live".
export function equivalentTitles(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’‘ʼ]/g, "'")
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/\s+/g, ' ')
      .trim()
  return norm(a) === norm(b)
}

// Card-level guard for showing a book's native-script title next to the
// canonical English one (e.g. "活着" under "To Live"). Mirrors the book-page
// hero rule but without the title_english_meaningful ladder: cards only ever
// add the native line, never swap the canonical title out.
//
// Returns null for 'en' originals: their title_native values are alternate
// English titles (legacy backfill), not a findability signal worth a line.
export function displayNativeTitle(
  title: string,
  titleNative: string | null | undefined,
  originalLanguage: string | null | undefined,
): string | null {
  if (!titleNative || !originalLanguage || originalLanguage === 'en') return null
  const native = titleNative.trim()
  if (!native || equivalentTitles(native, title)) return null
  return native
}
