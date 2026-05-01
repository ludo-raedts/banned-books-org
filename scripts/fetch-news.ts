/**
 * Fetch news from RSS feeds, summarize with GPT-4o-mini, save drafts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fetch-news.ts           # dry-run
 *   npx tsx --env-file=.env.local scripts/fetch-news.ts --apply   # write to DB
 */

import { runFetchNews } from '../src/lib/fetch-news'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`Running fetch-news (${APPLY ? 'apply' : 'dry-run'})…\n`)
  const { saved, skipped, errors } = await runFetchNews(APPLY)
  console.log(`\n── Summary ──`)
  console.log(`Saved: ${saved} | Not relevant: ${skipped} | Errors: ${errors.length}`)
  if (errors.length > 0) errors.forEach(e => console.log(`  ✗ ${e}`))
  if (!APPLY) console.log('\nDRY-RUN — re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
