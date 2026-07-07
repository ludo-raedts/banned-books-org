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
  if (!native || native.toLowerCase() === title.trim().toLowerCase()) return null
  return native
}
