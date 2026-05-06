/**
 * Retroactively audit existing Google Books cover URLs for the
 * "image not available" placeholder, and remove the bad ones.
 *
 * For each books row whose cover_url points at books.google.com or
 * books.googleusercontent.com (excluding manual_override):
 *   - download the image
 *   - perceptual-hash-compare against assets/google-books-placeholder.png
 *   - on match: clear cover_url, set cover_status='rejected_placeholder',
 *     set cover_checked_at=now()
 *
 * Default is dry-run. Use --apply to write.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts
 *   npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply
 *   npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --concurrency=8
 */

import { adminClient } from '../src/lib/supabase'
import { checkImageUrl, getPlaceholderHash, PLACEHOLDER_HAMMING_THRESHOLD } from './lib/placeholder'

const APPLY        = process.argv.includes('--apply')
const limitArg     = process.argv.find(a => a.startsWith('--limit='))
const concArg      = process.argv.find(a => a.startsWith('--concurrency='))
const LIMIT        = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity
const CONCURRENCY  = concArg  ? parseInt(concArg.split('=')[1])  : 4
const POLITE_DELAY_MS = 200

type Book = { id: number; slug: string; title: string; cover_url: string }

async function processOne(book: Book, supabase: ReturnType<typeof adminClient>) {
  const result = await checkImageUrl(book.cover_url)

  if (result.ok === false && result.reason === 'placeholder') {
    if (APPLY) {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('books')
        .update({
          cover_url: null,
          cover_status: 'rejected_placeholder',
          cover_checked_at: nowIso,
        })
        .eq('id', book.id)
      if (error) return { kind: 'db_error' as const, book, msg: error.message }

      // Ensure the book is in the v2 retry pool (inner-joined by enrich-covers-v2).
      // Without this row, --force still couldn't re-enrich it via OL/Wikipedia.
      // Don't overwrite an existing row's sources_tried.
      await supabase.from('cover_search_attempts').upsert(
        { book_id: book.id, last_searched_at: nowIso, sources_tried: [] },
        { onConflict: 'book_id', ignoreDuplicates: true },
      )
    }
    return { kind: 'placeholder' as const, book, distance: result.hammingDistance }
  }

  if (result.ok === false) {
    return { kind: 'fetch_error' as const, book, reason: result.reason, detail: result.detail }
  }
  return { kind: 'ok' as const, book, distance: result.hammingDistance }
}

async function main() {
  console.log(`\n── audit-covers-for-placeholders (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  const placeholderHash = await getPlaceholderHash()
  console.log(`Placeholder hash: ${placeholderHash}`)
  console.log(`Threshold:        Hamming <= ${PLACEHOLDER_HAMMING_THRESHOLD}`)
  console.log(`Concurrency:      ${CONCURRENCY}\n`)

  const supabase = adminClient()

  // Paginate — Supabase caps single SELECT at 1000 rows.
  const PAGE = 1000
  const all: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, cover_url, cover_status')
      .not('cover_url', 'is', null)
      .or('cover_url.ilike.%books.google.com%,cover_url.ilike.%googleusercontent.com%')
      .neq('cover_status', 'manual_override')
      .order('id')
      .range(from, to)
    if (error) { console.error(`DB error: ${error.message}`); process.exit(1) }
    const page = (data ?? []) as Book[]
    all.push(...page)
    if (page.length < PAGE) break
  }

  const batch = LIMIT === Infinity ? all : all.slice(0, LIMIT)

  console.log(`Google-hosted covers eligible: ${all.length}`)
  console.log(`This run (limit):              ${batch.length}\n`)

  let placeholders = 0, ok = 0, errors = 0, dbErrors = 0
  const placeholderHits: Array<{ id: number; slug: string; title: string }> = []
  const start = Date.now()

  // Simple bounded worker pool.
  let cursor = 0
  let processed = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= batch.length) return
      const book = batch[i]
      try {
        const r = await processOne(book, supabase)
        if (r.kind === 'placeholder') {
          placeholders++
          placeholderHits.push({ id: r.book.id, slug: r.book.slug, title: r.book.title })
        } else if (r.kind === 'ok') {
          ok++
        } else if (r.kind === 'fetch_error') {
          errors++
        } else if (r.kind === 'db_error') {
          dbErrors++
          console.error(`  DB error on id=${r.book.id}: ${r.msg}`)
        }
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Unexpected error on id=${book.id}: ${msg}`)
      }
      processed++
      if (processed % 50 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0)
        console.log(`  ${processed}/${batch.length}  ok=${ok} placeholder=${placeholders} err=${errors}  (${elapsed}s)`)
      }
      await new Promise(r => setTimeout(r, POLITE_DELAY_MS))
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n── Summary ──`)
  console.log(`Scanned:        ${batch.length}`)
  console.log(`Placeholder:    ${placeholders}${APPLY ? ' (cleared)' : ' (would clear)'}`)
  console.log(`OK:             ${ok}`)
  console.log(`Fetch errors:   ${errors}`)
  if (dbErrors) console.log(`DB errors:      ${dbErrors}`)
  console.log(`Time:           ${elapsed}s`)

  if (placeholderHits.length) {
    console.log(`\nPlaceholder hits (${placeholderHits.length}):`)
    for (const h of placeholderHits.slice(0, 50)) {
      console.log(`  id=${h.id}  ${h.slug}  ${h.title.slice(0, 60)}`)
    }
    if (placeholderHits.length > 50) {
      console.log(`  … and ${placeholderHits.length - 50} more`)
    }
  }

  if (!APPLY && placeholders > 0) {
    console.log(`\nRe-run with --apply to clear ${placeholders} cover URL${placeholders === 1 ? '' : 's'}.`)
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
