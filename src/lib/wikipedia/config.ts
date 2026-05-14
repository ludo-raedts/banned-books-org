// Per-source configuration for the Wikipedia bulk-parser.
//
// Adding a new source = adding a new key to WIKIPEDIA_SOURCES. The CLI's
// --source flag indexes into this map. Heading strings must match the exact
// wikitext heading text (the part between `==` markers, trimmed).
//
// columns is a 0-based index map into wikitable cells per section. Sources
// without a year or state column set those to null. The `notes` index marks
// where the notes blob starts; everything from that cell onward is joined
// and fed to the reason-mapper.

import type { ColumnMap, SectionConfig, SourceConfig } from './types'

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
      columns: { year: 0, title: 1, authors: 2, state: null, notes: 3 },
    },
    {
      heading: 'Statewide',
      action_type_default: 'banned',
      scope_default: 'government',
      status_default: 'historical',
      columns: { year: 0, title: 1, authors: 2, state: 3, notes: 4 },
    },
    {
      heading: 'Other challenged books',
      action_type_default: 'challenged',
      scope_default: 'government',
      status_default: 'historical',
      columns: { year: 0, title: 1, authors: 2, state: null, notes: 3 },
    },
  ],
}

// Iran columns: Title | Author | Type of literature | References and notes
// No year column. The "type of literature" cell at index 2 is intentionally
// skipped (notes starts at 3) so phrases like "novel" / "short stories" do
// not pollute the reason-mapper input.
const IRAN: SourceConfig = {
  page: 'Book_censorship_in_Iran',
  country_code: 'IR',
  source_slug: 'wikipedia-iran',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'Books banned in Iran',
      action_type_default: 'banned',
      scope_default: 'government',
      status_default: 'historical',
      columns: { title: 0, authors: 1, year: null, state: null, notes: 3 },
    },
  ],
}

// China columns: Title | Author | Type | Notes.
// No year column (publication year is sometimes embedded in the title cell
// as "Title (YYYY)" but we don't extract that here — auto-approve is blocked
// without a year regardless, so editors set it during review).
const CHINA: SourceConfig = {
  page: 'Book_censorship_in_China',
  country_code: 'CN',
  source_slug: 'wikipedia-china',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'List of censored books',
      action_type_default: 'banned',
      scope_default: 'government',
      status_default: 'historical',
      columns: { title: 0, authors: 1, year: null, state: null, notes: 3 },
    },
  ],
}

// ----------------------------------------------------------------------------
// List_of_books_banned_by_governments (multi-country master aggregator)
// ----------------------------------------------------------------------------
//
// Three observed column layouts across the 78 level-2 country sections:
//
//   STD5 (57 countries): Title | Author(s) | Year published | Type | Notes
//   STD7  (3 countries): Title | Author(s) | Year published | Year banned
//                        | Year unbanned | Type | Notes
//   US6   (1 country):   Title | Author(s) | Year published | Year unbanned
//                        | Type | Notes
//
// Czechoslovakia uses "Author" instead of "Author(s)" but the column-map is
// identical to STD7. South Korea has "Year published (South Korea)" but the
// column-map is identical to STD5.
//
// Skipped sections (intentional):
//   - China:        own importer (BANNED_BY_GOVERNMENTS would double-import)
//   - Israel:       no wikitable in this section
//   - Ukraine:      no wikitable in this section
//   - Afghanistan:  2-column layout (Title | Notes), no author cell — parser's
//                   ColumnMap requires an authors index
//   - Papal States: historical entity, no ISO code in countries table
//   - Roman Empire: historical entity, no ISO code in countries table
//   - Liberia, Nepal, Papua New Guinea, Senegal, Uzbekistan: missing from the
//                   countries table (FK constraint would fail). Add them to
//                   the countries table to enable.
//
// Known partial coverage:
//   - Germany: 5 wikitables in level-3 sub-sections (Weimar / Nazi /
//              East / West / Criminal-Code-86 / Criminal-Code-131). Parser
//              extracts only the FIRST wikitable per level-2 section, so only
//              the Weimar Republic table is imported in this iteration.
//   - Russia:  2 wikitables; only the first is imported.

const STD5: ColumnMap = { title: 0, authors: 1, year: 2, state: null, notes: 4 }
const STD7: ColumnMap = { title: 0, authors: 1, year: 2, state: null, notes: 6 }
const US6:  ColumnMap = { title: 0, authors: 1, year: 2, state: null, notes: 5 }

type CountryEntry = readonly [heading: string, iso: string, columns: ColumnMap]

const BANNED_BY_GOVERNMENTS_COUNTRIES: readonly CountryEntry[] = [
  ['Albania', 'AL', STD5],
  ['Argentina', 'AR', STD5],
  ['Australia', 'AU', STD7],
  ['Austria', 'AT', STD7],
  ['Bangladesh', 'BD', STD5],
  ['Belgium', 'BE', STD5],
  ['Bosnia and Herzegovina', 'BA', STD5],
  ['Brazil', 'BR', STD5],
  ['Canada', 'CA', STD5],
  ['Chile', 'CL', STD5],
  ['Czechoslovakia', 'CS', STD7],
  ['Egypt', 'EG', STD5],
  ['El Salvador', 'SV', STD5],
  ['Eritrea', 'ER', STD5],
  ['France', 'FR', STD5],
  ['Germany', 'DE', STD5],
  ['Greece', 'GR', STD5],
  ['Guatemala', 'GT', STD5],
  ['India', 'IN', STD5],
  ['Indonesia', 'ID', STD5],
  ['Iran', 'IR', STD5],
  ['Ireland', 'IE', STD5],
  ['Italy', 'IT', STD5],
  ['Japan', 'JP', STD5],
  ['Kenya', 'KE', STD5],
  ['Kuwait', 'KW', STD5],
  ['Lebanon', 'LB', STD5],
  ['Malaysia', 'MY', STD5],
  ['Morocco', 'MA', STD5],
  ['Mauritius', 'MU', STD5],
  ['Netherlands', 'NL', STD5],
  ['New Zealand', 'NZ', STD5],
  ['Nigeria', 'NG', STD5],
  ['Norway', 'NO', STD5],
  ['Pakistan', 'PK', STD5],
  ['Philippines', 'PH', STD5],
  ['Poland', 'PL', STD5],
  ['Portugal', 'PT', STD5],
  ['Qatar', 'QA', STD5],
  ['Russia', 'RU', STD5],
  ['Soviet Union', 'SU', STD5],
  ['Saudi Arabia', 'SA', STD5],
  ['Singapore', 'SG', STD5],
  ['South Africa', 'ZA', STD5],
  ['South Korea', 'KR', STD5],
  ['Spain', 'ES', STD5],
  ['Sri Lanka', 'LK', STD5],
  ['Tanzania', 'TZ', STD5],
  ['Taiwan', 'TW', STD5],
  ['Thailand', 'TH', STD5],
  ['Uganda', 'UG', STD5],
  ['United Arab Emirates', 'AE', STD5],
  ['United Kingdom', 'GB', STD7],
  ['United States', 'US', US6],
  ['Uruguay', 'UY', STD5],
  ['Vietnam', 'VN', STD5],
  ['Yugoslavia', 'YU', STD5],
]

function bannedByGovernmentsSection(
  heading: string,
  iso: string,
  columns: ColumnMap,
): SectionConfig {
  return {
    heading,
    action_type_default: 'banned',
    scope_default: 'government',
    status_default: 'historical',
    columns,
    country_code: iso,
  }
}

const BANNED_BY_GOVERNMENTS: SourceConfig = {
  page: 'List_of_books_banned_by_governments',
  country_code: null,  // multi-country source; each section overrides
  source_slug: 'wikipedia-banned-by-governments',
  source_type: 'wikipedia',
  sections: BANNED_BY_GOVERNMENTS_COUNTRIES.map(([h, iso, c]) =>
    bannedByGovernmentsSection(h, iso, c),
  ),
}

export const WIKIPEDIA_SOURCES: Record<string, SourceConfig> = {
  india: INDIA,
  iran: IRAN,
  china: CHINA,
  'banned-by-governments': BANNED_BY_GOVERNMENTS,
}
