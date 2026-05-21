// Editorial intros, lead-paragraph builder, and FAQ builder for
// `/scope/[slug]` pages. Mirrors the country-faq.ts and the
// reasons-page REASON_INTROS pattern. Scopes are a small finite set
// (7 rows in the `scopes` table), so editorial copy is hardcoded
// here rather than promoted to a DB column.

import type { FaqItem } from '@/components/faq-accordion'
import { reasonPhrase } from '@/lib/reason-phrases'

// ── Editorial intros ──────────────────────────────────────────────────────
// Long-form context paragraph rendered below the data-driven lead.
// Slugs match the `scopes` table (with underscores, not dashes).
export const SCOPE_INTROS: Readonly<Record<string, string>> = {
  school:
    'School book bans dominate the modern censorship landscape in the United States. PEN America has tracked a sharp escalation since 2021, when organised parent groups and state legislation transformed isolated challenges into systematic district-by-district removals. Most events documented here are restrictions on classroom or library access in public K–12 schools, not criminal bans — but the practical effect is the same: students lose access. The vast majority of records come from PEN America\'s Index of School Book Bans, supplemented with American Library Association challenge reports for earlier years.',
  public_library:
    'Public library bans cover books removed, restricted, or relocated from general-circulation public library collections — distinct from school library decisions. The pretexts mirror the school-ban wave (sexual content, LGBTQ+ themes, "age-inappropriate" material), but the legal and political dynamics are different: public libraries serve adults as well as minors, and the First Amendment standards established in Board of Education v. Pico (1982) apply differently outside the school setting.',
  prison:
    'Prison book bans are among the least visible forms of censorship. U.S. state and federal prisons routinely reject books for vague "security" reasons, and the list of banned titles in some states runs into the tens of thousands. The Marshall Project and PEN America have documented the practice; the records here are partial because most prison systems don\'t publish their banned-book lists.',
  government:
    'Government bans are top-down censorship — national bans, court rulings, customs seizures, and executive orders. These are the historical headline cases: Lady Chatterley\'s Lover in the UK, Tropic of Cancer in the US, The Satanic Verses in dozens of countries. The category captures both the obscenity prosecutions of the 19th and 20th centuries and the contemporary national bans imposed by authoritarian regimes.',
  retail:
    'Retail bans cover books pulled from commercial sale — by booksellers under public pressure, by distributors, or under retail-distribution restrictions imposed by governments. The category is small but historically important: many of the 20th century\'s most famous obscenity cases began with a bookseller being prosecuted for stocking a title.',
  customs:
    'Customs and border seizures intercept books at the point of entry — a censorship method that allows a government to suppress foreign-published titles without formally banning domestic publication. Australia and Canada both maintained extensive customs ban-lists into the 20th century; many regimes still operate them in practice.',
  church:
    'Church bans are religious-authority prohibitions — most prominently the Catholic Church\'s Index Librorum Prohibitorum, maintained from 1559 to 1966. The Index included Galileo, Copernicus, Descartes, Locke, Voltaire, Hume, and most of the philosophical foundations of the modern world. The records here document Church bans both inside and outside the Index.',
}

// ── Top-list label helpers ────────────────────────────────────────────────
// Some scope rows store the pseudo-region "Nation" for events that apply
// federally rather than to a single state. We filter that out of "top
// states" — it's not a state.
export const PSEUDO_REGIONS = new Set(['Nation', 'National', ''])

// ── Lead paragraph (AI-Overview eligible) ─────────────────────────────────
// Generated from data, not editorial. Keeps the first viewport answer-y.
// All strings are stripped to one or two short sentences — the FAQ block
// carries the longer Q/A surface area.
export type ScopeLeadInput = {
  scopeSlug: string
  scopeLabel: string         // "School"
  distinctBooks: number      // 3933
  totalBans: number          // 10626
  earliestYear: number | null
  latestYear: number | null
  topReasonSlugs: string[]   // ['moral', 'lgbtq', ...] in descending count
  topStateNames: string[]    // ['Florida', 'Texas', ...] — pass [] if not US-heavy
  topCountryNames: string[]  // ['United States', ...] — first one used when no states
}

// Pluralisation helpers — kept inline to avoid pulling in a dep
function bookWord(n: number) { return n === 1 ? 'book' : 'books' }

export function buildScopeLead(input: ScopeLeadInput): string | null {
  if (input.distinctBooks === 0) return null

  const noun = scopeNounPlural(input.scopeSlug, input.scopeLabel)
  const head = `${input.distinctBooks.toLocaleString('en')} ${bookWord(input.distinctBooks)} have been banned, restricted, or challenged in ${noun}`

  // Geographic anchor — prefer states for US-dominated scopes, else countries.
  let where = ''
  if (input.topStateNames.length >= 2) {
    where = `, concentrated in ${input.topStateNames.slice(0, 3).join(', ')}`
  } else if (input.topCountryNames.length === 1) {
    where = `, almost entirely in ${input.topCountryNames[0]}`
  }

  // Reason anchor — joins onto the previous clause with "with most events
  // citing ..." to avoid the "most often … most often" stutter from an
  // earlier revision.
  let why = ''
  if (input.topReasonSlugs.length >= 1) {
    const phrases = input.topReasonSlugs.slice(0, 3).map(reasonPhrase)
    why = `, with most events citing ${phrases.join(', ')}`
  }

  // Time anchor — only show the year span when it's actually informative.
  // For school the raw span (1604–2025) is dominated by a handful of
  // mis-tagged outliers and would mislead more than inform; defer that to
  // the FAQ instead. For other scopes the span is editorial value-add.
  let when = ''
  if (input.scopeSlug !== 'school' && input.earliestYear && input.latestYear && input.latestYear !== input.earliestYear) {
    when = ` Documented events span ${input.earliestYear}–${input.latestYear}.`
  } else if (input.scopeSlug !== 'school' && input.earliestYear) {
    when = ` Earliest documented event: ${input.earliestYear}.`
  }

  return `${head}${where}${why}.${when}`
}

// "in U.S. schools" reads more naturally than "in school settings"; reserve
// the generic "settings" phrasing for the long-tail scopes where there
// isn't a clean preposition.
function scopeNounPlural(slug: string, label: string): string {
  switch (slug) {
    case 'school': return 'U.S. schools'
    case 'public_library': return 'public libraries'
    case 'prison': return 'prisons'
    case 'government': return 'national bans and government rulings'
    case 'retail': return 'retail-sale bans'
    case 'customs': return 'customs and border seizures'
    case 'church': return 'religious-authority bans'
    default: return `${label.toLowerCase()} settings`
  }
}

// ── FAQ ───────────────────────────────────────────────────────────────────
// Always-on data questions + scope-specific editorial answers. Mirrors
// country-faq's data-vs-editorial split.

export type ScopeFaqInput = {
  scopeSlug: string
  scopeLabel: string
  distinctBooks: number
  totalBans: number
  earliestYear: number | null
  latestYear: number | null
  topReasonSlugs: string[]
  topStateNames: string[]
  topBookTitles: string[]    // top 5 most-school-banned books — pass [] to skip
  activeBans: number
  historicalBans: number
}

const SCOPE_FAQ_EDITORIAL: Readonly<Record<string, FaqItem[]>> = {
  school: [
    {
      q: 'Who decides which books are banned in U.S. schools?',
      a: 'In most states, school boards or individual school administrators make the final decision after a parent or community-group challenge. Since 2021, state legislatures in Florida, Texas, Tennessee, and others have passed laws that require districts to remove titles meeting certain content criteria — effectively turning isolated challenges into mass removals.',
    },
    {
      q: 'What is the difference between banned, restricted, and challenged?',
      a: 'A **banned** book is removed from the school collection entirely. A **restricted** book is moved behind a librarian\'s desk, limited to specific grade levels, or made available only with parental permission. A **challenged** book has been formally objected to but the review may not yet have concluded. The records here use the original source\'s designation.',
    },
    {
      q: 'Where does this data come from?',
      a: 'The bulk of records come from [PEN America\'s Index of School Book Bans](https://pen.org/banned-books) (2021–present) and the [American Library Association\'s Office for Intellectual Freedom](https://www.ala.org/advocacy/bbooks) annual challenge reports. Each entry retains its district and state metadata when available.',
    },
  ],
  public_library: [
    {
      q: 'Can a public library legally ban a book?',
      a: 'In the United States, public libraries operate under their own collection-development policies and can remove or restrict books. The First Amendment limits arbitrary removals based purely on viewpoint, but the law gives libraries broad discretion. Other jurisdictions have stricter or more permissive standards.',
    },
  ],
  prison: [
    {
      q: 'Why are so many books banned in U.S. prisons?',
      a: 'Prisons routinely reject books citing vague "security" concerns — gang-related content, escape information, sexually explicit material. The lists in some states run into the tens of thousands of titles and are rarely published. Documentation here is partial because most prison systems don\'t publish their banned-book lists.',
    },
  ],
}

export function buildScopeFaq(input: ScopeFaqInput): FaqItem[] {
  if (input.distinctBooks === 0) return []
  const items: FaqItem[] = []
  const noun = scopeNounPlural(input.scopeSlug, input.scopeLabel)

  // 1. Headline count
  const topReasonClause = input.topReasonSlugs[0]
    ? ` The most frequently cited reason is ${reasonPhrase(input.topReasonSlugs[0])}.`
    : ''
  items.push({
    q: `How many books are banned in ${noun}?`,
    a: `${input.distinctBooks.toLocaleString('en')} distinct ${bookWord(input.distinctBooks)} are documented as banned, restricted, or challenged in ${noun}, across ${input.totalBans.toLocaleString('en')} individual events.${topReasonClause}`,
  })

  // 2. Editorial: who decides / what is the difference / where from
  for (const item of SCOPE_FAQ_EDITORIAL[input.scopeSlug] ?? []) {
    items.push(item)
  }

  // 3. Top states (school-specific data question)
  if (input.scopeSlug === 'school' && input.topStateNames.length >= 3) {
    items.push({
      q: 'Which U.S. states ban the most books in schools?',
      a: `The states with the most documented school book bans are ${input.topStateNames.slice(0, 5).join(', ')}. These five account for the majority of all records in PEN America\'s Index.`,
    })
  }

  // 4. Year span
  if (input.earliestYear && input.latestYear) {
    items.push({
      q: `When did book banning begin in ${noun}?`,
      a: `The earliest documented event in this category dates to ${input.earliestYear}; the most recent to ${input.latestYear}.`,
    })
  }

  // 5. Active vs historical
  if (input.activeBans > 0 && input.historicalBans > 0) {
    items.push({
      q: 'Are these bans still in effect?',
      a: `${input.activeBans.toLocaleString('en')} events are currently active; ${input.historicalBans.toLocaleString('en')} have been lifted or rescinded over the course of the dataset.`,
    })
  }

  // 6. Top reasons
  if (input.topReasonSlugs.length >= 2) {
    const phrases = input.topReasonSlugs.slice(0, 3).map(reasonPhrase)
    items.push({
      q: `What are the most common reasons for book bans in ${noun}?`,
      a: `The most frequently cited reasons are ${phrases.join(', ')}. See [the reasons taxonomy](/reasons) for full definitions of each category.`,
    })
  }

  // 7. Notable books — only when we have a confident top list
  if (input.topBookTitles.length >= 3) {
    items.push({
      q: `What are the most-banned books in ${noun}?`,
      a: `The titles most frequently affected include ${input.topBookTitles.slice(0, 5).join(', ')}. Each book\'s page lists every documented event with date, district, and source citation.`,
    })
  }

  return items
}

// Title-cased phrase for use in headers like "Frequently asked questions
// about school book bans". Falls back to "{label} bans" for unknown slugs.
export function scopeFaqTitle(slug: string, label: string): string {
  switch (slug) {
    case 'school': return 'school book bans'
    case 'public_library': return 'public-library book bans'
    case 'prison': return 'prison book bans'
    case 'government': return 'national book bans'
    case 'retail': return 'retail book bans'
    case 'customs': return 'customs book seizures'
    case 'church': return 'religious book bans'
    default: return `${label.toLowerCase()} bans`
  }
}
