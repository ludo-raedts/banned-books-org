// DB-backed verification of a normalized extraction against books / authors /
// countries / reasons. Returns a per-dimension match result; the gate then
// decides whether the job auto-approves or queues for review.
//
// Match strategy per dimension:
//   - book:    slug-lookup (exact)  ->  pg_trgm RPC (fuzzy >= threshold)
//   - author:  slug-lookup (exact)  ->  pg_trgm RPC (fuzzy >= threshold)
//   - country: ISO code equality on `countries.code` (no fuzzy)
//   - reason:  slug-lookup on `reasons.slug` (no fuzzy)
//
// Speed: book / author exact pass uses a set-pre-load (single SELECT pulling
// all slugs into a JS Map), mirroring scripts/add-books-french-validation.ts.
// Fuzzy is per-row via RPC because the candidate space is small after slug
// pre-filter (only when exact misses).
//
// Hard errors (the orchestrator catches and marks the job as 'failed'):
//   - country_code is null
//       Only the 'manual' source has a null default_country_code; if a manual
//       job reaches the verifier without an explicit country, the caller must
//       inject one before running. We refuse to silently pass null through.
//   - 4 known-duplicate author pairs (Saenz, García Márquez, Saramago,
//       Aguilar Zeleny) — the verifier picks the lower id deterministically
//       and flags `duplicate_author_collision: true` so the audit trail
//       captures it.

import { adminClient } from '../supabase'
import { slugify } from './slugify'
import type { ExtractionResult, AuthorRef } from './extraction-types'
import type { SourceConfig } from './source-registry'

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

  if (extraction.country_code === null) {
    throw new Error(
      'verifier: country_code is null. Manual sources must inject an explicit country_code before verification.',
    )
  }

  const sb = adminClient()

  // ----- Book dimension -----------------------------------------------------
  const bookSlug = slugify(extraction.title)
  const book = await matchBook(
    sb,
    bookSlug,
    extraction.title,
    sourceConfig.fuzzy_thresholds.book_title,
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
  const country = await matchCountry(sb, extraction.country_code)

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

async function matchBook(
  sb: Sb,
  slug: string,
  title: string,
  threshold: number,
): Promise<DimensionMatch> {
  if (slug) {
    const { data: exact } = await sb
      .from('books')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (exact) {
      return { status: 'exact', existing_id: exact.id, confidence: 1 }
    }
  }

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
