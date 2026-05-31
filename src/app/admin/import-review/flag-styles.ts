// Color-coded badges for quality flags, per the import-review spec:
//   red    = editorial blocker (civil suit, defamation, court stay)
//   amber  = needs human attention (Model 3 review, possible duplicate)
//   yellow = data gap (missing reason, unmapped, missing author/year/citation)
//   blue   = informational (author disjunction, source-default reason)
// Unknown flags fall back to gray.

import type { QueueStatus } from './list-client'

const RED   = 'bg-red-100 text-red-800'
const AMBER = 'bg-amber-100 text-amber-800'
const YELLOW = 'bg-yellow-100 text-yellow-800'
const BLUE  = 'bg-blue-100 text-blue-800'

export const FLAG_BADGE_CLASS: Record<string, string> = {
  defamation_suit_civil:        RED,
  civil_action_private_party:   RED,
  civil_court_stay_order:       RED,
  model_3_review_needed:        AMBER,
  possible_duplicate:           AMBER,
  import_ban_no_explicit_reason: YELLOW,
  unmapped_reason:              YELLOW,
  no_author:                    YELLOW,
  no_title:                     YELLOW,
  incomplete_year:              YELLOW,
  citation_needed:              YELLOW,
  author_disjunction:           BLUE,
  source_default_reason:        BLUE,
  year_inferred_from_notes:     AMBER,
}

export const FLAG_TOOLTIPS: Record<string, string> = {
  defamation_suit_civil:
    'Notes describe a civil defamation suit, not a state-imposed ban — editorial decision needed on whether this belongs in the catalogue.',
  civil_action_private_party:
    'Private party obtained an injunction / sued for damages / filed a lawsuit — editorial decision needed.',
  civil_court_stay_order:
    'Civil court issued a stay-order pending verdict (procedural, not a final ban).',
  model_3_review_needed:
    'Title contained native-script or English-meaning annotation; editor must decide title_native_script and original_language.',
  possible_duplicate:
    'Dedup found a 0.5 < similarity ≤ 0.85 match; review whether to merge into the existing book.',
  import_ban_no_explicit_reason:
    'Notes describe a customs/import-ban mechanism but no underlying censorship reason.',
  unmapped_reason:
    'Notes did not match any reason pattern; editor must pick a reason slug.',
  no_author:
    'Author cell was empty or only contained generic terms like "Various" or "Religious text".',
  no_title:
    'Title cell was empty in the source.',
  incomplete_year:
    'Year column could not be parsed into a number.',
  citation_needed:
    '{{cn}} or [citation needed] tag in the source notes — Wikipedia itself flags this as unverified.',
  author_disjunction:
    'Author cell had "X or Y" — ambiguous attribution; only the first name was kept.',
  source_default_reason:
    'Notes cell had no reason text; reason slug filled from the source-level context (e.g. Index Librorum → religious, Hong Kong NSL list → political). Confidence stays low — glance at the row before approving.',
  year_inferred_from_notes:
    'Year column was empty; the first 4-digit year inside notes_raw was used as a best-guess ban year. Verify before approving — phrases like "released in YYYY" or "lifted in YYYY" would mark the ban END year, not start.',
}

export const STATUS_BADGE_CLASS: Record<QueueStatus, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved:       'bg-emerald-100 text-emerald-800',
  rejected:       'bg-red-100 text-red-800',
  deferred:       'bg-gray-200 text-gray-700',
}
