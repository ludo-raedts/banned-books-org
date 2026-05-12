// Per-source configuration for the import pipeline.
//
// Tier semantics (drives auto-approve eligibility in gate.ts):
//   - 'high-volume':  large catalogues with consistent shape (PEN America, ALA lists).
//                     Auto-approve allowed when extraction is full-agreement, Latin-script,
//                     and all dimensions exact-match.
//   - 'high-stakes':  legal/governmental sources where a wrong import is materially worse
//                     than a queued one (Legifrance, national archives, manual one-offs).
//                     Auto-approve disabled regardless of gate result; every job is queued
//                     for human review.
//
// fuzzy_thresholds: minimum pg_trgm similarity for book-title and author-name matches
// against existing rows. Below these thresholds the verifier reports 'no_match'.
//
// archive_strategy: ordered list of services to try. Wayback is blocked on some
// Cloudflare-fronted sources (Legifrance, france-archives) — those route to
// archive.today first, Wayback as fallback.

export type SourceTier = 'high-volume' | 'high-stakes'
export type ArchiveService = 'wayback' | 'archive_today'

export type SourceConfig = {
  tier: SourceTier
  fuzzy_thresholds: { book_title: number; author_name: number }
  default_country_code: string | null
  archive_strategy: ArchiveService[]
}

export const SOURCE_REGISTRY: Record<string, SourceConfig> = {
  legifrance: {
    tier: 'high-stakes',
    fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
    default_country_code: 'FR',
    archive_strategy: ['archive_today', 'wayback'],
  },
  france_archives: {
    tier: 'high-stakes',
    fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
    default_country_code: 'FR',
    archive_strategy: ['archive_today', 'wayback'],
  },
  pen_america: {
    tier: 'high-volume',
    fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
    default_country_code: 'US',
    archive_strategy: ['wayback', 'archive_today'],
  },
  manual: {
    tier: 'high-stakes',
    fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
    default_country_code: null,
    archive_strategy: ['wayback', 'archive_today'],
  },
}

export function getSourceConfig(sourceType: string): SourceConfig {
  const config = SOURCE_REGISTRY[sourceType]
  if (!config) throw new Error(`Unknown source_type: ${sourceType}`)
  return config
}
