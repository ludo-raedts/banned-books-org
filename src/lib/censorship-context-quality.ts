/**
 * Groundedness classifier for `books.censorship_context`.
 *
 * The 2026-05-29 audit (scripts/_audit_keep_narrative_groundedness.ts +
 * scripts/_apply_keep_narrative_groundedness.ts) wiped 4,602 rows whose
 * censorship_context contained LLM-padded prose without a verifiable
 * anchor — invented school districts, fabricated parent-teacher complaints,
 * generic "broader trend" framing. The audit confirmed two stable signals:
 *
 *   1. GROUNDED text reliably contains at least one named law/bill, court
 *      case, statute, oversight body, or specific quantitative claim.
 *   2. HALLUCINATED text reliably contains LLM-padding phrases ("this
 *      reflects", "broader trend", "parent-teacher associations", etc.)
 *      and no such anchor.
 *
 * This module exports those rules so they can be used as BOTH:
 *   - a post-hoc audit (the _audit_keep_narrative_groundedness.ts script)
 *   - a pre-write gate (scripts/enrich-censorship-context-gpt.ts and any
 *     future enrichment script must call classifyCensorshipContext() and
 *     refuse to write anything that is not 'GROUNDED').
 *
 * Updating policy: when widening the grounded regexes, re-run the audit
 * script to confirm THIN bucket size drops without HALLUCINATED dropping
 * too (which would indicate the new pattern matches LLM padding too).
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
  bucket: CensorshipContextBucket
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
