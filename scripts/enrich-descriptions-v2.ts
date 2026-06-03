#!/usr/bin/env tsx
/**
 * Second-generation enrichment CLI. Replaces the old enrich-descriptions
 * script for new runs.
 *
 * What's different from v1:
 *   - Multi-source ladder (Wikipedia EN + langlinks, OpenLibrary,
 *     Google Books) with title-fuzz + author-surname validation.
 *   - LLM is OPT-IN via --allow-llm and only synthesises from cited
 *     source extracts (never from training knowledge alone).
 *   - Records description_source_url and description_source_type so the
 *     UI can show provenance.
 *   - data_quality_status:
 *       - confident = literal extract OR multi-source LLM synthesis
 *       - default   = single-source LLM paraphrase OR literal single-source
 *       - flagged   = no source resolved (description_book stays NULL)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts
 *     → dry-run, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply
 *     → writes literal source extracts; flags rows with no source
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm
 *     → enables grounded LLM synthesis for multi-source rows and non-English
 *       single-source paraphrase. ~$0.001/book worst case.
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --process-flagged
 *     → ALSO re-attempts rows previously flagged by the judge (recommended
 *       after the judge run completes).
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --reground-ungrounded
 *     → DRY-RUN over ISBN rows whose synopsis has no tracked source (pre-v2
 *       ungrounded text). With --apply: overwrites them with OpenLibrary-by-ISBN
 *       sourced text + provenance, backing up originals to
 *       data/description-book-reground-backup-<ts>.csv. Rows where no verified
 *       source resolves keep their existing text untouched.
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --slug=foo
 *     → single book (bypasses all filters)
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --overwrite --limit=50
 *     → overwrite existing descriptions on the first 50 books
 *
 * Other flags:
 *   --limit=N
 */

import { enrichDescriptionsV2 } from '../src/lib/enrich/descriptions-v2'

const APPLY            = process.argv.includes('--apply')
const OVERWRITE        = process.argv.includes('--overwrite')
const ALLOW_LLM        = process.argv.includes('--allow-llm')
const PROCESS_FLAGGED  = process.argv.includes('--process-flagged')
const REGROUND         = process.argv.includes('--reground-ungrounded')
const limitArg         = process.argv.find(a => a.startsWith('--limit='))
const slugArg          = process.argv.find(a => a.startsWith('--slug='))
const concArg          = process.argv.find(a => a.startsWith('--concurrency='))
const LIMIT            = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
const SLUG             = slugArg?.split('=')[1] ?? undefined
const CONCURRENCY      = concArg ? Math.max(1, parseInt(concArg.split('=')[1])) : 1

async function main() {
  console.log(`\n── enrich-descriptions-v2 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (SLUG)            console.log(`  --slug=${SLUG}`)
  if (OVERWRITE)       console.log(`  --overwrite: replacing existing description_book too`)
  if (PROCESS_FLAGGED) console.log(`  --process-flagged: include rows the judge flagged`)
  if (REGROUND)        console.log(`  --reground-ungrounded: re-source ISBN rows with untracked synopses (overwrite, backed up)`)
  if (ALLOW_LLM)       console.log(`  --allow-llm: grounded LLM synthesis ENABLED`)
  if (LIMIT)           console.log(`  --limit=${LIMIT}`)
  if (CONCURRENCY > 1) console.log(`  --concurrency=${CONCURRENCY}`)
  console.log()

  const r = await enrichDescriptionsV2({
    apply: APPLY,
    limit: LIMIT,
    overwrite: OVERWRITE,
    slug: SLUG,
    allowLlm: ALLOW_LLM,
    processFlagged: PROCESS_FLAGGED,
    regroundUngrounded: REGROUND,
    concurrency: CONCURRENCY,
    onProgress: msg => console.log(msg),
  })

  console.log(`\n── Summary ──`)
  console.log(`Candidates:        ${r.candidates}`)
  console.log(`Processed:         ${r.processed}`)
  console.log(`Filled (literal):  ${r.filled.literal}`)
  console.log(`Filled (LLM x≥2):  ${r.filled.llm_multi}`)
  console.log(`Filled (LLM x1):   ${r.filled.llm_single}`)
  console.log(`Skipped no_source: ${r.skipped.no_source}`)
  console.log(`Errors:            ${r.errors}`)
  console.log(`LLM cost:          $${r.totalCostUsd.toFixed(4)}`)
  if (!APPLY) console.log(`\nDRY-RUN — re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
