/**
 * ⚠️ DEPRECATED — prefer scripts/enrich-descriptions-v2.ts for all new runs.
 *
 * v2 has multi-source cross-checking (Wikipedia + OL + GB + langlinks),
 * title-fuzz + author-surname validation, LLM grounded synthesis instead
 * of free-form generation, and writes description_source_url +
 * description_source_type so the UI can show provenance. This v1 script
 * remains for backward compatibility with the /api/admin/enrich/run
 * endpoint and the safe defaults applied 2026-05-28 (skip-flagged + opt-in
 * GPT fallback).
 *
 * For new work:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm --concurrency=5
 *
 * Enrich book descriptions in two passes:
 *
 *   Part A — Fix truncated descriptions (ends without sentence-final punctuation)
 *             Source: OL works API → OL search → Google Books
 *
 *   Part B — Fill completely missing descriptions (description_book IS NULL)
 *             Source: OL search → Google Books → [opt-in] GPT-4o-mini fallback
 *
 * Safety changes (2026-05-28):
 *   - Rows with data_quality_status='flagged' are skipped automatically.
 *     The judge run wipes description_book on confirmed hallucinations and
 *     sets that status; refilling them is exactly what we just cleaned up.
 *   - GPT fallback is now OPT-IN. Pass --allow-gpt-fallback (or set
 *     OPENAI_ALLOW_FALLBACK=true) to enable it. Default = OL + GB only.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts
 *     → dry-run: shows counts, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply
 *     → writes to description_book using verified sources (OL + GB)
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --allow-gpt-fallback
 *     → re-enables the GPT-4o-mini fallback (use sparingly)
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --slug=<slug>
 *     → re-enrich a single book regardless of existing description_book or flag
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --overwrite --limit=50
 *     → re-enrich all books, overwriting existing description_book (also bypasses flag-skip)
 *
 * Core logic lives in src/lib/enrich/descriptions.ts so /api/admin/enrich/run
 * can call it in-process from the UI.
 */

import { enrichDescriptions } from '../src/lib/enrich/descriptions'

const APPLY      = process.argv.includes('--apply')
const OVERWRITE  = process.argv.includes('--overwrite')
const ALLOW_GPT  = process.argv.includes('--allow-gpt-fallback')
const limitArg   = process.argv.find(a => a.startsWith('--limit='))
const slugArg    = process.argv.find(a => a.startsWith('--slug='))
const LIMIT      = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
const SLUG       = slugArg?.split('=')[1] ?? undefined

async function main() {
  console.log(`\n── enrich-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (SLUG)       console.log(`  --slug=${SLUG} (single book, overwrites existing, bypasses flag-skip)`)
  if (OVERWRITE)  console.log(`  --overwrite: replacing existing description_book too`)
  if (LIMIT)      console.log(`  --limit=${LIMIT}`)
  if (ALLOW_GPT)  console.log(`  --allow-gpt-fallback: GPT-4o-mini fallback ENABLED for this run`)
  console.log()

  const result = await enrichDescriptions({
    apply: APPLY,
    limit: LIMIT,
    overwrite: OVERWRITE,
    slug: SLUG,
    allowGptFallback: ALLOW_GPT,
    onProgress: msg => console.log(msg),
  })

  console.log(`\n── Summary ──`)
  console.log(`Part A (repair): updated=${result.partA.updated} skipped=${result.partA.skipped}`)
  console.log(`Part B (fill):   OL=${result.partB.ol} GB=${result.partB.gb} GPT=${result.partB.gpt} skipped=${result.partB.skipped}`)
  console.log(`Errors:          ${result.errors}`)
  if (!APPLY) console.log(`\nDRY-RUN — re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
