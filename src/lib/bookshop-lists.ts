/**
 * Mapping from internal taxonomy slugs to Bookshop.org affiliate list
 * slugs (live at https://bookshop.org/shop/Banned-books).
 *
 * Bookshop list URLs use the form: bookshop.org/lists/{listSlug}
 * The widget iframe uses the same slug: bookshop.org/widgets/list/{listSlug}
 *
 * Some internal reason slugs share a single bookshop list (religious +
 * blasphemy, sexual + obscenity + moral) — that's deliberate, the lists
 * were curated to cover the merged concept on bookshop's side.
 *
 * When a slug isn't covered (language, drugs, other; public_library,
 * prison, government, retail, customs) the helpers return null and the
 * embed is skipped silently.
 */

export const BOOKSHOP_AFFILIATE_ID = '123844'

const REASON_TO_LIST: Readonly<Record<string, string>> = {
  lgbtq: 'banned-lgbtq-books-banned-books',
  political: 'banned-political-books',
  religious: 'banned-for-religion-or-blasphemy',
  blasphemy: 'banned-for-religion-or-blasphemy',
  racial: 'books-banned-for-race-and-racism',
  sexual: 'books-banned-for-sexual-content',
  obscenity: 'books-banned-for-sexual-content',
  moral: 'books-banned-for-sexual-content',
  violence: 'banned-for-violent-content',
}

const SCOPE_TO_LIST: Readonly<Record<string, string>> = {
  school: 'banned-in-u-s-schools',
  church: 'banned-by-the-church',
}

/** Standalone bookshop lists not tied to a single taxonomy slug. */
export const BOOKSHOP_LISTS = {
  mostBanned: 'the-most-banned-books-in-the-world',
  classics: 'banned-classics-banned-books',
  twenty20s: 'most-banned-in-the-2020s',
  penAmerica2024_25: 'pen-america-index-2024-25',
} as const

export function getBookshopListForReason(slug: string): string | null {
  return REASON_TO_LIST[slug] ?? null
}

export function getBookshopListForScope(slug: string): string | null {
  return SCOPE_TO_LIST[slug] ?? null
}

/** Public URL on bookshop.org for a given list slug. */
export function bookshopListUrl(listSlug: string): string {
  return `https://bookshop.org/lists/${listSlug}`
}
