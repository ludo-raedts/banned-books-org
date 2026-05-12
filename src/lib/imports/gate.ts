// Auto-approve gate: pure-function decision over a normalized extraction +
// its verification result + the source config. Returns the decision and the
// list of clauses that drove it (for audit / review-queue context).
//
// Conjunction (ALL must hold for auto_approve):
//   1. agreement_classification === 'full'                       (LLM passes agree)
//   2. Latin script (or null = no script-specific concern)       (no transliteration ambiguity)
//   3. !non_latin_disagreement                                   (Sprint-0.5 doctrine)
//   4. sourceConfig.tier !== 'high-stakes'                       (legal/governmental sources always queue)
//   5. all dimensions are 'exact' or 'no_match'                  (no fuzzy ambiguity)
//   6. !duplicate_author_collision                               (known author duplicates require admin merge)
//   7. !redirect_chain_excessive                                 (suspiciously many hops -> link rot or trap)
//
// Pure: no DB, no IO. Unit-testable in isolation.

import type { ExtractionResult } from './extraction-types'
import type { VerificationResult, DimensionMatch } from './verifier'
import type { SourceConfig } from './source-registry'

export type GateDecision = {
  auto_approve: boolean
  reasons: string[]
}

export function evaluateGate(
  extraction: ExtractionResult,
  verification: VerificationResult,
  sourceConfig: SourceConfig,
): GateDecision {
  const reasons: string[] = []

  if (!extraction.is_book) {
    reasons.push('not_a_book')
  }
  if (extraction.agreement_classification !== 'full') {
    reasons.push(`agreement=${extraction.agreement_classification}`)
  }
  if (!isLatinScript(extraction.script)) {
    reasons.push(`script=${extraction.script ?? 'null'}`)
  }
  if (extraction.non_latin_disagreement) {
    reasons.push('non_latin_disagreement')
  }
  if (sourceConfig.tier === 'high-stakes') {
    reasons.push('tier=high-stakes')
  }
  if (!allDimensionsAreExactOrNoMatch(verification)) {
    reasons.push('fuzzy_dimension_present')
  }
  if (verification.duplicate_author_collision) {
    reasons.push('duplicate_author_collision')
  }
  if (verification.redirect_chain_excessive) {
    reasons.push('redirect_chain_excessive')
  }

  return {
    auto_approve: reasons.length === 0,
    reasons,
  }
}

function isLatinScript(script: ExtractionResult['script']): boolean {
  return script === 'latin' || script === null
}

function isExactOrNoMatch(d: DimensionMatch): boolean {
  return d.status === 'exact' || d.status === 'no_match'
}

function allDimensionsAreExactOrNoMatch(v: VerificationResult): boolean {
  if (!isExactOrNoMatch(v.book)) return false
  if (!isExactOrNoMatch(v.country)) return false
  for (const a of v.authors) if (!isExactOrNoMatch(a)) return false
  for (const r of v.reasons) if (!isExactOrNoMatch(r)) return false
  return true
}
