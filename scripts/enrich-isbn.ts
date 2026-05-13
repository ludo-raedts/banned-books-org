/**
 * Enrich books that are missing isbn13 by querying Open Library and Google Books.
 *
 * Strategy (tried in order per book):
 *   1. Open Library search by title+author  → isbn13 from search results
 *   2. Open Library search by title only    → catches author-name mismatches
 *   3. Google Books API                     → industryIdentifiers[type=ISBN_13]
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts
 *     → dry-run: shows counts and 10 sample results, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
 *     → writes isbn13 to DB
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200
 *     → cap at 200 books per run (useful for staged rollouts)
 *
 * Core logic lives in src/lib/enrich/isbn.ts so the /api/admin/enrich/run
 * route can call it in-process from the UI.
 */

import { enrichIsbn } from '../src/lib/enrich/isbn'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : undefined

async function main() {
  console.log(`\n── enrich-isbn (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const result = await enrichIsbn({
    apply: APPLY,
    limit: MAX,
    onProgress: msg => console.log(msg),
  })

  console.log(`
── Summary ──────────────────────────────
  Found via Open Library (w/ author): ${result.foundOl}
  Found via Open Library (title only): ${result.foundOlTitle}
  Found via Google Books:              ${result.foundGb}
  Total found:                         ${result.foundOl + result.foundOlTitle + result.foundGb}
  Not found:                           ${result.notFound}
  DB write errors:                     ${result.errors}
  ${APPLY ? 'Written to DB ✓' : 'DRY-RUN — re-run with --apply to write'}
`)
}

main().catch(e => { console.error(e); process.exit(1) })
