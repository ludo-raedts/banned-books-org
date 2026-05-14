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
  | 'civil_action_private_party'   // private party obtained an injunction / sued for damages / filed a lawsuit
  | 'civil_court_stay_order'       // civil court issued a stay-order pending verdict (procedural, not final)
  | 'author_disjunction'           // author cell had "X or Y" — ambiguous attribution, kept first only

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
  state: string | null             // only set when section's column-map has a state index
  notes_raw: string                // wikitext-stripped notes text (used by reason-mapper)
  source_anchor: string            // section-anchor for source_url fragment
  quality_flags: QualityFlag[]     // detected during parsing
}

export type ReasonMapping = {
  slug: string | null
  confidence: 'high' | 'low'
}

export type DedupMatchType =
  | 'slug_collision'        // books.slug equality (fast first-pass)
  | 'fuzzy_title_author'    // fuzzy title + author-intersection passed the duplicate cutoff
  | 'fuzzy_possible'        // fuzzy match below the duplicate cutoff — review needed

export type DedupResult =
  | { kind: 'none' }
  | {
      kind: 'duplicate'
      book_id: number
      similarity: number
      match_type: Extract<DedupMatchType, 'slug_collision' | 'fuzzy_title_author'>
    }
  | {
      kind: 'possible_duplicate'
      book_id: number
      similarity: number
      match_type: Extract<DedupMatchType, 'fuzzy_possible'>
    }

export type ImportDecision =
  | { mode: 'auto_approve'; row: ParsedRow; reason: ReasonMapping }
  | {
      mode: 'review'
      row: ParsedRow
      reason: ReasonMapping
      dedup: DedupResult
      quality_flags: QualityFlag[]
    }

// Per-section column mapping. Indices are 0-based cell positions within a
// wikitable row. `notes` is the index where the notes/description blob starts;
// the parser joins everything from that index to the end of the row. Sources
// without a year or state column set those to null. The "type of literature"
// column on the Iran page is intentionally not modeled — it gets absorbed
// into the notes blob via a `notes` index that points past it, or the column
// is included by setting `notes` to overlap it (caller's choice).
export type ColumnMap = {
  title: number
  authors: number
  year: number | null
  state: number | null
  notes: number
}

export type SectionConfig = {
  heading: string                  // exact wikitext heading (between == ... ==)
  action_type_default: 'banned' | 'restricted' | 'challenged'
  scope_default: string            // scopes.slug
  status_default: 'active' | 'historical'
  columns: ColumnMap
  // Per-section ISO 3166-1 alpha-2 override. Used by multi-country sources
  // like List_of_books_banned_by_governments where each `== Country ==`
  // section maps to a different country. Falls back to SourceConfig.country_code.
  country_code?: string
}

export type SourceConfig = {
  page: string                     // Wikipedia page slug (URL path component)
  // ISO 3166-1 alpha-2; fallback when SectionConfig.country_code is unset.
  // Optional so multi-country sources (e.g. List_of_books_banned_by_governments)
  // can require per-section codes instead of one source-level constant.
  country_code: string | null
  source_slug: string              // import_review_queue.source_slug
  source_type: string              // ban_sources.source_type (free text in prod)
  sections: SectionConfig[]
}
