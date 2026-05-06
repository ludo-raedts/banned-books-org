// Affiliate ID for banned-books.org on Bookshop.org.
export const BOOKSHOP_AFFILIATE_ID = '123844'

// Bookshop.org's documented deep-link form is /a/{affiliateId}/{ISBN}, but
// it 404s whenever the ISBN isn't in Bookshop's US catalogue (most of our DB
// stores foreign-edition ISBNs). We always use search-by-keywords instead —
// it resolves to whichever editions Bookshop carries, never 404s, and lets
// the reader pick paperback / hardcover / ebook themselves.
//
// The affiliate-tracking parameter for /search isn't publicly documented;
// keep it as a named constant so it's a one-line swap if Bookshop ever
// publishes one. Affiliate credit is currently best-effort here.
export const BOOKSHOP_AFFILIATE_QUERY_PARAM = 'aid'

const BASE = 'https://bookshop.org'

type BookshopInput = {
  title: string
  author?: string | null
}

// Returns an affiliate-tagged Bookshop.org search URL keyed on title +
// author. Always resolves — Bookshop's search redirects to the catalogue
// page even when no exact match exists.
export function getBookshopUrl(book: BookshopInput): string {
  const keywords = [book.title, book.author].filter(Boolean).join(' ')
  const params = new URLSearchParams({
    keywords,
    [BOOKSHOP_AFFILIATE_QUERY_PARAM]: BOOKSHOP_AFFILIATE_ID,
  })
  return `${BASE}/search?${params.toString()}`
}

// Affiliate-tagged search by author across Bookshop.org's catalogue.
export function getBookshopAuthorUrl(authorName: string): string {
  const params = new URLSearchParams({
    keywords: authorName,
    [BOOKSHOP_AFFILIATE_QUERY_PARAM]: BOOKSHOP_AFFILIATE_ID,
  })
  return `${BASE}/search?${params.toString()}`
}

// rel value for outbound affiliate links — combines Google's "sponsored"
// hint with the standard security flags for target="_blank".
export const BOOKSHOP_REL = 'sponsored noopener noreferrer'
