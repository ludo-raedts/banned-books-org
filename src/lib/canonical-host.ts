// One source of truth for the public site URL.
//
// Production canonical host is `www.banned-books.org`. JSON-LD, canonical
// metadata, OG tags, citation_* meta, hardcoded essay URLs, and most ad-hoc
// strings throughout the app already use the www-prefixed form. The sitemap
// and robots.ts however key off `NEXT_PUBLIC_BASE_URL`, and a stale env value
// of `https://banned-books.org` (no www) was emitting non-www URLs into the
// sitemap — causing Google to see two hostnames for the same content.
//
// This helper normalises whatever env value is configured by coercing the
// bare apex `banned-books.org` to the www form. Other hostnames (vercel.app
// previews, localhost, custom domains) pass through unchanged so staging and
// preview deploys keep working.

function normaliseHost(url: string): string {
  // Match optional scheme + optional www, capture the rest after the host.
  // Then always re-emit with `https://www.banned-books.org` as the host.
  return url.replace(
    /^(?:https?:\/\/)?(?:www\.)?banned-books\.org(\/.*)?$/,
    (_match, rest: string | undefined) => `https://www.banned-books.org${rest ?? ''}`,
  )
}

export const SITE_URL: string = normaliseHost(
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.banned-books.org',
)
