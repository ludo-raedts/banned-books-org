// Notes-text → reason slug.
//
// The slug vocabulary mirrors the `reasons` table in production:
//   blasphemy, drugs, language, lgbtq, moral, obscenity, other,
//   political, racial, religious, sexual, violence.
// No new slugs are introduced here; everything not matching a pattern is
// routed to review.
//
// Decision flow (per editorial doctrine 2026-05-13):
//   1. Try every explicit reason pattern. First match wins; confidence='high'.
//   2. No reason pattern matched, but the notes describe an import/customs
//      mechanism ("imported", "cannot be brought into India", etc.) → the
//      ban exists but the underlying reason is unknown from the cell. Tag
//      with slug='other' + quality_flag='import_ban_no_explicit_reason' and
//      route to review.
//   3. No reason and no import-clue → slug=null + quality_flag='unmapped_reason',
//      route to review.
//
// This intentionally avoids labelling customs-driven bans as 'political' by
// default. Better an extra review row than systematically wrong reasons in
// production.
//
// Pattern design notes:
//   - Word-stems (terror, secession, defamat, disparag, alleg) drop the
//     trailing \b so "terrorism" / "secessionism" / "defamation" all match.
//   - LGBTQ patterns are deliberately narrow — bare words like "bisexual"
//     or "gay" cause false positives (e.g. an anti-LGBTQ ban claim against a
//     biographical book). Only unambiguously identity-themed phrases match.
//   - Political patterns include India-specific markers: "Naxalite",
//     "Khalistan", "Sikh state", "Hindu Mahasabha"-style party defamation,
//     "British colonial" bans (almost always sedition in this dataset).

import type { QualityFlag, ReasonMapping } from './types'

// Order matters: more specific patterns come first. The first match wins.
const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // ── LGBTQ ────────────────────────────────────────────────────────────────
  // Strict: identity-themed phrases only. Bare "gay" / "lesbian" / "bisexual"
  // excluded because they appear in unrelated defamation contexts.
  [/\b(lgbt|homosexual|same-sex|sexual orientation|transgender|gay rights|lesbian rights|gay (community|relationship)|lesbian (community|relationship))\b/i, 'lgbtq'],

  // ── Blasphemy ────────────────────────────────────────────────────────────
  [/\bblasph/i, 'blasphemy'],

  // ── Obscenity / pornography ──────────────────────────────────────────────
  [/\b(obscen|pornograph|sexually explicit|indecen)/i, 'obscenity'],

  // ── Sexual / erotic ──────────────────────────────────────────────────────
  [/\b(sexual content|erotic|incest)\b/i, 'sexual'],

  // ── Religious offence ────────────────────────────────────────────────────
  // Trailing \b deliberately omitted: the alternation contains stems like
  // "hindu" / "islam" / "muslim" that should also match plurals ("Hindus")
  // and inflected forms. Each pattern starts on a word boundary; that's
  // enough to avoid mid-word false positives.
  [
    /\b(prophet muhammad|prophet of islam|muhammad'?s|mock(?:ing|s|ed)? (?:islam|hindu|christian|muslim|sikh)|critique of political islam|fatwa|muslim religious|hindu sentiment|hindu mahasabha|sikh faith|hurt religious|religious sentiment|religious sect|communal (?:discord|disharmony|tension|violence|feeling|harmony)|insult.*(?:islam|hindu|christian|muslim|sikh|prophet|religion|allah|god)|defamation of religion|anti-religious|religious hatred|holy book|sacred text|objectionable material against|insult.*(?:faith|sect)|offend.*(?:islam|hindu|christian|muslim|sikh)|disrespect.*(?:prophet|hindu|islam)|attempt to insult|holy war|waging.*jihad|(?:hindu|muslim|christian|sikh|jewish|buddhist) (?:view|perspective|critique) of (?:christianity|islam|hinduism|sikhism|judaism|buddhism))/i,
    'religious',
  ],

  // ── Political — sedition, separatism, terrorism, extremism ──────────────
  // Trailing \b dropped for the same reason: stems must match inflected
  // forms ("secessionism", "terrorism", "extremist", etc.).
  [
    /\b(seditio|anti-state|anti-government|treason|subversi|secession|terror|extremis|naxalite|maoist|marxist|communist party|khalistan|sikh state|insurg|incite.*disaffection|hindutva)/i,
    'political',
  ],

  // ── Political — security / public order ─────────────────────────────────
  [
    /\b(national security|public order|propagat.*false narrative|psyche of youth|culture of grievance|incit.*violence|cause.*violence|promote.*discord|may cause.*violence|disturb.*tranquil)/i,
    'political',
  ],

  // ── Political — defamation of state / political figure ──────────────────
  // Stems ("defamato" / "disparag" / "alleg") need no trailing boundary —
  // inflected forms ("defamatory", "disparaging", "allegedly") must match.
  [
    /\b(derogatory|defamato|libel|disparag|in (?:poor|bad) light|negative portrayal of|portrayed.*(?:in a bad light)|cia informer|alleg.*(?:cia|informer|spy|defame|paid)|defaming.*(?:gandhi|nehru|patel|shivaji|modi|indira)|defamation suit|defaming the)/i,
    'political',
  ],

  // ── Political — colonial-era British bans ───────────────────────────────
  // In this dataset, "banned by British authorities/colonial government" is
  // an almost-perfect proxy for sedition or anti-imperial speech. Confident
  // editorial label for pre-1947 ban entries.
  [/\bbanned by (?:the )?british (?:colonial )?(?:government|authorit)/i, 'political'],

  // ── Political — Indian political figures / parties ──────────────────────
  // Named figures (Gandhi, Nehru, Modi, Sonia Gandhi, etc.) and partisan
  // parties (Shiv Sena, BJP, Congress, Hindutva movement) appear in cells
  // describing defamation suits, political fiction, and partisan complaints.
  // The phrases below are narrow enough that they do not collide with the
  // many cells where these names appear only as historical context.
  [
    /\b(right-wing party|left-wing party|shiv sena|protests? from the party|sonia gandhi|congress (?:lawyer|spokesperson|leader)|(?:gandhi|nehru|indira|modi|patel|shivaji) was (?:a |an )?)/i,
    'political',
  ],

  // ── Drugs ───────────────────────────────────────────────────────────────
  [/\b(drug abuse|narcot|cannabis|marijuana|opium|heroin)\b/i, 'drugs'],

  // ── Violence / gore ─────────────────────────────────────────────────────
  [/\b(graphic violence|gore|grisly|gratuitous violence)\b/i, 'violence'],

  // ── Racial / caste / Indigenous ─────────────────────────────────────────
  // Caste is context-gated: bare "caste" appears in descriptive notes about
  // book content (e.g. "the book is about Hinduism, caste and phallicism")
  // without indicating a caste-related ban reason. Require an explicit
  // discrimination/hatred/violence qualifier.
  [
    /\b(racial|racism|caste discrimination|caste hatred|caste violence|caste-based discrimination|anti-caste|dalit|adivasi|santhal|tribal portrayal)\b/i,
    'racial',
  ],

  // ── Moral / family-values ───────────────────────────────────────────────
  [/\b(immoral(?:ity)?|good taste|family value|moral decay)\b/i, 'moral'],

  // ── Language / profanity ────────────────────────────────────────────────
  [/\b(inappropriate language|profan|swear word|vulgar language)\b/i, 'language'],
]

// Detects notes that *only* describe an import-ban mechanism. Step 2 in the
// flow above. "Imported into" is the most common phrasing on the India page.
const IMPORT_BAN_HINT =
  /\b(import(?:ed)? (?:into|in)|cannot be brought|cannot be imported|prohibit.*import|customs)\b/i

// Civil-defamation patterns. Defamation suits/cases by private parties (or
// individual politicians acting privately) are civil actions, not state-
// imposed bans on political grounds. Even when a court issues a temporary
// stay, editorial review is required to decide whether the row meets the
// project's inclusion criteria. Checked BEFORE the main pattern loop so
// these never get auto-mapped to 'political' via the "defamato" stem.
const DEFAMATION_SUIT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bdefamation\s+suit/i,
  /\bdefamation\s+case/i,
  /\bdefamatory/i,
  /\blibel\s+suit/i,
]

export type ReasonMapResult = {
  mapping: ReasonMapping
  extra_flags: QualityFlag[]
}

export function mapReason(notes: string): ReasonMapResult {
  if (DEFAMATION_SUIT_PATTERNS.some(p => p.test(notes))) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['defamation_suit_civil'],
    }
  }
  for (const [re, slug] of PATTERNS) {
    if (re.test(notes)) {
      return { mapping: { slug, confidence: 'high' }, extra_flags: [] }
    }
  }
  if (IMPORT_BAN_HINT.test(notes)) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['import_ban_no_explicit_reason'],
    }
  }
  return {
    mapping: { slug: null, confidence: 'low' },
    extra_flags: ['unmapped_reason'],
  }
}
