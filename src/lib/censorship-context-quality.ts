/**
 * Quality classifiers for the two LLM-written ban-narrative fields:
 *
 *   books.censorship_context  ("Censorship history" — long, 4–7 sentences)
 *   books.description_ban     ("Why it was banned"  — short, 1–3 sentences)
 *
 * The 2026-05-29 audit wiped 4,602 censorship_context rows whose text
 * was LLM-padded prose without a verifiable anchor — invented school
 * districts, fabricated parent-teacher complaints, generic "broader
 * trend" framing. Two stable signals emerged:
 *
 *   1. GROUNDED text reliably contains at least one named law/bill,
 *      court case, statute, oversight body, or specific quantitative
 *      claim.
 *   2. HALLUCINATED text reliably contains LLM-padding phrases ("this
 *      reflects", "broader trend", "parent-teacher associations",
 *      etc.) and no such anchor.
 *
 * The two fields have DIFFERENT acceptance thresholds:
 *
 *   censorship_context (long)  →  require positive anchor (GROUNDED)
 *     Long narrative space invites LLM padding. Require evidence of
 *     real-world referents to publish. False negatives are recoverable
 *     by human curation; false positives publish hallucinations.
 *
 *   description_ban (short)    →  reject only on tells (not on anchor)
 *     Short summaries of structured ban-data are LEGITIMATELY generic
 *     ("Removed in U.S. schools for LGBTQ+ content"). Requiring an
 *     anchor would over-reject paraphrases of PEN data. But the same
 *     LLM-padding tells are equally invalid in short text — there is
 *     no place for "broader trend" framing in a one-sentence summary
 *     of a single ban event.
 *
 * Pre-write gate usage (any script generating either field MUST call
 * its respective gate and refuse to persist text that fails):
 *   censorshipContextQualityGate(text) → for books.censorship_context
 *   descriptionBanQualityGate(text)    → for books.description_ban
 */

// ── GROUNDED anchors ────────────────────────────────────────────────────
// Each regex must match something specific and verifiable. False positives
// here mean a hallucination passes the gate.

export const LAW_NUMBER_RE = /\b(?:HB|H\.?B\.?|SB|S\.?B\.?|SF|S\.?F\.?|AB|A\.?B\.?)[\s.]?\d{1,5}\b|\bHouse Bill \d{1,5}\b|\bSenate Bill \d{1,5}\b|\bSenate File \d{1,5}\b|\bAssembly Bill \d{1,5}\b|\bPublic Law \d{1,3}-\d{1,3}\b/

export const NAMED_LAW_RE = /\b(?:National Security Law|Comstock Act|Obscene Publications Act|Hicklin (?:test|rule)|Patriot Act|Hays Code|Production Code|Printing Presses and Publications Act|Anti-Subversion|Sedition Act|Indian Press Act|Espionage Act|Smith Act|Internal Security Act|Customs Act|Penal Code \d+|Criminal Code|Strafgesetzbuch|§\s?\d{2,3}\s?StGB|Decree(?:-Law)? \d+|Federal Law on the Protection of Minors|Index Librorum Prohibitorum|Index of Forbidden Books|War Precautions Act)\b/

export const COURT_CASE_RE = /\b(?:R v\.|R\. v\.|Reg(?:ina)? v\.|Crown v\.|United States v\.|U\.S\. v\.|People v\.|Commonwealth v\.|Roth v\.|Miller v\.|Stanley v\.|Brandenburg v\.|Tinker v\.|Island Trees v\.|Pico v\.|Penguin (?:Books )?(?:trial|case)|Lady Chatterley'?s? trial|Howl trial|Ulysses (?:trial|case|decision)|fatwa\b|Rushdie affair)/i

export const NAMED_ORG_RE = /\b(?:PEN America|American Library Association(?:'s)? Office for Intellectual Freedom|ALA Office for Intellectual Freedom|National Coalition Against Censorship|NCAC|EveryLibrary|Moms for Liberty|Florida Freedom to Read Project|Index on Censorship|Article 19|Reporters Without Borders|Human Rights Watch|Amnesty International|ACLU|American Civil Liberties Union)\b/

// "X books / titles / works" with X >= 10 — small numbers are too easy to invent.
export const QUANT_CLAIM_RE = /\b\d{2,5}\s+(?:books|titles|works|publications|volumes)\b/

export const NAMED_BODY_RE = /\b(?:Instructional Materials Review Committee|Board of Indian Communications|Lord Chamberlain'?s? Office|Office of Censorship|Federal Communications Commission|Ministry of Information and Broadcasting|Cyberspace Administration of China|General Administration of Press and Publication|Federal Department for Media Harmful to Young Persons|Bundesprüfstelle)\b/

const GROUNDED_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'law-number', re: LAW_NUMBER_RE },
  { name: 'named-law',  re: NAMED_LAW_RE },
  { name: 'court-case', re: COURT_CASE_RE },
  { name: 'named-org',  re: NAMED_ORG_RE },
  { name: 'quant-claim', re: QUANT_CLAIM_RE },
  { name: 'named-body', re: NAMED_BODY_RE },
]

export function groundedSignals(text: string): string[] {
  const out: string[] = []
  for (const { name, re } of GROUNDED_PATTERNS) if (re.test(text)) out.push(name)
  return out
}

// ── HALLUCINATION tells ─────────────────────────────────────────────────
// Phrases that almost never appear in grounded reporting and very often
// appear in LLM-padded ban summaries.

export const HALLUCINATION_TELLS: RegExp[] = [
  /\bbroader trend\b/i,
  /\bbroader effort\b/i,
  /\bthis (?:case )?reflects\b/i,
  /\bthis (?:case )?illustrates\b/i,
  /\bthis action reflects\b/i,
  /\bongoing debates? (?:about|over|surrounding)\b/i,
  /\btensions surrounding\b/i,
  /\bleading to (?:a |an )?(?:heated |contentious |formal )?(?:school board meeting|discussions)\b/i,
  /\bparent-teacher associations?\b/i,
  /\bconservative advocacy groups?\b/i,
  /\b(?:local )?advocacy groups?\s+(?:concerned|argued|voiced)\b/i,
  /\bdeemed (?:inappropriate|immoral|sensitive|controversial)\b/i,
  /\b(?:as of (?:May|June|July|August|September|October|November|December)? ?20\d{2}, )?the (?:book'?s? )?(?:status|ban)(?: in [^.]{1,80})? remains (?:unresolved|unclear|contested)\b/i,
  /\b(?:school )?board(?: meetings?| votes?)? (?:in|across) (?:various|multiple|several) (?:school )?districts?\b/i,
  /\bvoted to remove the book\b/i,
  /\bcomplaints? from (?:local |concerned )?parents?\b/i,
  /\bdeemed (?:inappropriate|unsuitable|harmful) for (?:students|young readers|the classroom)\b/i,
]

export function hallucinationTells(text: string): string[] {
  const out: string[] = []
  for (const re of HALLUCINATION_TELLS) {
    const m = text.match(re)
    if (m) out.push(m[0].slice(0, 50))
  }
  return out
}

// ── Classification ──────────────────────────────────────────────────────

export type CensorshipContextBucket = 'GROUNDED' | 'THIN' | 'HALLUCINATED'

export interface CensorshipContextClassification {
  bucket: CensorshipContextBucket
  signals: string[]
  tells: string[]
  reasoning: string
}

export function classifyCensorshipContext(text: string): CensorshipContextClassification {
  const signals = groundedSignals(text)
  const tells = hallucinationTells(text)
  if (signals.length > 0) {
    return { bucket: 'GROUNDED', signals, tells, reasoning: `signals: ${signals.join(', ')}` }
  }
  if (tells.length > 0) {
    return { bucket: 'HALLUCINATED', signals, tells, reasoning: `tells: ${tells.slice(0, 3).join(' | ')}` }
  }
  return { bucket: 'THIN', signals, tells, reasoning: `no signals, no tells (len=${text.length})` }
}

// ── Write-gate ──────────────────────────────────────────────────────────
// What enrichment scripts should use. Conservative by design: only GROUNDED
// passes. THIN cases (no anchor, no tell — could be real narrow content the
// regexes miss) are also rejected at write-time so hallucinations cannot
// sneak in disguised as restrained prose. False negatives here are
// recoverable via human curation; false positives publish lies on the site.

export interface QualityGateResult {
  accept: boolean
  bucket: string
  reasoning: string
  signals: string[]
  tells: string[]
}

export function censorshipContextQualityGate(text: string): QualityGateResult {
  const cls = classifyCensorshipContext(text)
  return {
    accept: cls.bucket === 'GROUNDED',
    bucket: cls.bucket,
    reasoning: cls.reasoning,
    signals: cls.signals,
    tells: cls.tells,
  }
}

// ── description_ban gate ────────────────────────────────────────────────
// Short-field gate. The 4 LLM writers for description_ban
// (autofill-ban-descriptions, enrich-ban-descriptions-gpt,
// rewrite-descriptions-grounded, rewrite-weak-descriptions) all feed the
// model structured ban-data and ask for 1–3 sentences. Hallucination here
// looks different from censorship_context: not pages of "broader trend"
// boilerplate, but spot fabrications — a made-up school district, an
// invented parent complaint, a reason not in the data.
//
// We CANNOT verify whether "Maplewood School District" is real from the
// text alone, but we CAN reject the LLM-padding phrases that almost always
// accompany such fabrications. Plus a length sanity check (the existing
// writers already filter out <60-char responses; we mirror that).

const DESCRIPTION_BAN_MIN_LEN = 40

// Additional tells specific to description_ban. The fields don't all
// overlap with the censorship_context tells, but these are phrases the
// gpt-4o-mini / claude-haiku writers produce when bluffing about
// challenges they have no source for in the structured ban data.
export const DESCRIPTION_BAN_TELLS: RegExp[] = [
  /\baccording to (?:available )?records?\b/i,
  /\bbased on available data\b/i,
  /\bdocumented in available (?:records?|data)\b/i,
  /\bthe (?:ban|book'?s? status) (?:has been|is) (?:widely )?reported\b/i,
  /\b(?:has been|is) part of a (?:broader |wider |larger )?(?:movement|effort|pattern|trend|wave)\b/i,
  /\b(?:reflecting|reflects) (?:the |a )?(?:broader|wider|growing|ongoing) (?:concern|debate|trend|pattern|movement)\b/i,
]

export function descriptionBanTells(text: string): string[] {
  const out: string[] = []
  for (const re of DESCRIPTION_BAN_TELLS) {
    const m = text.match(re)
    if (m) out.push(m[0].slice(0, 50))
  }
  return out
}

export type DescriptionBanBucket = 'CLEAN' | 'HAS_TELL' | 'TOO_SHORT'

export interface DescriptionBanClassification {
  bucket: DescriptionBanBucket
  tells: string[]
  reasoning: string
}

export function classifyDescriptionBan(text: string): DescriptionBanClassification {
  const trimmed = text.trim()
  if (trimmed.length < DESCRIPTION_BAN_MIN_LEN) {
    return {
      bucket: 'TOO_SHORT',
      tells: [],
      reasoning: `length ${trimmed.length} < ${DESCRIPTION_BAN_MIN_LEN}`,
    }
  }
  // Reuse the censorship-context tells (broader trend, this reflects,
  // parent-teacher associations, etc.) AND the description-specific ones.
  const sharedTells = hallucinationTells(trimmed)
  const ownTells    = descriptionBanTells(trimmed)
  const allTells    = [...sharedTells, ...ownTells]
  if (allTells.length > 0) {
    return {
      bucket: 'HAS_TELL',
      tells: allTells,
      reasoning: `tells: ${allTells.slice(0, 3).join(' | ')}`,
    }
  }
  return { bucket: 'CLEAN', tells: [], reasoning: `clean (len=${trimmed.length})` }
}

export function descriptionBanQualityGate(text: string): QualityGateResult {
  const cls = classifyDescriptionBan(text)
  return {
    accept: cls.bucket === 'CLEAN',
    bucket: cls.bucket,
    reasoning: cls.reasoning,
    signals: [],
    tells: cls.tells,
  }
}
