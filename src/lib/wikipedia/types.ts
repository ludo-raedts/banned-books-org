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
  title_transliterated?: string | null
  title_english_meaningful?: string | null
  authors: string[]                // 0+ display names, wikitext-stripped (Anglo-canonical form)
  // Per-author multilingual metadata, parallel-indexed to `authors`. Set
  // when the source cell carried a native-script form alongside the Latin
  // display name (Hong Kong's "陳雲 / Chen, Yun." pattern). NULL when no
  // native form was detectable for that author. Used by the importer to
  // populate authors.name_native at commit time without re-running the
  // split logic.
  author_meta?: Array<{ name_native: string | null } | null>
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
  // Same baseline-quality gates as auto_approve, but dedup found an existing
  // book that matches. The pipeline creates a NEW ban on the existing book
  // (different country / scope / year than what's already on it) instead of
  // a new books row. Idempotent against repeat runs via a SELECT-first guard
  // on (book_id, country_code, year_started, scope_id).
  | {
      mode: 'auto_add_ban'
      row: ParsedRow
      reason: ReasonMapping
      dedup: Extract<DedupResult, { kind: 'duplicate' }>
    }
  | {
      mode: 'review'
      row: ParsedRow
      reason: ReasonMapping
      dedup: DedupResult
      quality_flags: QualityFlag[]
    }

// Per-section column mapping. Indices are 0-based cell positions within a
// wikitable row. `notes` is the index where the notes/description blob starts;
// by default the parser joins everything from that index to the end of the row.
// Set `notes_end` (inclusive) to cap the slice — needed for tables where
// columns AFTER the notes/reason text exist but aren't useful as description
// (e.g. ALA's rank-by-decade columns sit after the reason column).
// Sources without a year or state column set those to null. The "type of
// literature" column on the Iran page is intentionally not modeled — it gets
// absorbed into the notes blob via a `notes` index that points past it, or
// the column is included by setting `notes` to overlap it (caller's choice).
export type ColumnMap = {
  title: number
  authors: number
  year: number | null
  state: number | null
  notes: number
  notes_end?: number
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
  // ISO 639-1 language code for books in this section. Drives both
  // `books.original_language` at commit and `authors.original_language`
  // for new authors. Optional — leave unset when the section spans
  // multiple languages (e.g. master-aggregator country sections where
  // banned books are in many languages).
  original_language?: string
  // When set, the title cell may list multiple works separated by this
  // pattern (e.g. "Title A; Title B; Title C"). The parser then emits ONE
  // ParsedRow per work, all sharing the same year/author/notes. Used by
  // the Index Librorum Prohibitorum source where each row is an AUTHOR
  // with one or more banned works.
  multi_title_separator?: RegExp
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
