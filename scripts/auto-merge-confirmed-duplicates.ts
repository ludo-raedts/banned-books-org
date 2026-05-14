#!/usr/bin/env tsx
// Auto-merge queue rows where dedup confirmed an exact existing-book match.
//
// Targets `import_review_queue` rows with:
//   - status = 'pending_review'
//   - agreement_details.dedup_check.kind = 'duplicate'  (slug_collision OR
//     fuzzy_title_author above the duplicate cutoff)
//   - reason_mapping.slug is set (Phase 1+2 source fallback or strict pattern)
//   - parsed_row.year and parsed_row.authors[0] are present
//   - section_defaults resolvable
//
// Calls the existing `mergeQueueRowIntoBook()` from src/lib/imports/
// review-approve.ts — the SAME code path the admin /merge endpoint uses.
// That helper:
//   1. Locks the target book; enriches NULL scalar fields from the overlay
//   2. Adds slug aliases for non-canonical title variants
//   3. Creates a new `bans` row OR reuses the existing one if
//      (book_id, country, year, scope) tuple already exists (idempotent)
//   4. Links new source + reason
//   5. Marks queue row 'approved' with merge_decisions audit trail
//
// Idempotent against re-runs: rows already 'approved' are skipped; the merge
// helper itself idempotently reuses bans on (book, country, year, scope).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/auto-merge-confirmed-duplicates.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/auto-merge-confirmed-duplicates.ts --write
import { Client } from 'pg'
import { adminClient } from '../src/lib/supabase'
import {
  findWikipediaSourceConfig,
  getQueueSectionDefaults,
  getQueueSourceContext,
  mergeQueueRowIntoBook,
  type MergeOverlay,
} from '../src/lib/imports/review-approve'

const WRITE = process.argv.includes('--write')

type ParsedRow = {
  title?: string
  title_native?: string | null
  title_transliterated?: string | null
  title_english_meaningful?: string | null
  authors?: string[]
  year?: number | null
  source_anchor?: string
}

type DedupCheck = {
  kind: 'duplicate' | string
  book_id?: number
  similarity?: number
}

type AgreementDetails = {
  parsed_row?: ParsedRow
  section_anchor?: string
  source_context?: { source_name?: string | null }
  reason_mapping?: { slug?: string | null; confidence?: string | null }
  dedup_check?: DedupCheck
  quality_flags?: string[]
}

type QueueRow = {
  id: number
  source_slug: string
  source_url: string | null
  status: string
  agreement_details: AgreementDetails | null
}

function newPgClient(): Client {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Client({ connectionString })
}

async function loadConfirmedDuplicates(
  s: ReturnType<typeof adminClient>,
): Promise<QueueRow[]> {
  const all: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, source_url, status, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw new Error(`load queue: ${error.message}`)
    if (!data?.length) break
    all.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return all.filter(r => r.agreement_details?.dedup_check?.kind === 'duplicate')
}

type EligibilityResult =
  | { ok: true; overlay: MergeOverlay; targetBookId: number; similarity: number }
  | { ok: false; reason: string }

function buildOverlay(row: QueueRow): EligibilityResult {
  const ad = row.agreement_details ?? {}
  const parsed = ad.parsed_row ?? {}
  const dedup = ad.dedup_check
  const reason = ad.reason_mapping

  if (!dedup || dedup.kind !== 'duplicate' || typeof dedup.book_id !== 'number') {
    return { ok: false, reason: 'dedup_check missing or not confirmed' }
  }
  if (!parsed.title) return { ok: false, reason: 'parsed_row.title missing' }
  if (!parsed.authors?.length) return { ok: false, reason: 'parsed_row.authors missing' }
  if (parsed.year == null) return { ok: false, reason: 'parsed_row.year missing' }
  if (!reason?.slug) return { ok: false, reason: 'reason_mapping.slug not set (run remap first)' }

  const defaults = getQueueSectionDefaults(row.source_slug, ad)
  if (!defaults) return { ok: false, reason: 'section defaults unresolvable' }

  const sourceName =
    ad.source_context?.source_name
    ?? findWikipediaSourceConfig(row.source_slug)?.page?.replace(/_/g, ' ')
    ?? row.source_slug

  const inclusionRationale =
    `Auto-merged: matched existing book #${dedup.book_id} via dedup`
    + (dedup.similarity ? ` (similarity ${dedup.similarity.toFixed(2)})` : '')
    + `. Source: Wikipedia ${sourceName}. Reason classified as '${reason.slug}'.`

  const overlay: MergeOverlay = {
    title: parsed.title,
    title_native: parsed.title_native ?? null,
    title_english_meaningful: parsed.title_english_meaningful ?? null,
    original_language: null,   // not stored on ParsedRow; merge helper only fills NULL fields
    authors: parsed.authors,
    year: parsed.year,
    first_published_year: null,
    reason_slug: reason.slug,
    action_type: defaults.action_type,
    scope_slug: defaults.scope_slug,
    ban_status: defaults.ban_status,
    description_book: null,
    description_ban: null,
    inclusion_rationale: inclusionRationale,
    target_book_id: dedup.book_id,
  }
  return { ok: true, overlay, targetBookId: dedup.book_id, similarity: dedup.similarity ?? 0 }
}

async function main() {
  const sb = adminClient()
  const rows = await loadConfirmedDuplicates(sb)
  console.log(`Confirmed-duplicate queue rows: ${rows.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  const eligible: Array<{ row: QueueRow; overlay: MergeOverlay; targetBookId: number; similarity: number }> = []
  const skipped: Array<{ row: QueueRow; reason: string }> = []
  for (const row of rows) {
    const r = buildOverlay(row)
    if (r.ok) eligible.push({ row, overlay: r.overlay, targetBookId: r.targetBookId, similarity: r.similarity })
    else skipped.push({ row, reason: r.reason })
  }

  console.log(`Eligible for auto-merge: ${eligible.length}`)
  console.log(`Skipped (missing data):  ${skipped.length}\n`)

  if (skipped.length > 0) {
    console.log('── SKIPPED ──')
    for (const s of skipped) {
      const title = s.row.agreement_details?.parsed_row?.title ?? '(no title)'
      console.log(`  [q#${s.row.id}] "${title.slice(0, 50)}" → ${s.reason}`)
    }
    console.log('')
  }

  console.log('── ELIGIBLE ──')
  for (const e of eligible) {
    const title = e.overlay.title.slice(0, 45)
    const authors = e.overlay.authors.slice(0, 2).join(', ').slice(0, 25)
    console.log(
      `  [q#${e.row.id}] "${title}" / ${authors} (${e.overlay.year}) → book #${e.targetBookId} (sim ${e.similarity.toFixed(2)})`,
    )
  }

  if (!WRITE) {
    console.log(`\n[DRY-RUN] Re-run with --write to apply ${eligible.length} merges.`)
    return
  }

  if (eligible.length === 0) {
    console.log('\nNothing to merge.')
    return
  }

  console.log(`\nApplying ${eligible.length} merges...`)
  const pg = newPgClient()
  await pg.connect()

  let success = 0
  let failures = 0
  try {
    for (const e of eligible) {
      const ad = e.row.agreement_details ?? {}
      try {
        const ctx = getQueueSourceContext(e.row.source_slug, ad, e.row.source_url)
        const result = await mergeQueueRowIntoBook(
          e.row.id,
          e.overlay,
          ctx,
          pg,
          sb,
          'auto-merge-confirmed-duplicates',
        )
        const aliases = result.aliases_added.length > 0 ? ` aliases=[${result.aliases_added.join(',')}]` : ''
        const enriched = result.enriched_fields.length > 0 ? ` enriched=[${result.enriched_fields.join(',')}]` : ''
        console.log(
          `  ✓ q#${e.row.id} → book #${result.book_id} ban #${result.ban_id} `
          + `(${result.ban_created ? 'NEW' : 'EXISTED'})${enriched}${aliases}`,
        )
        success++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  ✗ q#${e.row.id} → ${msg}`)
        failures++
      }
    }
  } finally {
    await pg.end()
  }

  console.log(`\nDone. Success: ${success}, Failures: ${failures}`)
}

main().catch(e => { console.error(e); process.exit(1) })
