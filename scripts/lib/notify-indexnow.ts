/**
 * Notify IndexNow from CLI scripts (import-batches, editorial classifiers, ...).
 *
 * Usage at the end of an import script, after inserts have run:
 *
 *   import { notifyIndexNowFromScript } from './lib/notify-indexnow'
 *   await notifyIndexNowFromScript({
 *     write: WRITE,
 *     books: addedBookSlugs,
 *     authors: addedAuthorSlugs,
 *   })
 *
 * Guardrails (the helper skips silently in any of these cases):
 *   - `write` is false (dry-run)
 *   - no new slugs to submit
 *   - INDEXNOW_KEY env var is not set
 *   - resolved host is localhost / 127.0.0.1 (don't ping IndexNow with non-public URLs)
 *
 * Why a wrapper instead of calling `submitToIndexNow` directly: scripts run with
 * `.env.local` which can point at staging or localhost, and we never want a
 * partial dry-run to nudge Bing with garbage URLs.
 */

import { submitToIndexNow, absoluteUrl } from '../../src/lib/indexnow'

type NotifyArgs = {
  /** Pass through the script's --write flag. Skips when false. */
  write: boolean
  /** New book slugs inserted in this run. */
  books?: string[]
  /** New author slugs inserted in this run. */
  authors?: string[]
  /** Optional extra absolute paths (e.g. `/reasons/x`) to submit. */
  extraPaths?: string[]
}

function resolvedHost(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.banned-books.org'
  try {
    return new URL(base).host
  } catch {
    return ''
  }
}

export async function notifyIndexNowFromScript(args: NotifyArgs): Promise<void> {
  if (!args.write) {
    console.log('[indexnow] skip — dry-run (no --write)')
    return
  }

  const paths = [
    ...(args.books ?? []).map((s) => `/books/${s}`),
    ...(args.authors ?? []).map((s) => `/authors/${s}`),
    ...(args.extraPaths ?? []),
  ]
  if (paths.length === 0) {
    console.log('[indexnow] skip — no new slugs to submit')
    return
  }

  if (!process.env.INDEXNOW_KEY) {
    console.log(`[indexnow] skip — INDEXNOW_KEY not set (would have submitted ${paths.length} URLs)`)
    return
  }

  const host = resolvedHost()
  if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    console.log(`[indexnow] skip — host is ${host || 'unset'} (NEXT_PUBLIC_BASE_URL not set to prod)`)
    return
  }

  const urls = paths.map(absoluteUrl)
  console.log(`[indexnow] submitting ${urls.length} URLs to ${host}`)
  const result = await submitToIndexNow(urls)
  if (result.ok) {
    console.log(`[indexnow] ✓ HTTP ${result.status}, ${result.submitted.length} URLs accepted`)
  } else {
    console.warn(`[indexnow] ✗ HTTP ${result.status} — ${result.error}`)
  }
}
