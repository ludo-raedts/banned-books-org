// Kobo affiliate identifiers, issued by Rakuten Advertising.
//
//   - KOBO_RAKUTEN_PUB_ID is our publisher token (`id=` in the affiliate URL).
//   - KOBO_RAKUTEN_MID is Kobo's merchant ID inside the Rakuten network.
//
// Both are public — they appear in every affiliate link we ship — but they
// determine who gets credited for the click, so don't change them without
// updating the Rakuten dashboard.
export const KOBO_RAKUTEN_PUB_ID = 'LLzyPU2rm40'
export const KOBO_RAKUTEN_MID = '37589'

// Kobo runs separate storefronts per region and Rakuten attributes commissions
// per merchant domain. Forcing one storefront keeps every click on the same
// affiliate-recognised property. UK/EN matches the example link Kobo issued
// when our affiliate application was approved.
const KOBO_BASE = 'https://www.kobo.com/gb/en'

// Rakuten's deeplink endpoint wraps any merchant URL in the affiliate cookie
// drop. Format:
//   https://click.linksynergy.com/deeplink?id={pubId}&mid={mid}&murl={encoded}
//   &u1={subId}
// Works for any Kobo URL (product pages, search results, category browsing),
// so we don't need per-book offer IDs from the product catalogue feed to ship
// a credited click. If we later ingest the catalogue feed, deep-linking to
// the exact product page is a drop-in replacement for the search fallback.
//
// u1 is Rakuten's publisher sub-ID: an opaque label echoed back in the click
// reports, so we tag each link with its source slug to see which book/author
// pages actually convert.
function wrapAffiliate(koboUrl: string, subId?: string): string {
  const params = new URLSearchParams({
    id: KOBO_RAKUTEN_PUB_ID,
    mid: KOBO_RAKUTEN_MID,
    murl: koboUrl,
  })
  if (subId) params.set('u1', subId)
  return `https://click.linksynergy.com/deeplink?${params.toString()}`
}

// Search-URL fallback. Kobo's search supports plain `query=` and matches on
// title + author tokens, which is the best we can do without the catalogue
// feed mapping ISBN13 → product slug. `subId` flows into u1 for per-page
// conversion attribution in the Rakuten dashboard.
export function getKoboUrl(query: string, subId?: string): string {
  const search = `${KOBO_BASE}/search?query=${encodeURIComponent(query)}`
  return wrapAffiliate(search, subId)
}

// rel value for outbound Kobo affiliate links — matches BOOKSHOP_REL: the
// "sponsored" hint Google asks for on affiliate links, plus the standard
// security flags for target="_blank".
export const KOBO_REL = 'sponsored noopener noreferrer'
