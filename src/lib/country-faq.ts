// Builds the FAQ items shown on /countries/{code}. Two tiers:
//
// 1. **Data-only** (every country with bans): how many, when, what reasons,
//    what notable titles. Same shape as the answers the route used to
//    inline before this file existed — still SEO-useful long-tail content.
// 2. **Editorial** (only countries in COUNTRY_FAQ_FACTS, i.e. the top
//    five by ban count): who decides, can I read, can I buy. These need
//    jurisdiction-specific facts that data alone can't produce.

import type { FaqItem } from '@/components/faq-accordion'
import { COUNTRY_FAQ_FACTS } from './country-faq-facts'

const BOOKSHOP_AFFILIATE_URL = 'https://bookshop.org/shop/banned-books-org'

// Countries whose English name takes the definite article in prose ("the
// United States", "the United Kingdom"). Without this every question would
// read "in United States" which is grammatically jarring.
const DEFINITE_ARTICLE_COUNTRIES = new Set([
  'United States', 'United Kingdom', 'Netherlands', 'Philippines',
  'Bahamas', 'Gambia', 'Czech Republic', 'Dominican Republic',
  'United Arab Emirates', 'Democratic Republic of the Congo',
  'Republic of the Congo', 'Central African Republic', 'Ivory Coast',
])
function articulate(name: string): string {
  return DEFINITE_ARTICLE_COUNTRIES.has(name) ? `the ${name}` : name
}

export type CountryFaqInputs = {
  countryCode: string
  countryName: string
  totalBanCount: number
  earliestBanYear: number | null
  latestBanYear: number | null
  topReasonNames: string[]
  topBookTitles: string[]
}

/**
 * Returns the country name with the leading "the" prepended when proza
 * requires it. Exported so the country-page header can match the same
 * phrasing as the FAQ answers ("Frequently asked questions about the
 * United States" instead of "… about United States").
 */
export function articulateCountryName(name: string): string {
  return articulate(name)
}

export function buildCountryFaq({
  countryCode,
  countryName,
  totalBanCount,
  earliestBanYear,
  latestBanYear,
  topReasonNames,
  topBookTitles,
}: CountryFaqInputs): FaqItem[] {
  if (totalBanCount === 0) return []

  const items: FaqItem[] = []
  const facts = COUNTRY_FAQ_FACTS[countryCode.toUpperCase()]

  // 1. How many bans
  const topReasonClause = topReasonNames[0]
    ? ` ${capitalise(topReasonNames[0])} is the most frequently cited reason.`
    : ''
  items.push({
    q: `How many books are banned in ${articulate(countryName)}?`,
    a: `${totalBanCount} ${totalBanCount === 1 ? 'book is' : 'books are'} documented as banned or challenged in ${articulate(countryName)}.${topReasonClause}`,
  })

  // 2. (Editorial, top-5 only) Who decides
  if (facts) {
    items.push({
      q: `Who decides which books are banned in ${articulate(countryName)}?`,
      a: `Book bans in ${articulate(countryName)} come from ${facts.banAuthority}.${facts.notableContext ? ' ' + facts.notableContext : ''}`,
    })
  }

  // 3. When did banning begin
  if (earliestBanYear) {
    items.push({
      q: `When did book banning begin in ${articulate(countryName)}?`,
      a: `The earliest documented ban in ${articulate(countryName)} dates to ${earliestBanYear}.${
        latestBanYear && latestBanYear > earliestBanYear
          ? ` The most recent recorded ban dates to ${latestBanYear}.`
          : ''
      }`,
    })
  }

  // 4. Top reasons
  if (topReasonNames.length >= 2) {
    items.push({
      q: `What are the most common reasons for book bans in ${articulate(countryName)}?`,
      a: `The most frequently cited reasons in ${articulate(countryName)} are ${topReasonNames.slice(0, 3).join(', ')}. See [the reasons taxonomy](/reasons) for full definitions.`,
    })
  }

  // 5. (Editorial) Can I read
  if (facts) {
    const leadIn =
      facts.readingLegal === 'legal'
        ? `Reading banned books is legal in ${articulate(countryName)}.`
        : facts.readingLegal === 'restricted'
          ? `Reading banned books carries legal risk in ${articulate(countryName)}.`
          : `Possessing certain banned books is a criminal offence in ${articulate(countryName)}.`
    items.push({
      q: `Can I read a banned book in ${articulate(countryName)}?`,
      a: `${leadIn} ${facts.readingNote}`,
    })
  }

  // 6. (Editorial) Can I buy
  if (facts) {
    const leadIn =
      facts.purchaseLegal === 'legal'
        ? `Yes — titles banned in ${articulate(countryName)} are typically still in print and available through booksellers in other jurisdictions or via international shipping.`
        : facts.purchaseLegal === 'restricted'
          ? `Distribution is restricted in ${articulate(countryName)}, but international shipping and e-books make most titles obtainable in practice.`
          : `Domestic purchase of banned titles is criminalised in ${articulate(countryName)}.`
    items.push({
      q: `Can I buy a banned book in ${articulate(countryName)}?`,
      a: `${leadIn} ${facts.purchaseNote} We link to [Bookshop.org](${BOOKSHOP_AFFILIATE_URL}) for purchases that support independent bookstores — and never to Amazon ([why](/why-not-amazon)).`,
    })
  }

  // 7. Notable books
  if (topBookTitles.length >= 3) {
    items.push({
      q: `What are notable banned books in ${articulate(countryName)}?`,
      a: `Examples of banned books in ${articulate(countryName)} include ${topBookTitles.slice(0, 5).join(', ')}. Browse the full list below.`,
    })
  }

  return items
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
