import { SITEMAP_BASE_URL, type SitemapEntry } from './sitemap-xml'
import { publishedEssays } from './essays-data'

const base = SITEMAP_BASE_URL

const STATIC_ENTRIES: SitemapEntry[] = [
  { loc: base, changefreq: 'daily', priority: 1.0 },
  { loc: `${base}/top-100-banned-books`, changefreq: 'daily', priority: 1.0 },
  { loc: `${base}/banned-classics`, changefreq: 'weekly', priority: 0.9 },
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
  { loc: `${base}/sources`, changefreq: 'monthly', priority: 0.4 },
  { loc: `${base}/methodology`, changefreq: 'monthly', priority: 0.7 },
  { loc: `${base}/dataset`, changefreq: 'monthly', priority: 0.8 },
  { loc: `${base}/privacy`, changefreq: 'yearly', priority: 0.3 },
  { loc: `${base}/challenged-books`, changefreq: 'weekly', priority: 0.9 },
  { loc: `${base}/scope/school`, changefreq: 'weekly', priority: 0.8 },
  { loc: `${base}/scope/government`, changefreq: 'weekly', priority: 0.8 },
]

// Essay routes are derived from the registry so /essays index, sitemap, and
// the "More essays" footer can never drift apart.
const ESSAY_ENTRIES: SitemapEntry[] = publishedEssays().map(e => ({
  loc: `${base}${e.href}`,
  changefreq: 'monthly',
  priority: e.slug === 'history' ? 0.8 : 0.5,
}))

export const SITEMAP_STATIC_ENTRIES: SitemapEntry[] = [...STATIC_ENTRIES, ...ESSAY_ENTRIES]
