// Editorial content-block helpers.
//
// A content block is a slug-keyed chunk of editorial markdown rendered into a
// public page (e.g. `bbw-what-is`, `theme-lgbtq-intro`). Three statuses:
//
//   placeholder  — never on public; an editorial brief is shown in admin
//   draft        — never on public; admin can iterate
//   published    — body_html is rendered on the public page
//
// Public pages must hide their section if the corresponding block isn't
// published, and a page-level publish action must refuse to flip a page
// "live" while any required block is still in placeholder. The single source
// of truth for that mapping is REQUIRED_BLOCKS_BY_PAGE below.

import { adminClient, serverClient } from './supabase'

export type ContentBlockStatus = 'placeholder' | 'draft' | 'published'

export type ContentBlockRow = {
  slug: string
  title: string
  placeholder_brief: string
  body_markdown: string | null
  body_html: string | null
  status: ContentBlockStatus
  notes: string | null
  last_edited_by: string | null
  last_edited_at: string
  published_at: string | null
  created_at: string
}

// Pages on the public site whose publish state depends on content blocks.
// When a page tries to publish, every block in its list must be `published`.
// Keep the keys descriptive — they're only used in admin UI strings.
export const REQUIRED_BLOCKS_BY_PAGE: Record<string, readonly string[]> = {
  'bbw-hub': [
    'bbw-hero-subtitle',
    'bbw-what-is',
    'bbw-why-matters',
    'bbw-other-side',
    'bbw-reading-intro',
    'bbw-what-you-can-do',
  ],
  'bbw-tile': ['bbw-tile-tagline'],
  'reading-club-hub': [
    'reading-club-intro',
    'reading-club-why',
    'reading-club-how-to-start',
    'reading-club-universal-questions',
  ],
  'reading-club-currently-challenged': ['track-currently-challenged-intro'],
  'reading-club-international': ['track-international-intro'],
  'reading-club-classics': ['track-classics-intro'],
  'reading-club-themes': ['track-themes-intro'],
  'reading-club-young-readers': ['track-young-readers-intro'],
  'theme-lgbtq': ['theme-lgbtq-intro'],
  'theme-political-dissent': ['theme-political-dissent-intro'],
  'theme-religious-censorship': ['theme-religious-censorship-intro'],
  'theme-race-and-racism': ['theme-race-and-racism-intro'],
  'theme-sexuality': ['theme-sexuality-intro'],
} as const

// Public route for each page key above. Used by the admin content-block API
// to revalidate the ISR page a block renders on when it is (un)published —
// the consuming pages cache for 24h, so without this a publish would stay
// invisible for up to a day.
export const PAGE_PATH_BY_KEY: Record<string, string> = {
  'bbw-hub': '/banned-books-week',
  'bbw-tile': '/',
  'reading-club-hub': '/reading-club',
  'reading-club-currently-challenged': '/reading-club/currently-challenged',
  'reading-club-international': '/reading-club/international',
  'reading-club-classics': '/reading-club/classics',
  'reading-club-themes': '/reading-club/by-theme',
  'reading-club-young-readers': '/reading-club/young-readers',
  'theme-lgbtq': '/reading-club/by-theme/lgbtq',
  'theme-political-dissent': '/reading-club/by-theme/political-dissent',
  'theme-religious-censorship': '/reading-club/by-theme/religious-censorship',
  'theme-race-and-racism': '/reading-club/by-theme/race-and-racism',
  'theme-sexuality': '/reading-club/by-theme/sexuality',
}

// Every public path that renders the given block slug (via the page mapping).
export function pathsForBlockSlug(slug: string): string[] {
  const paths: string[] = []
  for (const [pageKey, slugs] of Object.entries(REQUIRED_BLOCKS_BY_PAGE)) {
    if (slugs.includes(slug) && PAGE_PATH_BY_KEY[pageKey]) paths.push(PAGE_PATH_BY_KEY[pageKey])
  }
  return paths
}

// Fetch a published block's HTML for public-page rendering. Returns null when
// the block is not yet published — callers MUST hide their section in that
// case rather than rendering an empty box. Uses the public anon-key client.
export async function getPublishedBlockHtml(slug: string): Promise<string | null> {
  const { data } = await serverClient()
    .from('content_blocks')
    .select('body_html, status')
    .eq('slug', slug)
    .maybeSingle()
  if (!data || data.status !== 'published' || !data.body_html) return null
  return data.body_html
}

// Bulk variant — one round-trip for a whole page. Returns a Map keyed by slug
// with the HTML for every published block; missing/unpublished blocks are
// simply absent from the map.
export async function getPublishedBlockMap(slugs: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (slugs.length === 0) return out
  const { data } = await serverClient()
    .from('content_blocks')
    .select('slug, body_html, status')
    .in('slug', slugs as string[])
  for (const row of (data ?? []) as Pick<ContentBlockRow, 'slug' | 'body_html' | 'status'>[]) {
    if (row.status === 'published' && row.body_html) {
      out.set(row.slug, row.body_html)
    }
  }
  return out
}

// Admin-side: fetch every block for a page along with status, so the admin UI
// can show "X of Y blocks published" badges and refuse to flip the page live.
export async function getBlocksForPage(pageKey: string): Promise<ContentBlockRow[]> {
  const slugs = REQUIRED_BLOCKS_BY_PAGE[pageKey] ?? []
  if (slugs.length === 0) return []
  const { data } = await adminClient()
    .from('content_blocks')
    .select('*')
    .in('slug', slugs as string[])
  // Preserve the order declared in REQUIRED_BLOCKS_BY_PAGE.
  const bySlug = new Map((data ?? []).map(r => [r.slug, r as ContentBlockRow]))
  return slugs.map(s => bySlug.get(s)).filter((r): r is ContentBlockRow => r != null)
}

// Returns true when every required block for a page is `published`. Used by
// the admin layer to gate page-level publish actions.
export async function isPageReadyToPublish(pageKey: string): Promise<{
  ready: boolean
  missing: string[]
}> {
  const blocks = await getBlocksForPage(pageKey)
  const missing = blocks.filter(b => b.status !== 'published').map(b => b.slug)
  return { ready: missing.length === 0, missing }
}
