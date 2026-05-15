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
//
// Most rows on this page carry no reason text — the Ministry of Culture and
// Islamic Guidance revokes/withholds publication permits without publishing
// rationale. Where notes exist they often only credit the translator
// ("Translated by Hossin Shahrabi"). reason-mapper's hasNoReasonSignal
// recognises both empty notes and translator-credit-only notes so the
// fallback below applies. 'moral' is the editorial default: Iranian permit
// decisions cite morality/social-mores and Islamic-conformity concerns;
// editors flip to 'religious' or 'political' per-row during review where the
// notes spell out a specific cause.
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
      fallback_reason_slug: 'moral',
      original_language: 'fa',
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

// ALA most-challenged books in the United States.
// Layout (after rowspan/colspan headers are skipped by the parser):
//   0 Title (wrapped in {{Sort|key|display}})
//   1 Author (wrapped in {{Sortname|First|Last}})
//   2 Reason(s) for Challenge   ← canonical reason text; notes_end=2
//   3 Year(s) published         ← first 4-digit run wins ("1885; 2018" → 1885)
//   4 ALA rank 2010–2019
//   5 ALA rank 2000–2009
//   6 ALA rank 1990–1999
// Rank columns are dropped (not in notes, not surfaced anywhere yet). Each
// row → one ban, action_type='challenged' (ALA tracks challenges, not formal
// bans) with scope='school' to match the PEN America convention for the
// US school-district challenge pattern.
const ALA: SourceConfig = {
  page: 'List_of_most_commonly_challenged_books_in_the_United_States',
  country_code: 'US',
  source_slug: 'wikipedia-ala-most-challenged',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'List',
      action_type_default: 'challenged',
      scope_default: 'school',
      status_default: 'historical',
      columns: { title: 0, authors: 1, year: 3, state: null, notes: 2, notes_end: 2 },
      // A handful of ALA rows have an empty notes cell where Wikipedia omits
      // the per-challenge rationale. ALA's framing for school challenges is
      // overwhelmingly age-appropriateness / moral-content based ("unsuited
      // to age group" is the most common ALA challenge category), so 'moral'
      // is the safest editorial default. Editors switch to lgbtq / sexual /
      // violence / religious during review where the row warrants it.
      fallback_reason_slug: 'moral',
    },
  ],
}

// New Zealand: 5 wikitables across 3 level-2 sections (with 2 level-3 sub-
// sections under the pre-1963 era). All 5 tables share the same 8-column
// layout: Published | Title | Author | Type | Banned by | Banned | Current
// status | Notes. We register each table's heading as a separate section so
// the parser walks all 5 (the parser extracts only the FIRST wikitable per
// section, so level-3 sub-sections need their own entries).
//
// scope_default='government' covers the era-specific reality: pre-1963 bans
// were customs/wartime decrees; the 1963-1994 Tribunal and 1994-present OFLC
// are both statutory national bodies. All are national-scope.
// status_default='historical' is a simplification — many 1994-present OFLC
// classifications are still active. Editors flip those during review.
const NZ_SECTION_BASE = {
  action_type_default: 'banned' as const,
  scope_default: 'government',
  status_default: 'historical' as const,
  columns: { title: 1, authors: 2, year: 0, state: null, notes: 7 },
}

const NEW_ZEALAND: SourceConfig = {
  page: 'List_of_books_banned_in_New_Zealand',
  country_code: 'NZ',
  source_slug: 'wikipedia-nz',
  source_type: 'wikipedia',
  // Per-section fallbacks capture the era-specific reason context:
  //   - Indecent Publications Tribunal eras (1841–1994) and OFLC (1994–present)
  //     are statutory obscenity/indecency regimes — every ban on those lists
  //     traces back to morality/sexual-content concerns. fallback='obscenity'.
  //   - WW1/WW2 sections were wartime customs/sedition decrees — political
  //     censorship of seditious or anti-government material. fallback='political'.
  // Applied only when the notes cell has no signal; rows with "restricted N in YYYY"
  // or richer text still go through the strict pattern mapper first.
  sections: [
    { heading: 'Before the Indecent Publications Tribunal (1841–1963)', ...NZ_SECTION_BASE, fallback_reason_slug: 'obscenity' },
    { heading: 'World War I period (1914–1920)', ...NZ_SECTION_BASE, fallback_reason_slug: 'political' },
    { heading: 'World War II (1939–1945)', ...NZ_SECTION_BASE, fallback_reason_slug: 'political' },
    { heading: 'Indecent Publications Tribunal (1963–1994)', ...NZ_SECTION_BASE, fallback_reason_slug: 'obscenity' },
    { heading: 'Office of Film and Literature Classification (1994–present)', ...NZ_SECTION_BASE, fallback_reason_slug: 'obscenity' },
  ],
}

// Index Librorum Prohibitorum (Catholic Church's list of prohibited books,
// 1559–1966). Two wikitables: the main "List of authors and works in the
// final edition" (12 rows) and "Reversals and non-inclusions" (6 rows).
// Each row represents one AUTHOR with one or more works in the Works cell,
// separated by `;` after wikitext-strip. Authors are shown in sorted form
// ("Machiavelli, Niccolo") which the author parser unflips to "Niccolo
// Machiavelli".
//
// country_code: 'VA' (Vatican City) — the Index was a Holy See instrument.
// Not perfectly accurate for the early modern period when the Papal States
// preceded the modern Vatican, but VA is the only available ISO code that
// maps to the Catholic Church as banning authority.
//
// scope_default: 'government' — closest match for a centralized formal
// authority's enumerated list. (No 'religious' scope exists in this DB.)
const INDEX_LIBRORUM_BASE = {
  action_type_default: 'banned' as const,
  scope_default: 'government',
  status_default: 'historical' as const,
  columns: { title: 2, authors: 1, year: 0, state: null, notes: 3 },
  // Split Works cell on `;<br>` (pre-strip, so we don't mis-fire on titles
  // that contain an internal `;` like "Religio Medici; the religion of a
  // physician"). Each segment becomes one ParsedRow.
  multi_title_separator: /\s*;\s*<br\s*\/?>\s*/i,
  // The Index is, by definition, the Catholic Church's catalogue of works
  // condemned on doctrinal/religious grounds — every entry on the list is
  // banned for religious reasons. The Wikipedia table has no per-row "reason"
  // column (notes cells are citation refs that strip to empty), so without
  // this fallback every row routes to review as 'unmapped_reason'.
  fallback_reason_slug: 'religious',
}

const INDEX_LIBRORUM: SourceConfig = {
  page: 'List_of_authors_and_works_on_the_Index_Librorum_Prohibitorum',
  country_code: 'VA',
  source_slug: 'wikipedia-index-librorum',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'List of authors and works in the final edition, with later additions',
      ...INDEX_LIBRORUM_BASE,
    },
    {
      heading: 'Reversals and non-inclusions',
      ...INDEX_LIBRORUM_BASE,
    },
  ],
}

// Hong Kong: Book_censorship_in_Hong_Kong#List_of_banned_books.
// Single wikitable with 9 inline-`||`-separated columns per row:
//   0 Disclosure date     (e.g. "2020-07-4" — not zero-padded)
//   1 Title               (bilingual: "Han / Latin transliteration")
//   2 Author              (bilingual: "陳雲 / Chen, Yun.")
//   3 Banned by Public Libraries     ({{tick}} → ✓)
//   4 Banned by school libraries
//   5 Banned in ebook or e-databases
//   6 Banned by CSD
//   7 Complained
//   8 Ref.                (citation refs, mostly empty post-strip)
//
// The parser pre-processes `||` → newline-`|` (see parseRowCells) so the
// inline format becomes per-line cells, and {{tick}} → ✓ so the checkbox
// columns retain meaning after wikitext strip. Bilingual titles/authors
// are split via the parser's bilingual-pattern helpers — the Latin form
// becomes canonical, the native form fills title_native / (eventually,
// once author-multilingualism lands) author native fields.
//
// notes = idx 3..7 (the 5 ban-locus columns joined). The resulting
// description shows which library/system flagged the book, even though
// there's no explicit reason text on the HK page. Editors decide the
// final scope + reason during review.
const HONG_KONG: SourceConfig = {
  page: 'Book_censorship_in_Hong_Kong',
  country_code: 'HK',
  source_slug: 'wikipedia-hong-kong',
  source_type: 'wikipedia',
  sections: [
    {
      heading: 'List of banned books',
      action_type_default: 'banned',
      scope_default: 'government',
      // Post-2020 NSL-era bans; most are still in force.
      status_default: 'active',
      columns: { title: 1, authors: 2, year: 0, state: null, notes: 3, notes_end: 7 },
      // The HK page is a matrix of which retailer/library banned each book;
      // notes cells are just "✓" tick markers, not reason text. The bans
      // themselves are NSL-era political censorship — every entry on this
      // table was removed under the 2020 National Security Law framework.
      // Without this fallback every row routes to review as 'unmapped_reason'.
      fallback_reason_slug: 'political',
      // Titles on this page are bilingual ("Han / Latin transliteration");
      // post-handover HK uses traditional Chinese characters. Setting this
      // here means the review form auto-fills `original_language='zh'`
      // without relying on country-code inference for new imports.
      original_language: 'zh',
    },
  ],
}

export const WIKIPEDIA_SOURCES: Record<string, SourceConfig> = {
  india: INDIA,
  iran: IRAN,
  china: CHINA,
  'banned-by-governments': BANNED_BY_GOVERNMENTS,
  ala: ALA,
  nz: NEW_ZEALAND,
  'index-librorum': INDEX_LIBRORUM,
  'hong-kong': HONG_KONG,
}
