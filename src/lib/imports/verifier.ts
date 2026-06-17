// DB-backed verification of a normalized extraction against books / authors /
// countries / reasons. Returns a per-dimension match result; the gate then
// decides whether the job auto-approves or queues for review.
//
// Match strategy per dimension:
//   - book:    slug-lookup (exact)  ->  English-title slug (cross-language exact)
//              ->  pg_trgm RPC (fuzzy >= threshold) on title, then English title
//   - author:  slug-lookup (exact)  ->  pg_trgm RPC (fuzzy >= threshold)
//   - country: ISO code equality on `countries.code` (no fuzzy)
//   - reason:  slug-lookup on `reasons.slug` (no fuzzy)
//
// Speed: book / author exact pass uses a set-pre-load (single SELECT pulling
// all slugs into a JS Map), mirroring scripts/add-books-french-validation.ts.
// Fuzzy is per-row via RPC because the candidate space is small after slug
// pre-filter (only when exact misses).
//
// country_code semantics:
//   Only the 'manual' source has a null default_country_code. The verifier
//   reports country as status='no_match' in that case (no exception). The
//   high-stakes tier + no_match country will reliably push the job into the
//   review queue, which is the correct destination — an editor supplies the
//   country at review time. The committer's direct-write branch still refuses
//   to write a ban with null country_code (it never gets auto-approved here).
//
// 4 known-duplicate author pairs (Saenz, García Márquez, Saramago, Aguilar
// Zeleny) — the verifier picks the lower id deterministically and flags
// `duplicate_author_collision: true` so the audit trail captures it.

import { adminClient } from '../supabase'
import { slugify } from './slugify'
import type { ExtractionResult, AuthorRef } from './extraction-types'
import type { SourceConfig } from './source-registry'

// Thrown when a candidate's slug is on the CSAM-adjacent blocklist (Bucket A).
// The orchestrator's phase wrapper marks the job 'failed' with this message —
// no commit, no review-queue row. Distinct class so the failure is recognisable
// as a deliberate policy block, not a transient pipeline error.
export class BlockedByPolicyError extends Error {
  constructor(public readonly slug: string) {
    super(`blocked by CSAM policy (blocked_works): ${slug}`)
    this.name = 'BlockedByPolicyError'
  }
}

export type DimensionMatch = {
  status: 'exact' | 'fuzzy' | 'no_match'
  // Numeric for books / authors / reasons (bigint PKs); string for countries
  // (PK is `code` char(2), no surrogate id column).
  existing_id: number | string | null
  confidence: number | null
  candidates?: Array<{ id: number; name: string; score: number }>
}

export type VerificationResult = {
  book: DimensionMatch
  authors: DimensionMatch[]
  country: DimensionMatch
  reasons: DimensionMatch[]
  redirect_chain_excessive: boolean
  duplicate_author_collision: boolean
}

const REDIRECT_CHAIN_LIMIT = 5

// Known-duplicate author pairs in the existing books DB. Each pair shares a
// display_name but has two slug variants: the legacy pre-NFD-fix slug and
// the corrected NFD-aware slug. The pre-fix migration left both rows in
// place rather than merging — Sprint A imports must not blindly attach new
// bans to either side without flagging.
//
// Collision rule: if the verifier's fuzzy matches include rows from two
// different sides of a known pair, set duplicate_author_collision=true.
// The gate then blocks auto-approve and routes the job to review queue,
// where the admin makes the real merge call.
//
// Slugs (not display names) are the stable key. These were captured by an
// ad-hoc probe against prod (see commit log) — when the pairs are merged in
// a future cleanup, update this list.
const KNOWN_DUPLICATE_AUTHOR_GROUPS: string[][] = [
  // Benjamin Alire Sáenz
  ['benjamin-alire-s-enz', 'benjamin-alire-saenz'],
  // Gabriel García Márquez
  ['gabriel-garcia-marquez', 'gabriel-garc-a-m-rquez'],
  // José Saramago
  ['jose-saramago', 'jos-saramago'],
  // Sylvia Aguilar Zéleny
  ['sylvia-aguilar-zeleny', 'sylvia-aguilar-z-leny'],
]

export async function verifyExtraction(
  extraction: ExtractionResult,
  sourceConfig: SourceConfig,
  redirectCount: number,
): Promise<VerificationResult> {
  if (!extraction.is_book) {
    return emptyVerificationFor(extraction, redirectCount)
  }

  const sb = adminClient()

  // ----- Book dimension -----------------------------------------------------
  const bookSlug = slugify(extraction.title)

  // CSAM-adjacent policy: refuse re-import of a blocked (Bucket A) slug before
  // any matching/commit work. This is the reason the blocklist exists — a
  // silent delete would let the pipeline re-create the work on the next run.
  const { data: blocked } = await sb
    .from('blocked_works')
    .select('slug')
    .eq('slug', bookSlug)
    .maybeSingle()
  if (blocked) {
    console.warn(
      `[csam-policy] blocked re-import refused: slug="${bookSlug}" title="${extraction.title}"`,
    )
    throw new BlockedByPolicyError(bookSlug)
  }

  const book = await matchBook(
    sb,
    bookSlug,
    extraction.title,
    sourceConfig.fuzzy_thresholds.book_title,
    extraction.title_english_meaningful,
  )

  // ----- Author dimensions --------------------------------------------------
  const authorMatches: DimensionMatch[] = []
  const matchedAuthorSlugs: string[] = []
  for (const a of extraction.authors) {
    const slug = slugify(a.name)
    const match = await matchAuthor(
      sb,
      slug,
      a.name,
      sourceConfig.fuzzy_thresholds.author_name,
    )
    authorMatches.push(match)
    if (typeof match.existing_id === 'number') {
      // Track slug for collision detection. We need slugs of the matched rows,
      // not the input slug — fuzzy match could land us on a different slug.
      const matchedSlug = await fetchAuthorSlug(sb, match.existing_id)
      if (matchedSlug) matchedAuthorSlugs.push(matchedSlug)
    }
  }
  const duplicate_author_collision = detectDuplicateCollision(matchedAuthorSlugs)

  // ----- Country dimension --------------------------------------------------
  // null country_code is a soft no_match — manual sources will queue for
  // editor input rather than hard-fail here.
  const country =
    extraction.country_code === null
      ? noMatch()
      : await matchCountry(sb, extraction.country_code)

  // ----- Reason dimensions --------------------------------------------------
  const reasons: DimensionMatch[] = []
  for (const slug of extraction.reasons) {
    reasons.push(await matchReason(sb, slug))
  }

  return {
    book,
    authors: authorMatches,
    country,
    reasons,
    redirect_chain_excessive: redirectCount > REDIRECT_CHAIN_LIMIT,
    duplicate_author_collision,
  }
}

function emptyVerificationFor(
  extraction: ExtractionResult,
  redirectCount: number,
): VerificationResult {
  return {
    book: noMatch(),
    authors: extraction.authors.map(() => noMatch()),
    country: noMatch(),
    reasons: extraction.reasons.map(() => noMatch()),
    redirect_chain_excessive: redirectCount > REDIRECT_CHAIN_LIMIT,
    duplicate_author_collision: false,
  }
}

function noMatch(): DimensionMatch {
  return { status: 'no_match', existing_id: null, confidence: null }
}

type Sb = ReturnType<typeof adminClient>

// Default pg_trgm book-title threshold for the standalone matcher. Mirrors every
// SOURCE_REGISTRY entry's `book_title` threshold (all 0.85 today); one-off import
// scripts have no SourceConfig, so they get this.
const DEFAULT_BOOK_TITLE_FUZZY_THRESHOLD = 0.85

// Canonical, queue-free match-before-create helper for one-off import scripts.
// THE place to ask "is this book already in the DB?" before minting a row —
// keeping cross-language duplicate prevention at ingest, not in after-the-fact
// merges. Read-only (DB reads only); returns null on no_match.
//
// It reuses the exact same tiers as the LLM pipeline by delegating to the private
// `matchBook` (slugify + exact slug → English-title slug → pg_trgm fuzzy on title
// → fuzzy on English title). There is intentionally ONE matcher: do not
// re-implement title matching in importers — call this.
export async function matchExistingBook(opts: {
  title: string
  englishTitle?: string | null
  threshold?: number
}): Promise<{ id: number; status: 'exact' | 'fuzzy'; confidence: number | null } | null> {
  const sb = adminClient()
  const match = await matchBook(
    sb,
    slugify(opts.title),
    opts.title,
    opts.threshold ?? DEFAULT_BOOK_TITLE_FUZZY_THRESHOLD,
    opts.englishTitle ?? null,
  )
  if (match.status === 'no_match' || typeof match.existing_id !== 'number') return null
  return { id: match.existing_id, status: match.status, confidence: match.confidence }
}

// `englishTitle` is the LLM's `title_english_meaningful` — the work's English
// title even when `title` is a foreign-language edition (e.g. title="La Casa en
// Mango Street", englishTitle="The House on Mango Street"). It bridges the
// cross-language gap: a Spanish/translated edition slug never equals, nor
// pg_trgm-matches, the English canonical's slug/title, so without this tier the
// pipeline mints a fresh row for what is the same work — the root cause of the
// cross-language (Spanish-edition) duplicate class. Resolution order is
// precision-first: exact slug on the edition title, exact slug on the English
// title (cheap + high-precision cross-language hit), then fuzzy on each.
async function matchBook(
  sb: Sb,
  slug: string,
  title: string,
  threshold: number,
  englishTitle: string | null = null,
): Promise<DimensionMatch> {
  if (slug) {
    const exact = await exactBookBySlug(sb, slug)
    if (exact) return exact
  }

  // Cross-language exact tier: try the English title's slug. Only when it
  // differs from the edition slug (i.e. the title really is foreign), so an
  // already-English book costs no extra query.
  const englishSlug = englishTitle ? slugify(englishTitle) : ''
  if (englishSlug && englishSlug !== slug) {
    const exact = await exactBookBySlug(sb, englishSlug)
    if (exact) return exact
  }

  const fuzzy = await fuzzyBookByTitle(sb, title, threshold)
  if (fuzzy.status !== 'no_match') return fuzzy

  // Cross-language fuzzy fallback: spelling/punctuation variants of the English
  // title that the exact-slug tier missed.
  if (englishTitle && englishTitle.trim() && slugify(englishTitle) !== slug) {
    return fuzzyBookByTitle(sb, englishTitle, threshold)
  }
  return fuzzy
}

async function exactBookBySlug(sb: Sb, slug: string): Promise<DimensionMatch | null> {
  const { data } = await sb.from('books').select('id').eq('slug', slug).maybeSingle()
  return data ? { status: 'exact', existing_id: data.id, confidence: 1 } : null
}

async function fuzzyBookByTitle(sb: Sb, title: string, threshold: number): Promise<DimensionMatch> {
  const { data: candidates, error } = await sb.rpc('find_book_candidates_by_title', {
    q: title,
    threshold,
  })
  if (error) {
    throw new Error(`verifier: find_book_candidates_by_title failed: ${error.message}`)
  }
  return materializeFuzzy(
    (candidates ?? []) as Array<{ id: number; title: string; slug: string; score: number }>,
    (row) => ({ id: row.id, name: row.title, score: row.score }),
  )
}

async function matchAuthor(
  sb: Sb,
  slug: string,
  displayName: string,
  threshold: number,
): Promise<DimensionMatch> {
  if (slug) {
    const { data: exact } = await sb
      .from('authors')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (exact) {
      return { status: 'exact', existing_id: exact.id, confidence: 1 }
    }
  }

  const { data: candidates, error } = await sb.rpc('find_author_candidates_by_name', {
    q: displayName,
    threshold,
  })
  if (error) {
    throw new Error(`verifier: find_author_candidates_by_name failed: ${error.message}`)
  }
  return materializeFuzzy(
    (candidates ?? []) as Array<{ id: number; display_name: string; slug: string; score: number }>,
    (row) => ({ id: row.id, name: row.display_name, score: row.score }),
  )
}

function materializeFuzzy<R>(
  rows: R[],
  toCandidate: (row: R) => { id: number; name: string; score: number },
): DimensionMatch {
  if (rows.length === 0) return noMatch()
  const candidates = rows.map(toCandidate)
  const top = candidates[0]
  return {
    status: 'fuzzy',
    existing_id: top.id,
    confidence: top.score,
    candidates,
  }
}

async function fetchAuthorSlug(sb: Sb, id: number): Promise<string | null> {
  const { data } = await sb.from('authors').select('slug').eq('id', id).maybeSingle()
  return data?.slug ?? null
}

async function matchCountry(sb: Sb, code: string): Promise<DimensionMatch> {
  // countries has no surrogate id — primary key is `code` (char(2)).
  const { data, error } = await sb
    .from('countries')
    .select('code')
    .eq('code', code)
    .maybeSingle()
  if (error) {
    throw new Error(`verifier: country lookup failed: ${error.message}`)
  }
  if (data) return { status: 'exact', existing_id: data.code, confidence: 1 }
  return noMatch()
}

async function matchReason(sb: Sb, slug: string): Promise<DimensionMatch> {
  const { data, error } = await sb
    .from('reasons')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    throw new Error(`verifier: reason lookup failed: ${error.message}`)
  }
  if (data) return { status: 'exact', existing_id: data.id, confidence: 1 }
  return noMatch()
}

export function detectDuplicateCollision(matchedSlugs: string[]): boolean {
  for (const group of KNOWN_DUPLICATE_AUTHOR_GROUPS) {
    const overlap = group.filter((slug) => matchedSlugs.includes(slug))
    if (overlap.length >= 2) return true
  }
  return false
}

// Re-exported for use in committer (which needs the duplicate-pair logic to
// pick the canonical id when writing book_authors rows).
export const _KNOWN_DUPLICATE_AUTHOR_GROUPS = KNOWN_DUPLICATE_AUTHOR_GROUPS
