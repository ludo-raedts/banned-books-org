/**
 * Re-tries books that already failed cover search with improved strategies.
 *
 * Strategies (in order per book):
 *   1. Google Books title-only (no inauthor:) — highest hit rate
 *   2. OL title-only
 *   3. OL stripped-subtitle search
 *   4. Wikipedia page thumbnail
 *
 * Google Books URLs are pHash-checked against the official "image not
 * available" placeholder; matches are rejected and the book is marked
 * cover_status='rejected_placeholder' so future runs skip it.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --force
 *
 * Core logic lives in src/lib/enrich/covers.ts so /api/admin/enrich/run can
 * call it in-process from the UI.
 */

import { enrichCovers } from '../src/lib/enrich/covers'

const APPLY = process.argv.includes('--apply')
const RESET = process.argv.includes('--reset')
const FORCE = process.argv.includes('--force')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

async function main() {
  console.log(`\n── enrich-covers-v2 (${APPLY ? 'APPLY' : 'DRY-RUN'}${FORCE ? ', FORCE' : ''}) ──`)
  console.log(`Strategies: GB title-only → OL title-only → OL stripped → Wikipedia\n`)

  const start = Date.now()
  const result = await enrichCovers({
    apply: APPLY,
    limit: LIMIT,
    reset: RESET,
    force: FORCE,
    onProgress: msg => console.log(msg),
  })
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n── Summary ──`)
  console.log(`Found:                  ${result.found}`)
  Object.entries(result.foundBySource).forEach(([s, n]) => console.log(`  via ${s}: ${n}`))
  console.log(`Rejected (placeholder): ${result.rejectedPlaceholder}`)
  console.log(`Still not found:        ${result.stillFailed}`)
  console.log(`Errors:                 ${result.errors}`)
  console.log(`Time:                   ${elapsed}s`)
  if (!APPLY) console.log(`\nDRY-RUN — re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
