/**
 * Genre enrichment RETRY pass — mops up the books that gpt-4o-mini couldn't place.
 *
 * Why this exists: enrich-genres-gpt.ts only writes genres on a high/medium
 * confidence result. Books the mini model doesn't recognise (obscure / non-English
 * / niche titles) come back UNKNOWN or low-confidence, keep `genres = '{}'`, and so
 * resurface on every mini run — no progress, just repeated cost. After a mini sweep
 * the remaining `genres = '{}'` candidates ARE precisely those hard cases.
 *
 * This wrapper targets that exact same candidate set but defaults to a stronger
 * model (gpt-4o), which recognises a meaningful slice of them. It shares all logic
 * with enrich-genres-gpt.ts (same vocabulary, same prompt, same filter, same
 * pagination) — only the default model differs.
 *
 * Run it AFTER the cheap mini sweep, not instead of it.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts             # dry-run, 5 samples
 *   npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply --limit=50
 *   npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply --model=gpt-4.1
 */

import { enrichGenres, optionsFromArgv } from './enrich-genres-gpt'

// Stronger default than the mini sweep; still overridable with --model=.
const RETRY_MODEL = 'gpt-4o'

const opts = optionsFromArgv({ model: RETRY_MODEL, delay: 300 })

console.log(`\n── enrich-genres RETRY pass — model defaults to ${RETRY_MODEL} ──`)
console.log('  Targets the genres = \'{}\' books the mini sweep left behind.\n')

enrichGenres(opts).catch(e => { console.error(e); process.exit(1) })
