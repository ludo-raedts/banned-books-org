#!/usr/bin/env tsx
/**
 * Manual smoke test for fetcher.ts + archiver.ts.
 *
 * Live network calls — not part of the Vitest suite. Run when changing
 * either module to confirm end-to-end behaviour against a real source.
 *
 * Usage:
 *   pnpm tsx scripts/test-pipeline-fetcher.ts
 *   pnpm tsx scripts/test-pipeline-fetcher.ts --no-archive   # fetcher only
 */
import { fetchSource } from '../src/lib/imports/fetcher'
import { archiveUrl } from '../src/lib/imports/archiver'

const TEST_URL = 'https://pen.org/banned-book-list/'
const TEST_SOURCE_TYPE = 'pen_america'

async function main() {
  const skipArchive = process.argv.includes('--no-archive')

  console.log(`[fetch] ${TEST_URL}`)
  const fetched = await fetchSource(TEST_URL)
  console.log(JSON.stringify({
    status: fetched.status,
    content_type: fetched.content_type,
    fetched_at: fetched.fetched_at,
    redirect_count: fetched.redirect_count,
    redirect_chain: fetched.redirect_chain,
    html_length: fetched.html?.length ?? null,
  }, null, 2))

  if (skipArchive) return

  console.log(`\n[archive] ${TEST_URL} (source_type=${TEST_SOURCE_TYPE})`)
  const archived = await archiveUrl(TEST_URL, TEST_SOURCE_TYPE)
  console.log(JSON.stringify(archived, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
