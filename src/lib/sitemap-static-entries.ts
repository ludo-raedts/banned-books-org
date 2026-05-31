import { SITEMAP_BASE_URL, type SitemapEntry } from './sitemap-xml'
import { publishedEssays } from './essays-data'
import { THEME_REASON_MAP } from './reading-club-data'
import { isBannedBooksWeekActive } from '@/config/banned-books-week'

const base = SITEMAP_BASE_URL

// Returns the static sitemap entries. Async because the BBW changefreq /
// priority depend on the runtime config (DB-backed), not on a build-time
// constant. Other entries (countries, reasons, books) are emitted by the
// per-resource sitemap routes and aren't included here.
export async function getSitemapStaticEntries(): Promise<SitemapEntry[]> {
  const isBbwActive = await isBannedBooksWeekActive()

  const STATIC_ENTRIES: SitemapEntry[] = [
    { loc: base, changefreq: 'daily', priority: 1.0 },
    { loc: `${base}/top-100-banned-books`, changefreq: 'daily', priority: 1.0 },
    { loc: `${base}/banned-classics`, changefreq: 'weekly', priority: 0.9 },
    { loc: `${base}/banned-childrens-books`, changefreq: 'weekly', priority: 0.9 },
    // Top-list destination pages introduced with the homepage redesign
    // (commit 628c317). Each shows top-50 with ItemList JSON-LD; trending /
    // rising are view-driven so refresh daily, most-banned / non-english
    // are ban-driven so weekly is enough.
    { loc: `${base}/trending-banned-books`, changefreq: 'daily', priority: 0.9 },
    { loc: `${base}/rising-banned-books`, changefreq: 'daily', priority: 0.8 },
    { loc: `${base}/most-banned-authors`, changefreq: 'weekly', priority: 0.9 },
    { loc: `${base}/non-english-banned-books`, changefreq: 'weekly', priority: 0.9 },
    { loc: `${base}/banned-books/2026`, changefreq: 'daily', priority: 0.9 },
    { loc: `${base}/banned-books/2025`, changefreq: 'weekly', priority: 0.9 },
    { loc: `${base}/banned-books/2024`, changefreq: 'monthly', priority: 0.8 },
    { loc: `${base}/banned-books/2023`, changefreq: 'monthly', priority: 0.8 },
    { loc: `${base}/banned-books/2022`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/countries`, changefreq: 'weekly', priority: 0.9 },
    { loc: `${base}/stats`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/reasons`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/news`, changefreq: 'daily', priority: 0.8 },
    { loc: `${base}/essays`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/reading-list`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/about`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/press`, changefreq: 'monthly', priority: 0.6 },
    { loc: `${base}/sources`, changefreq: 'monthly', priority: 0.4 },
    { loc: `${base}/methodology`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/dataset`, changefreq: 'monthly', priority: 0.8 },
    { loc: `${base}/timeline`, changefreq: 'monthly', priority: 0.8 },
    { loc: `${base}/privacy`, changefreq: 'yearly', priority: 0.3 },
    { loc: `${base}/challenged-books`, changefreq: 'weekly', priority: 0.9 },
    // Catalogue browse/search landing — the "Books" breadcrumb target on every
    // book page, previously discoverable only via internal links.
    { loc: `${base}/search`, changefreq: 'weekly', priority: 0.8 },
    // Laws — long-form Article pages cross-linked from country/book pages.
    { loc: `${base}/laws/loi-gayssot`, changefreq: 'monthly', priority: 0.7 },
    // Data-quality HTML page (the .md twin is listed below for AI crawlers).
    { loc: `${base}/data-quality`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/scope/school`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/scope/government`, changefreq: 'weekly', priority: 0.8 },
    // Reading Club — evergreen, hub + 5 tracks + 5 theme subpages.
    { loc: `${base}/reading-club`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/reading-club/currently-challenged`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/reading-club/international`, changefreq: 'weekly', priority: 0.8 },
    { loc: `${base}/reading-club/classics`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/reading-club/young-readers`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${base}/reading-club/by-theme`, changefreq: 'monthly', priority: 0.7 },
    ...Object.keys(THEME_REASON_MAP).map<SitemapEntry>(slug => ({
      loc: `${base}/reading-club/by-theme/${slug}`,
      changefreq: 'monthly',
      priority: 0.6,
    })),
    // Discover — interactive "pick me a banned book" wheel. Static landing,
    // dynamic per-spin state lives in the URL (not part of the canonical).
    { loc: `${base}/discover`, changefreq: 'weekly', priority: 0.7 },
    // Banned Books Week hub — included year-round so search engines know the
    // page exists; gets a higher changefreq when the configured window is live.
    {
      loc: `${base}/banned-books-week`,
      changefreq: isBbwActive ? 'daily' : 'monthly',
      priority: isBbwActive ? 0.9 : 0.6,
    },
    // LLM-facing surfaces. /llms.txt is the curated entry point for AI
    // crawlers; the .md twins of the long-form prose pages give crawlers
    // clean markdown without parsing JSX. Listed here so they flow through
    // sitemap-static.xml, indexnow-delta diffs, and getAllCanonicalUrls().
    { loc: `${base}/llms.txt`, changefreq: 'weekly', priority: 0.5 },
    { loc: `${base}/methodology.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/data-quality.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/about.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/history.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/why-not-amazon.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/essays/what-we-document.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/essays/forbidden-knowledge-iceberg.md`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${base}/essays/the-grey-zone.md`, changefreq: 'monthly', priority: 0.5 },
  ]

  // Essay routes are derived from the registry so /essays index, sitemap, and
  // the "More essays" footer can never drift apart.
  const ESSAY_ENTRIES: SitemapEntry[] = publishedEssays().map(e => ({
    loc: `${base}${e.href}`,
    changefreq: 'monthly',
    priority: e.slug === 'history' ? 0.8 : 0.5,
  }))

  return [...STATIC_ENTRIES, ...ESSAY_ENTRIES]
}
