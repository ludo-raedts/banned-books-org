// Affiliate ID for banned-books.org on Bookshop.org.
export const BOOKSHOP_AFFILIATE_ID = '123844'

// The shop name registered with Bookshop.org. Storefront URL is
// https://bookshop.org/shop/{BOOKSHOP_SHOP_NAME} — used as fallback when we
// don't have a Bookshop-resolvable ISBN. Renaming the shop on bookshop.org
// would break every existing affiliate link, so this is effectively permanent.
export const BOOKSHOP_SHOP_NAME = 'Banned-books'

const BASE = 'https://bookshop.org'
const STOREFRONT_URL = `${BASE}/shop/${BOOKSHOP_SHOP_NAME}`

// Whether the book's isbn13 has been verified to resolve on Bookshop's
// affiliate path. Populated by scripts/probe-bookshop-isbn.ts. NULL means
// "not probed yet" — treated as if it might 404, so we fall back to the
// storefront URL until the probe confirms otherwise.
export type BookshopStatus = 'valid' | 'not_found' | null | undefined

type BookshopInput = {
  isbn13?: string | null
  // Alternative isbn13 found via Open Library cross-reference when the
  // canonical isbn13 didn't resolve on Bookshop. Prefer this when set.
  bookshopIsbn13?: string | null
  bookshopStatus?: BookshopStatus
}

// Returns an affiliate-tagged Bookshop.org URL. Two documented affiliate
// formats exist:
//   - /a/{aid}/{ISBN13}     — deep link to a specific book (preferred)
//   - /shop/{name}          — storefront URL (fallback)
// Both set the 48-hour affiliate cookie, so any purchase made within that
// window is credited even if the visitor navigates elsewhere on bookshop.org.
//
// Deep-link is only used when the probe has confirmed an isbn13 resolves
// on Bookshop. Otherwise we drop the visitor on our storefront — never on
// a 404 page.
//
// Search URLs (`/search?aid=...`) are NOT a documented affiliate format and
// don't appear to credit sales — Bookshop confirmed this directly. Don't
// reintroduce them.
export function getBookshopUrl(book: BookshopInput): string {
  const linkIsbn = book.bookshopIsbn13 ?? book.isbn13
  if (linkIsbn && book.bookshopStatus === 'valid') {
    return `${BASE}/a/${BOOKSHOP_AFFILIATE_ID}/${linkIsbn}`
  }
  return STOREFRONT_URL
}

// Author pages have no per-author affiliate format. Send visitors to the
// storefront so the cookie is still set.
export function getBookshopAuthorUrl(): string {
  return STOREFRONT_URL
}

// rel value for outbound affiliate links — combines Google's "sponsored"
// hint with "nofollow" (so crawlers don't follow the affiliate link and
// inflate click counts / risk invalid-traffic flags) and the standard
// security flags for target="_blank".
export const BOOKSHOP_REL = 'sponsored nofollow noopener noreferrer'

// Classify a Bookshop URL so analytics can split deep-link clicks (per-book
// affiliate path) from storefront fallback clicks. Storefront URLs all live
// under /shop/{name}; everything else is the per-book /a/{aid}/{isbn} format.
export type BookshopLinkType = 'deep' | 'storefront'
export function getBookshopLinkType(url: string): BookshopLinkType {
  return url.includes('/shop/') ? 'storefront' : 'deep'
}
