/**
 * Enrich book descriptions in two passes:
 *
 *   Part A — Fix truncated descriptions (ends without sentence-final punctuation)
 *             Source: OL works API → OL search → Google Books
 *
 *   Part B — Fill completely missing descriptions (description_book IS NULL)
 *             Source: OL search → Google Books → GPT-4o-mini fallback
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts
 *     → dry-run: shows counts and up to 3 samples per part, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply
 *     → writes to description_book; sets ai_drafted=true when GPT is used
 *
 * Core logic lives in src/lib/enrich/descriptions.ts so /api/admin/enrich/run
 * can call it in-process from the UI.
 */

import { enrichDescriptions } from '../src/lib/enrich/descriptions'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`\n── enrich-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const result = await enrichDescriptions({
    apply: APPLY,
    onProgress: msg => console.log(msg),
  })

  console.log(`\n── Summary ──`)
  console.log(`Part A (repair): updated=${result.partA.updated} skipped=${result.partA.skipped}`)
  console.log(`Part B (fill):   OL=${result.partB.ol} GB=${result.partB.gb} GPT=${result.partB.gpt} skipped=${result.partB.skipped}`)
  console.log(`Errors:          ${result.errors}`)
  if (!APPLY) console.log(`\nDRY-RUN — re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
