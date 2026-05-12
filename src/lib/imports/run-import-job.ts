// Pipeline orchestrator: drives one import_jobs row through every phase.
//
//   pending -> fetched -> archived -> extracted -> verified -> gated -> committed
//
// Each phase persists its output back to the job row (raw_html, archive_url,
// extraction, verification, gate_decision) and advances current_phase before
// the next phase runs. If the process crashes mid-phase, a subsequent call
// to runImportJob(id) checks current_phase and resumes from the next phase,
// skipping anything already persisted.
//
// Errors propagate out after the job is marked status='failed' with the
// error message and attempts incremented. The orchestrator does not retry
// internally — operator (or a future scheduler) decides when to re-invoke.
//
// One job per invocation. No parallel batch handling.

import { adminClient } from '../supabase'
import { extractBothPasses } from './llm-extraction'
import { fetchSource } from './fetcher'
import { archiveUrl } from './archiver'
import { normalizeExtraction } from './normalize-extraction'
import { verifyExtraction } from './verifier'
import { evaluateGate } from './gate'
import { commitJob } from './committer'
import { getSourceConfig, type SourceConfig } from './source-registry'
import type { ExtractionResult } from './extraction-types'
import type { VerificationResult } from './verifier'
import type { GateDecision } from './gate'
import type { ArchiveResult } from './archiver'
import type { FetchResult } from './fetcher'

const PHASE_ORDER = [
  'fetched',
  'archived',
  'extracted',
  'verified',
  'gated',
  'committed',
] as const
type Phase = (typeof PHASE_ORDER)[number]

function phaseRank(phase: string | null): number {
  if (phase === null) return -1
  const idx = PHASE_ORDER.indexOf(phase as Phase)
  return idx === -1 ? -1 : idx
}

function shouldRun(currentPhase: string | null, target: Phase): boolean {
  return phaseRank(currentPhase) < PHASE_ORDER.indexOf(target)
}

type ImportJob = {
  id: number
  source_url: string
  source_type: string
  tier: 'high-volume' | 'high-stakes'
  status: string
  current_phase: string | null
  raw_html: string | null
  archive_url: string | null
  archive_service: string | null
  extraction: ExtractionResult | null
  verification: VerificationResult | null
  gate_decision: GateDecision | null
  attempts: number
}

export async function runImportJob(jobId: number): Promise<void> {
  const sb = adminClient()
  const job = await loadJob(sb, jobId)
  const sourceConfig = getSourceConfig(job.source_type)

  // In-memory passing of redirect_count: not persisted on the job row, so on
  // a fresh resume after the fetched phase the verifier sees 0. Acceptable
  // for Sprint A (resume from crash is not a hard requirement).
  let redirectCount = 0

  // 1. fetched
  let fetched: FetchResult | null = null
  if (shouldRun(job.current_phase, 'fetched')) {
    fetched = await runPhase(sb, job, 'fetching', 'fetched', async () => {
      const result = await fetchSource(job.source_url)
      if (result.html === null) {
        throw new Error(`fetcher: status ${result.status} for ${job.source_url}`)
      }
      await sb
        .from('import_jobs')
        .update({ raw_html: result.html, updated_at: new Date().toISOString() })
        .eq('id', job.id)
      return result
    })
    redirectCount = fetched.redirect_count
  } else if (job.raw_html === null) {
    throw new Error(`runImportJob: job ${job.id} past 'fetched' but raw_html is null`)
  }

  // 2. archived
  let archiveResult: ArchiveResult | null = null
  if (shouldRun(job.current_phase, 'archived')) {
    archiveResult = await runPhase(sb, job, 'fetching', 'archived', async () => {
      const result = await archiveUrl(job.source_url, job.source_type)
      await sb
        .from('import_jobs')
        .update({
          archive_url: result.archive_url,
          archive_service: result.archive_service,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      return result
    })
  } else {
    archiveResult = {
      status: job.archive_url ? 'archived' : 'failed',
      archive_url: job.archive_url,
      archive_service: (job.archive_service as 'wayback' | 'archive_today' | null) ?? null,
      attempted_services: [],
      error: null,
    }
  }

  // 3. extracted
  let extraction: ExtractionResult
  if (shouldRun(job.current_phase, 'extracted')) {
    extraction = await runPhase(sb, job, 'extracting', 'extracted', async () => {
      const html = await loadRawHtml(sb, job.id)
      const cleaned = cleanHtml(html)
      const bothPasses = await extractBothPasses(cleaned, sourceConfig.tier)
      const result = normalizeExtraction(bothPasses, sourceConfig)
      await sb
        .from('import_jobs')
        .update({
          extraction: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      return result
    })
  } else {
    if (job.extraction === null) {
      throw new Error(`runImportJob: job ${job.id} past 'extracted' but extraction is null`)
    }
    extraction = job.extraction
  }

  // 4. verified
  let verification: VerificationResult
  if (shouldRun(job.current_phase, 'verified')) {
    verification = await runPhase(sb, job, 'verifying', 'verified', async () => {
      const result = await verifyExtraction(extraction, sourceConfig, redirectCount)
      await sb
        .from('import_jobs')
        .update({
          verification: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      return result
    })
  } else {
    if (job.verification === null) {
      throw new Error(`runImportJob: job ${job.id} past 'verified' but verification is null`)
    }
    verification = job.verification
  }

  // 5. gated
  let decision: GateDecision
  if (shouldRun(job.current_phase, 'gated')) {
    decision = await runPhase(sb, job, 'gated', 'gated', async () => {
      const result = evaluateGate(extraction, verification, sourceConfig)
      await sb
        .from('import_jobs')
        .update({
          gate_decision: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      return result
    })
  } else {
    if (job.gate_decision === null) {
      throw new Error(`runImportJob: job ${job.id} past 'gated' but gate_decision is null`)
    }
    decision = job.gate_decision
  }

  // 6. committed (committer flips status itself; we just mark current_phase)
  if (shouldRun(job.current_phase, 'committed')) {
    await runPhase(sb, job, 'gated', 'committed', async () => {
      await commitJob({
        jobId: job.id,
        sourceType: job.source_type,
        sourceUrl: job.source_url,
        sourceConfig,
        extraction,
        verification,
        archiveResult,
        decision,
      })
      return null
    })
  }
}

// ----------------------------------------------------------------------------
// Phase runner
// ----------------------------------------------------------------------------

type Sb = ReturnType<typeof adminClient>

async function runPhase<T>(
  sb: Sb,
  job: ImportJob,
  enteringStatus: string,
  phase: Phase,
  body: () => Promise<T>,
): Promise<T> {
  await sb
    .from('import_jobs')
    .update({ status: enteringStatus, updated_at: new Date().toISOString() })
    .eq('id', job.id)

  try {
    const out = await body()
    await sb
      .from('import_jobs')
      .update({ current_phase: phase, updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return out
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await sb
      .from('import_jobs')
      .update({
        status: 'failed',
        error: `${phase}: ${message}`,
        attempts: job.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    throw err
  }
}

// ----------------------------------------------------------------------------
// DB helpers
// ----------------------------------------------------------------------------

async function loadJob(sb: Sb, jobId: number): Promise<ImportJob> {
  const { data, error } = await sb
    .from('import_jobs')
    .select(
      'id, source_url, source_type, tier, status, current_phase, ' +
        'raw_html, archive_url, archive_service, extraction, verification, gate_decision, attempts',
    )
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`runImportJob: load failed: ${error.message}`)
  if (!data) throw new Error(`runImportJob: job ${jobId} not found`)
  return data as unknown as ImportJob
}

async function loadRawHtml(sb: Sb, jobId: number): Promise<string> {
  const { data, error } = await sb
    .from('import_jobs')
    .select('raw_html')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`runImportJob: raw_html reload failed: ${error.message}`)
  if (!data?.raw_html) throw new Error(`runImportJob: raw_html missing for job ${jobId}`)
  return data.raw_html as string
}

// ----------------------------------------------------------------------------
// html-clean helper (inline per Taak 3 spec)
// ----------------------------------------------------------------------------

// Strips script/style/nav/footer blocks and collapses whitespace. Output is
// fed directly to the LLM extractor; we don't try to preserve structure.
// Not a full HTML parser — the LLM is robust to tag remnants and the cost of
// pulling in a parser library is not justified for Sprint A.
export function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Used by SOURCE_REGISTRY consumers. Re-exported for tests.
export type { SourceConfig }
