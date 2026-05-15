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
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --slug=<slug>
 *     → re-enrich a single book regardless of existing description_book
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --overwrite --limit=50
 *     → re-enrich all books, overwriting existing description_book
 *
 * Core logic lives in src/lib/enrich/descriptions.ts so /api/admin/enrich/run
 * can call it in-process from the UI.
 */

import { enrichDescriptions } from '../src/lib/enrich/descriptions'

const APPLY     = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const slugArg   = process.argv.find(a => a.startsWith('--slug='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
const SLUG      = slugArg?.split('=')[1] ?? undefined

async function main() {
  console.log(`\n── enrich-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (SLUG)      console.log(`  --slug=${SLUG} (single book, overwrites existing)`)
  if (OVERWRITE) console.log(`  --overwrite: replacing existing description_book too`)
  if (LIMIT)     console.log(`  --limit=${LIMIT}`)
  console.log()

  const result = await enrichDescriptions({
    apply: APPLY,
    limit: LIMIT,
    overwrite: OVERWRITE,
    slug: SLUG,
    onProgress: msg => console.log(msg),
  })

  console.log(`\n── Summary ──`)
  console.log(`Part A (repair): updated=${result.partA.updated} skipped=${result.partA.skipped}`)
  console.log(`Part B (fill):   OL=${result.partB.ol} GB=${result.partB.gb} GPT=${result.partB.gpt} skipped=${result.partB.skipped}`)
  console.log(`Errors:          ${result.errors}`)
  if (!APPLY) console.log(`\nDRY-RUN — re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
