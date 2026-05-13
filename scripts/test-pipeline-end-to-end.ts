#!/usr/bin/env tsx
/**
 * End-to-end smoke test for the Sprint A import pipeline.
 *
 * Creates one import_jobs row, invokes runImportJob, and prints the final
 * job state plus the matching import_review_queue row (if any).
 *
 * Pass --url=<url> and --source-type=<type> to drive a real run. Default
 * source_type is 'manual' so the script works against any URL without
 * implicitly opting into a high-stakes tier.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/test-pipeline-end-to-end.ts \
 *     --url=https://fr.wikipedia.org/wiki/Suicide,_mode_d%27emploi
 *   pnpm tsx --env-file=.env.local scripts/test-pipeline-end-to-end.ts \
 *     --url=https://pen.org/some-page --source-type=pen_america
 *
 * Acceptance per Taak 3 spec: one URL goes through every phase and ends in
 * 'committed' OR 'queued' without error.
 */
import { adminClient } from '../src/lib/supabase'
import { runImportJob } from '../src/lib/imports/run-import-job'
import { getSourceConfig } from '../src/lib/imports/source-registry'

const DEFAULT_URL = 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000123456'
const DEFAULT_SOURCE_TYPE = 'manual'

function parseArgs(): { url: string; sourceType: string } {
  const argv = process.argv.slice(2)
  let url = DEFAULT_URL
  let sourceType = DEFAULT_SOURCE_TYPE
  for (const arg of argv) {
    if (arg.startsWith('--url=')) url = arg.slice('--url='.length)
    else if (arg.startsWith('--source-type=')) sourceType = arg.slice('--source-type='.length)
  }
  return { url, sourceType }
}

async function main() {
  const { url, sourceType } = parseArgs()
  const sourceConfig = getSourceConfig(sourceType)
  const sb = adminClient()

  console.log(`[setup] url=${url}`)
  console.log(`[setup] source_type=${sourceType} (tier=${sourceConfig.tier})`)

  // Always start from a clean slate. Three things to purge:
  //   1. import_jobs row for this source_url (UNIQUE constraint blocks insert).
  //   2. its referenced import_review_queue row (FK is on delete set null,
  //      but we want it gone so we read fresh data at the end).
  //   3. any orphan import_review_queue rows for this source_url (older runs
  //      may have left rows whose originating jobs are already deleted).
  await sb.from('import_review_queue').delete().eq('source_url', url)
  const { data: existing } = await sb
    .from('import_jobs')
    .select('id')
    .eq('source_url', url)
    .maybeSingle()
  if (existing) {
    console.log(`[setup] purging stale job id=${existing.id}`)
    await sb.from('import_jobs').delete().eq('id', existing.id)
  }

  const { data, error } = await sb
    .from('import_jobs')
    .insert({
      source_url: url,
      source_type: sourceType,
      tier: sourceConfig.tier,
    })
    .select('id')
    .single()
  if (error) throw new Error(`failed to create job: ${error.message}`)
  const jobId = data.id as number
  console.log(`[setup] created job id=${jobId}`)

  console.log(`\n[run] invoking runImportJob(${jobId})...`)
  try {
    await runImportJob(jobId)
    console.log(`[run] completed without throwing`)
  } catch (err) {
    console.error(`[run] threw: ${(err as Error).message}`)
  }

  // Final state
  const { data: finalJob } = await sb
    .from('import_jobs')
    .select(
      'id, status, current_phase, archive_url, archive_service, error, attempts, ' +
        'review_row_id, committed_at, updated_at',
    )
    .eq('id', jobId)
    .single()

  console.log('\n[final] import_jobs row:')
  console.log(JSON.stringify(finalJob, null, 2))

  if (finalJob?.review_row_id) {
    const { data: reviewRow } = await sb
      .from('import_review_queue')
      .select(
        'id, source_slug, source_url, pass_a_provider, pass_b_provider, ' +
          'pass_a_output, pass_b_output, agreement_class, agreement_details, ' +
          'status, created_at',
      )
      .eq('id', finalJob.review_row_id)
      .single()
    console.log('\n[final] import_review_queue row:')
    console.log(JSON.stringify(reviewRow, null, 2))
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
