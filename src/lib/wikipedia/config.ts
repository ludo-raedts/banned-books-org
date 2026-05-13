// Per-source configuration for the Wikipedia bulk-parser.
//
// Adding a new source = adding a new key to WIKIPEDIA_SOURCES. The CLI's
// --source flag indexes into this map. Heading strings must match the exact
// wikitext heading text (the part between `==` markers, trimmed).
//
// India is the only source in this iteration. The architecture is built to
// accept additional sources (Index_Librorum_Prohibitorum,
// List_of_books_banned_by_governments) without further restructuring.

import type { SourceConfig } from './types'

const INDIA: SourceConfig = {
  page: 'List_of_books_banned_in_India',
  country_code: 'IN',
  source_slug: 'wikipedia-india',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'Nationwide',
      action_type_default: 'banned',
      scope_default: 'government',
      status_default: 'historical',
      has_state_column: false,
    },
    {
      heading: 'Statewide',
      action_type_default: 'banned',
      scope_default: 'government',
      status_default: 'historical',
      has_state_column: true,
    },
    {
      heading: 'Other challenged books',
      action_type_default: 'challenged',
      scope_default: 'government',
      status_default: 'historical',
      has_state_column: false,
    },
  ],
}

export const WIKIPEDIA_SOURCES: Record<string, SourceConfig> = {
  india: INDIA,
}
