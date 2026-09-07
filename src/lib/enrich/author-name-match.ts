/**
 * Author-name agreement: does an external record name the person we think it
 * does? Shared by the two sides of the same problem:
 *
 *   • src/lib/enrich/author-photos.ts — the GATE. Its OpenLibrary branch used
 *     to accept the first /search/authors doc that had a photo, with no name
 *     check at all, so any author whose name merely *retrieved* a photo-bearing
 *     record inherited that record's face. Trombone Shorty ("Troy Andrews")
 *     ended up with a photo of Lauran Paine, a western pulp writer who died in
 *     2001, because Paine's ~80 pseudonyms include "Troy Howard (pseud.)".
 *   • scripts/_audit_author_photo_olid.ts — the DETECTOR that found it, and
 *     which re-checks the whole population against this same rule.
 *
 * One definition on purpose: if the gate and the detector disagreed, the
 * enricher would keep writing rows the audit then flags.
 *
 * Doctrine, inherited from src/lib/enrich/title-match.ts: a MISSING photo is
 * always better than a confidently-wrong one, so anything we cannot positively
 * verify is refused rather than guessed. The match is deliberately lenient
 * about *how* a person is recorded (pen names, maiden names, inverted
 * "Surname, First" forms, transliterations, diacritics, ligatures) and strict
 * about *who* they are (surname agreement in a shared script).
 */

// ── name normalisation / matching ──────────────────────────────────────

// Particles and honorifics/suffixes are structural, not identifying: "van" is
// shared by thousands of unrelated Dutch names, and "jr"/"sir" by none. They
// are dropped so they can never be the token that clears a row.
const NAME_NOISE = new Set([
  'van', 'von', 'de', 'del', 'della', 'der', 'den', 'di', 'da', 'dos', 'das',
  'du', 'la', 'le', 'les', 'el', 'al', 'bin', 'ibn', 'bint', 'ben', 'ter', 'tot',
  'af', 'av', 'zu', 'y', 'e', 'of', 'the', 'and',
  'jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'dr', 'prof', 'sir', 'dame',
  'mr', 'mrs', 'ms', 'mme', 'esq', 'lady', 'lord', 'saint', 'st',
  // OL routinely tags records with these, never part of the human's name
  'pseud', 'pseudonym', 'author', 'editor', 'illustrator', 'translator',
])

// Ligatures and stroked letters have NO NFD decomposition, so accent-stripping
// alone leaves them as non-alnum and shreds the token: "Kœstler" became
// {stler} and failed to match OL's "Arthur Koestler". Fold them explicitly
// before the accent pass.
const LIGATURES: Array<[RegExp, string]> = [
  [/œ/g, 'oe'], [/æ/g, 'ae'], [/ø/g, 'o'], [/ß/g, 'ss'],
  [/đ/g, 'd'], [/ð/g, 'd'], [/þ/g, 'th'], [/ł/g, 'l'],
  [/ı/g, 'i'], [/ħ/g, 'h'], [/ŋ/g, 'n'], [/ŧ/g, 't'],
]

function foldLigatures(s: string): string {
  let out = s.toLowerCase()
  for (const [re, to] of LIGATURES) out = out.replace(re, to)
  return out
}

function stripAccents(s: string): string {
  return foldLigatures(s).normalize('NFD').replace(/\p{Mn}/gu, '')
}

/**
 * Accent-stripped, lowercased, letter/digit-split name tokens. Single
 * characters are dropped so a lone initial ("J.") can't create a spurious
 * overlap, and the particle/honorific noise above is removed — same shape as
 * the nameTokens() helper in src/lib/enrich/title-match.ts, with the
 * author-specific noise list.
 *
 * Splitting on \p{L}\p{N} rather than [a-z0-9] keeps NON-LATIN tokens intact.
 * That matters because OL records routinely carry the native form alongside the
 * transliteration ("Петров, Константин Павлович" next to "K. P. Petrov"), so a
 * Cyrillic display_name can be matched in its OWN script instead of being
 * punted as unverifiable. Cross-script pairs are handled by the script gate in
 * matchNames(), not here.
 */
export function nameTokens(s: string): string[] {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 1 && !NAME_NOISE.has(t))
}

/**
 * Writing system of a token. Comparing tokens across scripts is meaningless —
 * "残雪" and "Can Xue" are the same author with zero shared characters — so the
 * matcher only ever compares tokens that share a script, and declares the pair
 * UNVERIFIABLE when no script is common to both sides.
 */
export type Script = 'latin' | 'cyrillic' | 'greek' | 'han' | 'kana' | 'hangul' | 'arabic' | 'hebrew' | 'other'

function scriptOf(token: string): Script {
  if (/\p{Script=Latin}/u.test(token)) return 'latin'
  if (/\p{Script=Cyrillic}/u.test(token)) return 'cyrillic'
  if (/\p{Script=Greek}/u.test(token)) return 'greek'
  if (/\p{Script=Han}/u.test(token)) return 'han'
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(token)) return 'kana'
  if (/\p{Script=Hangul}/u.test(token)) return 'hangul'
  if (/\p{Script=Arabic}/u.test(token)) return 'arabic'
  if (/\p{Script=Hebrew}/u.test(token)) return 'hebrew'
  return 'other'
}

function scriptsOf(tokens: string[]): Set<Script> {
  return new Set(tokens.map(scriptOf))
}

/**
 * The surname token of a name, handling the two forms OL mixes freely:
 *   "Alex London"   → london   (last significant token)
 *   "London, Alex"  → london   (last token BEFORE the comma)
 * Parentheticals ("(pseud.)", "(1912-1990)") are dropped first. `only`
 * restricts the answer to the given scripts, so a mixed-script record yields
 * the surname of the script actually being compared. Returns null when nothing
 * usable survives (all-initials name, or no token in the wanted script).
 */
export function surnameOf(name: string, only?: Set<Script>): string | null {
  const keep = (toks: string[]) => (only ? toks.filter((t) => only.has(scriptOf(t))) : toks)
  const cleaned = name.replace(/\([^)]*\)/g, ' ')
  const head = cleaned.includes(',') ? cleaned.split(',')[0] : cleaned
  const toks = keep(nameTokens(head))
  if (toks.length > 0) return toks[toks.length - 1]
  // Inverted record whose surname half was pure noise ("de, Jean") — fall back
  // to the whole string rather than declaring the name unusable.
  const all = keep(nameTokens(cleaned))
  return all.length > 0 ? all[all.length - 1] : null
}

/**
 * A single OL "name" string sometimes names SEVERAL people. `alternate_names`
 * is full of anthology bylines and credit lines:
 *   "Mark Twain, O. Henry , Edgar Allan Poe, Jack London"
 *   "Mark Twain, Josh Billings, Robt. J. Burdette, Alex Sweet and Melville D. Landon"
 *   "and C. M. Bowra (Editors) Anthology. Higham T. F."
 * Such a string cannot verify that a record is one particular person, and it is
 * exactly how OL18319A (Mark Twain, 66 alternate_names, 7406 works) cleared a
 * match for "Alex London": his surname appears in a four-author byline, and the
 * pen-name containment rule below scans the whole variant. Both of those
 * bylines are Twain anthologies, not aliases — so they are dropped as identity
 * evidence entirely.
 *
 * Rules, cheapest first:
 *   • ≥2 commas — a legitimate inverted "Surname, First" record has exactly one;
 *   • an `&` or `;` — never punctuation inside one person's name;
 *   • a credit word ("and", "eds", "edited", "anthology", "et al", …). Bare
 *     "ed" is deliberately NOT in the list: "Ed" is a given name;
 *   • more than MAX_NAME_TOKENS significant tokens — the safety net for a
 *     byline that uses none of the above.
 */
const BYLINE_WORDS =
  /\b(and|with|eds|editor|editors|edited|selected|introduction|foreword|translated|contributor|contributors|anthology|et al)\b/i
const MAX_NAME_TOKENS = 6

export function isMultiPersonByline(variant: string): boolean {
  if ((variant.match(/,/g) ?? []).length >= 2) return true
  if (/[&;]/.test(variant)) return true
  if (BYLINE_WORDS.test(variant)) return true
  return nameTokens(variant).length > MAX_NAME_TOKENS
}

export type MatchResult = {
  verdict: 'OK' | 'NO_NAME_OVERLAP' | 'SURNAME_MISMATCH' | 'UNVERIFIABLE'
  /** The OL variant that matched (or the best-overlapping one when it didn't). */
  matchedOn: string | null
  sharedTokens: string[]
}

/**
 * Compare our display_name against every candidate name variant. A surname
 * agreement on ANY single-person variant clears the row — pen names, maiden
 * names and transliterated alternates are all legitimate ways for the same
 * person to be recorded. Multi-person bylines are skipped, and when EVERY
 * variant is a byline (or cross-script) the result is UNVERIFIABLE rather than
 * a guess.
 */
export function matchNames(ourName: string, olVariants: string[]): MatchResult {
  const ourAll = nameTokens(ourName)
  const ourScripts = scriptsOf(ourAll)
  const variants = olVariants.map((v) => v.trim()).filter((v) => v.length > 0)

  // An all-initials display_name ("F. M. T. C") leaves nothing to compare.
  if (ourAll.length === 0) {
    return { verdict: 'UNVERIFIABLE', matchedOn: variants[0] ?? null, sharedTokens: [] }
  }

  let best: { shared: string[]; variant: string } | null = null
  let judgedAny = false

  for (const variant of variants) {
    // A multi-person byline is not evidence about any one person — see above.
    if (isMultiPersonByline(variant)) continue
    const theirAll = nameTokens(variant)
    if (theirAll.length === 0) continue
    // Compare only in scripts both sides actually use; skip the variant when
    // there is no shared script (a Latin transliteration next to a CJK name).
    const shared_scripts = new Set([...scriptsOf(theirAll)].filter((sc) => ourScripts.has(sc)))
    if (shared_scripts.size === 0) continue
    judgedAny = true

    const ourToks = ourAll.filter((t) => shared_scripts.has(scriptOf(t)))
    const theirToks = theirAll.filter((t) => shared_scripts.has(scriptOf(t)))
    const ourSet = new Set(ourToks)
    const theirSet = new Set(theirToks)
    const ourSurname = surnameOf(ourName, shared_scripts)
    const theirSurname = surnameOf(variant, shared_scripts)
    const shared = ourToks.filter((t) => theirSet.has(t))

    const surnameAgrees =
      !!ourSurname &&
      !!theirSurname &&
      (ourSurname === theirSurname || theirSet.has(ourSurname) || ourSet.has(theirSurname))

    if (surnameAgrees) return { verdict: 'OK', matchedOn: variant, sharedTokens: shared }
    if (!best || shared.length > best.shared.length) best = { shared, variant }
  }

  // Every variant was cross-script: we cannot characterise the match, so we
  // refuse to judge rather than guess (title-match.ts doctrine).
  if (!judgedAny || !best) {
    return { verdict: 'UNVERIFIABLE', matchedOn: variants[0] ?? null, sharedTokens: [] }
  }

  return best.shared.length > 0
    ? { verdict: 'SURNAME_MISMATCH', matchedOn: best.variant, sharedTokens: best.shared }
    : { verdict: 'NO_NAME_OVERLAP', matchedOn: best.variant, sharedTokens: [] }
}

/**
 * Convenience for callers that only need a yes/no: true ONLY on a positive
 * surname agreement. UNVERIFIABLE (cross-script or all-initials) counts as NO
 * — an unverifiable identity is exactly the case where a wrong photo slips in.
 */
export function namesAgree(ourName: string, candidateNames: Array<string | undefined | null>): boolean {
  const variants = candidateNames.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (variants.length === 0) return false
  return matchNames(ourName, variants).verdict === 'OK'
}
