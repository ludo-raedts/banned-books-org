// Shared types for the Wikipedia bulk-parser pipeline.
//
// This module is intentionally separate from src/lib/imports/. The Wikipedia
// path consumes already-structured wikitext tables; no LLM extraction, no
// two-pass agreement, no archive fallback. The shape below reflects that:
// one ParsedRow per table-row, one ImportDecision per ParsedRow.

export type QualityFlag =
  | 'citation_needed'              // {{cn}} or [citation needed] in source notes
  | 'incomplete_year'              // year could not be parsed
  | 'no_author'                    // author cell empty or only "Various" / "Religious text"
  | 'no_title'                     // title cell empty (row is skipped silently)
  | 'unmapped_reason'              // notes did not match any reason pattern
  | 'import_ban_no_explicit_reason'// notes only describe an import-ban mechanism, no underlying reason
  | 'possible_duplicate'           // dedup found a 0.5 < sim ≤ 0.85 match
  | 'model_3_review_needed'        // title contained native-script or meaning annotation; editor decides script + language
  | 'defamation_suit_civil'        // notes describe a civil defamation suit, not a state-imposed ban

export type ParsedRow = {
  year: number | null
  title: string                    // canonical book title, wikitext-stripped
  // Model 3 splits captured by the parser when present. The parser only
  // extracts the text — it never assigns title_native_script or
  // original_language; those are editor decisions in review. Auto-approve
  // is blocked whenever either of these is set, via the
  // 'model_3_review_needed' quality flag.
  title_native?: string | null
  title_english_meaningful?: string | null
  authors: string[]                // 0+ display names, wikitext-stripped
  state: string | null             // only set for sections with has_state_column
  notes_raw: string                // wikitext-stripped notes text (used by reason-mapper)
  source_anchor: string            // section-anchor for source_url fragment
  quality_flags: QualityFlag[]     // detected during parsing
}

export type ReasonMapping = {
  slug: string | null
  confidence: 'high' | 'low'
}

export type DedupResult =
  | { kind: 'none' }
  | { kind: 'duplicate'; book_id: number; similarity: number }
  | { kind: 'possible_duplicate'; book_id: number; similarity: number }

export type ImportDecision =
  | { mode: 'auto_approve'; row: ParsedRow; reason: ReasonMapping }
  | {
      mode: 'review'
      row: ParsedRow
      reason: ReasonMapping
      dedup: DedupResult
      quality_flags: QualityFlag[]
    }

export type SectionConfig = {
  heading: string                  // exact wikitext heading (between == ... ==)
  action_type_default: 'banned' | 'restricted' | 'challenged'
  scope_default: string            // scopes.slug
  status_default: 'active' | 'historical'
  has_state_column: boolean        // true when an extra State(s) column sits between Author and Notes
}

export type SourceConfig = {
  page: string                     // Wikipedia page slug (URL path component)
  country_code: string             // ISO 3166-1 alpha-2; all bans created from this source land in this country
  source_slug: string              // import_review_queue.source_slug
  source_type: string              // ban_sources.source_type (free text in prod)
  sections: SectionConfig[]
}
