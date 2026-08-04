/**
 * Stage 0 — Ireland (Censorship of Publications Board) banned-books seed.
 *
 * Emits data/ireland-censorship-<date>.json for import-ireland-censorship.ts
 * (standard new-source pipeline, scripts/README.md §1).
 *
 * SOURCES (documenting sources; the banning body is the Irish Censorship of
 * Publications Board under the Censorship of Publications Acts 1929–1967):
 *   - Notre Dame, Irish Studies / Hesburgh Library — dated banned-books list
 *     drawn from Donal Ó Drisceoil's catalogue (Oxford History of the Irish
 *     Book, vol. 5).  https://sites.nd.edu/irish-hesburgh/censorship/
 *   - Wikipedia — "Book censorship in the Republic of Ireland" (for two
 *     internationally-famous titles absent from the ND list).
 *
 * DATA DOCTRINE:
 *   - `year` = BAN year (year_started), NOT publication year. The ND list
 *     tracks the year of prohibition (cross-checked: Borstal Boy 1958, The
 *     Country Girls 1960, The Dark 1965 all match known ban years).
 *   - first_published_year stays NULL — this source does not give it (PT rule).
 *   - ban_status = 'historical': Irish book-ban orders auto-lapse 12 years
 *     after issue (Censorship of Publications Act 1967, s.2), so every literary
 *     order below has long expired. (The handful of pre-1992 abortion titles
 *     that remain ACTIVE are already in the DB and are not re-imported here.)
 *   - reason_slug = 'obscenity': the statutory ground was "indecent or
 *     obscene". Uniform across the batch — per-title reason refinement (a few
 *     were anti-clerical / birth-control) is left to later enrichment rather
 *     than guessed here.
 *
 * SCOPE: books only. Periodicals/magazines from the Register are excluded.
 *
 * DROPPED (deliberate): "Paddy Maguire Is Dead", "Land of Spices", "The Laws
 * of Life", "The Midnight Court" (translator-attribution ambiguity), and
 * "Judith Hearne" (already in DB as "The Lonely Passion of Judith Hearne" —
 * the short title would miss the matcher and mint a duplicate).
 */
import { writeFileSync } from 'node:fs'

const ND = {
  name: 'University of Notre Dame — Irish Studies, Hesburgh Library (Ó Drisceoil banned-books catalogue)',
  url: 'https://sites.nd.edu/irish-hesburgh/censorship/',
  type: 'reference',
}
const WP = {
  name: 'Wikipedia — Book censorship in the Republic of Ireland',
  url: 'https://en.wikipedia.org/wiki/Book_censorship_in_the_Republic_of_Ireland',
  type: 'wikipedia',
}

// [title, author, ban_year, source, slug_override?]
type Src = { name: string; url: string; type: string }
const R: [string, string, number, Src, string?][] = [
  ['More Pricks Than Kicks', 'Samuel Beckett', 1934, ND],
  ['The Pilgrimage', 'John Broderick', 1961, ND],
  ['Rose Forbes', 'George Buchanan', 1950, ND],
  ['A Fearful Joy', 'Joyce Cary', 1950, ND],
  ['Castle Corner', 'Joyce Cary', 1938, ND],
  ['Charley Is My Darling', 'Joyce Cary', 1940, ND],
  ['Herself Surprised', 'Joyce Cary', 1942, ND],
  ['The Bright Temptation', 'Austin Clarke', 1932, ND],
  ['The Singing Men at Cashel', 'Austin Clarke', 1936, ND],
  ['Hunger of the Heart', 'Rearden Conner', 1950, ND],
  ['A Singular Man', 'J. P. Donleavy', 1964, ND],
  ['The Cabfather', 'Lee Dunne', 1976, ND],
  ['My Life and Loves', 'Frank Harris', 1950, ND],
  ['Selected Stories', 'Norah Hoult', 1946, ND],
  ['Coming from the Fair', 'Norah Hoult', 1937, ND],
  ['Augusta Steps Out', 'Norah Hoult', 1942, ND],
  ['Four Women Grow Up', 'Norah Hoult', 1940, ND],
  ['Honey Seems Bitter', 'Benedict Kiely', 1952, ND],
  ['There Was an Ancient House', 'Benedict Kiely', 1955, ND],
  ['In a Harbour Green', 'Benedict Kiely', 1950, ND],
  ['Alone We Embark', 'Maura Laverty', 1943, ND],
  ['Liberty Lad', 'Maurice Leitch', 1965, ND],
  ['Poor Lazarus', 'Maurice Leitch', 1969, ND],
  ['I Am Alone', 'Walter Macken', 1950, ND],
  ['Julie', 'Ethel Mannin', 1940, ND, 'julie-ethel-mannin'],
  ['Ragged Banners', 'Ethel Mannin', 1931, ND],
  ['Red Rose', 'Ethel Mannin', 1941, ND],
  ['Rolling in the Dew', 'Ethel Mannin', 1940, ND],
  ['The Blossoming Bough', 'Ethel Mannin', 1943, ND],
  ['Cactus', 'Ethel Mannin', 1942, ND],
  ['Captain Moonlight', 'Ethel Mannin', 1943, ND],
  ['Commonsense and Morality', 'Ethel Mannin', 1942, ND],
  ['Commonsense and the Child', 'Ethel Mannin', 1942, ND],
  ['Confessions and Impressions', 'Ethel Mannin', 1930, ND],
  ['The Feast of Lupercal', 'Brian Moore', 1957, ND],
  ['The Luck of Ginger Coffey', 'Brian Moore', 1960, ND],
  ['An Answer from Limbo', 'Brian Moore', 1962, ND],
  ["A Story-Teller's Holiday", 'George Moore', 1933, ND],
  ['Girl with the Green Eyes', "Edna O'Brien", 1964, ND],
  ['August Is a Wicked Month', "Edna O'Brien", 1965, ND],
  ['Mary Lavelle', "Kate O'Brien", 1936, ND],
  ['Pictures in the Hallway', "Sean O'Casey", 1942, ND],
  ['Windfalls', "Sean O'Casey", 1934, ND],
  ['The Common Chord', "Frank O'Connor", 1947, ND],
  ["Travellers' Samples", "Frank O'Connor", 1951, ND],
  ['Kings, Lords and Commons', "Frank O'Connor", 1961, ND],
  ['Bird Alone', "Sean O'Faolain", 1936, ND],
  ['Midsummer Night Madness', "Sean O'Faolain", 1932, ND],
  ['Hollywood Cemetery', "Liam O'Flaherty", 1937, ND],
  ['The Puritan', "Liam O'Flaherty", 1932, ND],
  ['Shame the Devil', "Liam O'Flaherty", 1934, ND],
  ['A Hillside Man', "Con O'Leary", 1933, ND],
  ['Going Native', 'Oliver St. John Gogarty', 1942, ND],
  ['The Adventures of the Black Girl in Her Search for God', 'George Bernard Shaw', 1933, ND],
  ['Julie', 'Francis Stuart', 1939, ND, 'julie-francis-stuart'],
  ['The Flowering Cross', 'Francis Stuart', 1950, ND],
  ['The Gadfly', 'E. L. Voynich', 1943, ND],
  ['On a Dark Night', 'Anthony West', 1950, ND],
  // Wikipedia — internationally famous, absent from ND list
  ['The Well of Loneliness', 'Radclyffe Hall', 1930, WP],
  ['Point Counter Point', 'Aldous Huxley', 1930, WP],
]

const INCLUSION_RATIONALE =
  'Prohibited by the Irish Censorship of Publications Board as "indecent or obscene" ' +
  'under the Censorship of Publications Acts (1929–1967); order lapsed after the ' +
  'statutory 12-year period.'

const rows = R.map(([title, author, year, src, slug_override], i) => ({
  source_row_id: i + 1,
  title,
  title_english_meaningful: null,
  authors: [author],
  publication_year: null,
  year,
  country_code: 'IE',
  scope_slug: 'government',
  action_type: 'banned' as const,
  ban_status: 'historical' as const,
  reason_slug: 'obscenity',
  inclusion_rationale: INCLUSION_RATIONALE,
  source_name: src.name,
  source_url: src.url,
  source_type: src.type,
  ...(slug_override ? { slug_override } : {}),
}))

const out = `data/ireland-censorship-2026-08-04.json`
writeFileSync(out, JSON.stringify({ generated: '2026-08-04', count: rows.length, rows }, null, 2))
console.log(`wrote ${out} — ${rows.length} rows`)
