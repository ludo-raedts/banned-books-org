#!/usr/bin/env tsx
// Dry-run analysis of the import_review_queue: which pending rows could be
// auto-approved (or auto-merged) without a human, and what's keeping the rest
// in review?
//
// Read-only. Two shapes of `agreement_details` exist in the queue:
//
//   A. "gated" rows — produced by src/lib/imports/committer.ts (the newer
//      pipeline). `agreement_details.gate` already contains a precomputed
//      { auto_approve, reasons[] }. We just histogram the blocker reasons.
//
//   B. "wikipedia" rows — produced by src/lib/wikipedia/importer.ts (the
//      legacy bulk import path). `agreement_details.gate` is absent; instead
//      we have `reason_mapping.confidence`, `dedup_check.kind`,
//      `quality_flags[]`, plus a partial `source_context`. We derive a
//      gate-equivalent decision in-process.
//
// Output: counts per bucket so the operator can decide which gate to relax.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

// ── Shape definitions ────────────────────────────────────────────────────────

type GateDecision = { auto_approve: boolean; reasons: string[] }

type DimensionMatch = {
  status: 'exact' | 'fuzzy' | 'no_match'
  existing_id?: number | string | null
  confidence?: number | null
}

type VerificationResult = {
  book?: DimensionMatch
  authors?: DimensionMatch[]
  country?: DimensionMatch
  reasons?: DimensionMatch[]
  redirect_chain_excessive?: boolean
  duplicate_author_collision?: boolean
}

type DedupCheck = {
  kind: 'none' | 'duplicate' | 'possible_duplicate' | string
  book_id?: number
  similarity?: number
}

type ReasonMapping = {
  slug?: string | null
  confidence?: 'high' | 'low' | null
}

type AgreementDetails = {
  // New pipeline shape
  gate?: GateDecision
  verification?: VerificationResult
  // Legacy wikipedia shape
  reason_mapping?: ReasonMapping
  dedup_check?: DedupCheck
  quality_flags?: string[]
  source_context?: { country_code?: string | null }
}

type QueueRow = {
  id: number
  source_slug: string
  status: string
  agreement_class: string | null
  agreement_details: AgreementDetails | null
}

// ── Pretty-print helpers ─────────────────────────────────────────────────────

function bar(n: number, total: number, width = 30): string {
  if (total === 0) return ''
  return '█'.repeat(Math.min(width, Math.round((n / total) * width)))
}

function printHistogram(title: string, counts: Map<string, number>, total: number) {
  console.log(`\n${title}`)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, v] of sorted) {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
    console.log(`  ${String(v).padStart(5)}  ${pct.padStart(5)}%  ${bar(v, total)}  ${k}`)
  }
}

// ── Wikipedia-shape gate derivation ──────────────────────────────────────────
// Maps the legacy fields onto a synthetic GateDecision so we can apply the
// same histogram logic across both pipelines.

function deriveWikipediaGate(d: AgreementDetails): GateDecision {
  const reasons: string[] = []

  const rm = d.reason_mapping ?? {}
  if (!rm.slug || rm.slug === 'other') {
    reasons.push('reason_mapping_unmapped')
  } else if (rm.confidence !== 'high') {
    reasons.push(`reason_mapping=${rm.confidence ?? 'null'}`)
  }

  const dedup = d.dedup_check
  if (dedup && dedup.kind !== 'none' && dedup.kind !== 'duplicate') {
    // 'possible_duplicate' (fuzzy match) needs eyes; 'duplicate' is fine — it
    // routes to merge instead of approve. 'none' is also fine.
    reasons.push(`dedup=${dedup.kind}`)
  }

  for (const flag of d.quality_flags ?? []) {
    reasons.push(`flag=${flag}`)
  }

  return { auto_approve: reasons.length === 0, reasons }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  const rows: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, status, agreement_class, agreement_details')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  const pending = rows.filter(r => r.status === 'pending_review')
  console.log(`Total queue rows:           ${rows.length}`)
  console.log(`Pending review:             ${pending.length}`)
  console.log(`Approved / rejected / etc:  ${rows.length - pending.length}`)

  // ── Bucket by pipeline shape ───────────────────────────────────────────────
  const gated: QueueRow[] = []
  const wikipedia: QueueRow[] = []
  const unknown: QueueRow[] = []
  for (const r of pending) {
    const d = r.agreement_details ?? {}
    if (d.gate && Array.isArray(d.gate.reasons)) gated.push(r)
    else if (d.reason_mapping || d.dedup_check || d.quality_flags) wikipedia.push(r)
    else unknown.push(r)
  }

  console.log(`\nPipeline shape breakdown:`)
  console.log(`  gated (new pipeline):     ${gated.length}`)
  console.log(`  wikipedia (legacy):       ${wikipedia.length}`)
  console.log(`  unknown shape:            ${unknown.length}`)

  // ── 1. New-pipeline rows: histogram of gate reasons ────────────────────────
  if (gated.length > 0) {
    const singleReason = new Map<string, number>()
    const reasonCombos = new Map<string, number>()
    let gatedAutoApprove = 0

    for (const r of gated) {
      const reasons = r.agreement_details!.gate!.reasons
      if (reasons.length === 0) {
        gatedAutoApprove++
        continue
      }
      for (const reason of reasons) {
        singleReason.set(reason, (singleReason.get(reason) ?? 0) + 1)
      }
      const combo = [...reasons].sort().join(' + ')
      reasonCombos.set(combo, (reasonCombos.get(combo) ?? 0) + 1)
    }

    console.log(`\n── NEW-PIPELINE rows (${gated.length}) ──`)
    console.log(`  Already passes gate (auto_approve=true but stuck in queue): ${gatedAutoApprove}`)
    printHistogram(
      'Single blocker reasons (a row may appear in multiple rows):',
      singleReason,
      gated.length,
    )
    printHistogram(
      'Top blocker combinations:',
      new Map([...reasonCombos.entries()].slice(0, 15)),
      gated.length,
    )
  }

  // ── 2. Wikipedia-legacy rows: synthetic gate ───────────────────────────────
  if (wikipedia.length > 0) {
    const singleReason = new Map<string, number>()
    const reasonCombos = new Map<string, number>()
    let wikiAutoApprove = 0

    for (const r of wikipedia) {
      const decision = deriveWikipediaGate(r.agreement_details ?? {})
      if (decision.auto_approve) {
        wikiAutoApprove++
        continue
      }
      for (const reason of decision.reasons) {
        singleReason.set(reason, (singleReason.get(reason) ?? 0) + 1)
      }
      const combo = [...decision.reasons].sort().join(' + ')
      reasonCombos.set(combo, (reasonCombos.get(combo) ?? 0) + 1)
    }

    console.log(`\n── WIKIPEDIA-LEGACY rows (${wikipedia.length}) ──`)
    console.log(`  Pass synthetic gate (could auto-approve today): ${wikiAutoApprove}`)
    printHistogram(
      'Single blocker reasons:',
      singleReason,
      wikipedia.length,
    )
    printHistogram(
      'Top blocker combinations:',
      new Map([...reasonCombos.entries()].slice(0, 15)),
      wikipedia.length,
    )
  }

  // ── 3. Merge candidates (Layer 1 from the plan) ────────────────────────────
  //
  // Two ways a row can be a clear merge candidate:
  //   (a) new pipeline: verification.book.status === 'exact' (slug-lookup hit)
  //   (b) legacy: dedup_check.kind === 'duplicate' OR
  //               (kind === 'possible_duplicate' AND similarity >= 0.85)
  let exactBookMatches = 0
  let dedupDuplicate = 0
  let highSimPossible = 0
  let midSimPossible = 0
  for (const r of pending) {
    const d = r.agreement_details ?? {}
    if (d.verification?.book?.status === 'exact') exactBookMatches++
    const dedup = d.dedup_check
    if (dedup?.kind === 'duplicate') dedupDuplicate++
    else if (dedup?.kind === 'possible_duplicate') {
      const sim = dedup.similarity ?? 0
      if (sim >= 0.85) highSimPossible++
      else if (sim >= 0.75) midSimPossible++
    }
  }

  console.log(`\n── MERGE CANDIDATES (Layer 1 — lowest risk) ──`)
  console.log(`  verification.book === 'exact' (new pipeline):     ${exactBookMatches}`)
  console.log(`  dedup_check.kind === 'duplicate' (legacy):        ${dedupDuplicate}`)
  console.log(`  possible_duplicate AND similarity >= 0.85:        ${highSimPossible}`)
  console.log(`  possible_duplicate AND 0.75 <= similarity < 0.85: ${midSimPossible}`)

  // ── 4. By-source breakdown of pending rows ─────────────────────────────────
  const bySource = new Map<string, number>()
  for (const r of pending) {
    bySource.set(r.source_slug, (bySource.get(r.source_slug) ?? 0) + 1)
  }
  console.log(`\n── PENDING ROWS BY SOURCE (top 20) ──`)
  const sortedSources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [src, n] of sortedSources) {
    console.log(`  ${String(n).padStart(5)}  ${src}`)
  }

  // ── 5. Summary recommendation ──────────────────────────────────────────────
  console.log(`\n── SUMMARY ──`)
  console.log(`Total pending: ${pending.length}`)
  console.log(`Likely auto-approvable as-is (Layer 2 strict gate):`)
  console.log(`  - new pipeline already-passing: see "auto_approve=true but stuck" above`)
  console.log(`  - wiki legacy passing synthetic gate: see "Pass synthetic gate" above`)
  console.log(`Likely auto-mergeable (Layer 1):`)
  console.log(`  - exact book match + duplicate kind: ${exactBookMatches + dedupDuplicate}`)
  console.log(`  - high-similarity possibles (>=0.85): ${highSimPossible} (recommend spot-check)`)
}

main().catch(e => { console.error(e); process.exit(1) })
