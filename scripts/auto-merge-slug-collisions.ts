#!/usr/bin/env tsx
// Find queue rows whose `dedup_check.kind` is 'none' but whose canonical
// slug ALREADY exists in the books table — and merge them into that book
// instead of failing on a books_slug_key violation during auto-accept.
//
// How a row ends up here:
//   1. Imported with title like "Jane Eyre (1847)" — slug "jane-eyre-1847".
//      Dedup against existing "jane-eyre" missed because slugs differ.
//   2. backfill-year-from-title.ts stripped " (1847)" → title "Jane Eyre",
//      slug now "jane-eyre" — collides with the existing book.
//   3. Bulk auto-accept attempts INSERT → unique constraint violation.
//
// This script catches that case and routes the row through the same
// mergeQueueRowIntoBook path that auto-merge-confirmed-duplicates uses.
//
// Eligibility (mirrors bulk-auto-accept-queue.ts):
//   - status='pending_review', dedup_check.kind in (null, 'none')
//   - parsed_row has title + authors[0] + year, reason_mapping.slug set
//   - books.slug = slugify(parsed_row.title) returns an existing row
//   - quality_flags don't include any editorial blocker
//
// Usage:
//   npx tsx --env-file=.env.local scripts/auto-merge-slug-collisions.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/auto-merge-slug-collisions.ts --write
import { Client } from 'pg'
import { adminClient } from '../src/lib/supabase'
import {
  findWikipediaSourceConfig,
  getQueueSectionDefaults,
  getQueueSourceContext,
  mergeQueueRowIntoBook,
  type MergeOverlay,
} from '../src/lib/imports/review-approve'
import { slugify } from '../src/lib/imports/slugify'

const WRITE = process.argv.includes('--write')

const BLOCKING_FLAGS = new Set([
  'defamation_suit_civil',
  'civil_action_private_party',
  'civil_court_stay_order',
  'possible_duplicate',
  'unmapped_reason',
  'incomplete_year',
  'no_author',
  'no_title',
])

type ParsedRow = {
  title?: string
  title_native?: string | null
  title_english_meaningful?: string | null
  authors?: string[]
  year?: number | null
}

type QueueRow = {
  id: number
  source_slug: string
  source_url: string | null
  agreement_details: {
    parsed_row?: ParsedRow
    section_anchor?: string
    source_context?: { source_name?: string | null }
    reason_mapping?: { slug?: string | null; confidence?: string | null }
    dedup_check?: { kind?: string } | null
    quality_flags?: string[]
  } | null
}

function newPgClient(): Client {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Client({ connectionString })
}

async function main() {
  const sb = adminClient()

  // Load all pending rows that COULD auto-accept but landed in 'none' dedup.
  const all: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, source_url, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  const candidates = all.filter(r => {
    const ad = r.agreement_details ?? {}
    const parsed = ad.parsed_row ?? {}
    const flags = ad.quality_flags ?? []
    const dedupKind = ad.dedup_check?.kind
    if (parsed.year == null || !parsed.authors?.length || !parsed.title) return false
    if (!ad.reason_mapping?.slug) return false
    if (dedupKind && dedupKind !== 'none') return false
    if (flags.some(f => BLOCKING_FLAGS.has(f))) return false
    return true
  })

  console.log(`Pending rows eligible for slug-collision check: ${candidates.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  // For each candidate, compute slug and look up in books table. Batched
  // for efficiency — one SELECT per ~50 slugs.
  type Hit = { row: QueueRow; bookId: number; bookSlug: string }
  const hits: Hit[] = []

  const slugs = candidates.map(r => ({ id: r.id, slug: slugify(r.agreement_details!.parsed_row!.title!) }))
  const uniqueSlugs = [...new Set(slugs.map(s => s.slug))]
  console.log(`Looking up ${uniqueSlugs.length} unique slugs against books table…`)

  const BATCH = 100
  const slugToBookId = new Map<string, number>()
  for (let i = 0; i < uniqueSlugs.length; i += BATCH) {
    const batch = uniqueSlugs.slice(i, i + BATCH)
    const { data, error } = await sb
      .from('books')
      .select('id, slug')
      .in('slug', batch)
    if (error) throw error
    for (const b of (data ?? []) as Array<{ id: number; slug: string }>) {
      slugToBookId.set(b.slug, b.id)
    }
  }

  for (const c of candidates) {
    const slug = slugify(c.agreement_details!.parsed_row!.title!)
    const bookId = slugToBookId.get(slug)
    if (bookId) hits.push({ row: c, bookId, bookSlug: slug })
  }

  console.log(`Slug collisions found: ${hits.length}\n`)
  if (hits.length === 0) {
    console.log('Nothing to merge.')
    return
  }

  console.log('── HITS ──')
  for (const h of hits.slice(0, 30)) {
    const title = h.row.agreement_details!.parsed_row!.title!.slice(0, 45)
    console.log(`  q#${h.row.id} "${title}" → book #${h.bookId} (slug=${h.bookSlug})`)
  }
  if (hits.length > 30) console.log(`  … +${hits.length - 30} more`)

  if (!WRITE) {
    console.log(`\n[DRY-RUN] Re-run with --write to merge ${hits.length} rows.`)
    return
  }

  console.log(`\nApplying ${hits.length} merges...`)
  const pg = newPgClient()
  await pg.connect()
  let success = 0
  let failures = 0
  try {
    for (const h of hits) {
      const ad = h.row.agreement_details!
      const parsed = ad.parsed_row!
      const reason = ad.reason_mapping!
      const defaults = getQueueSectionDefaults(h.row.source_slug, ad)
      if (!defaults) {
        console.log(`  ✗ q#${h.row.id}: section defaults unresolvable`)
        failures++
        continue
      }
      const sourceName =
        ad.source_context?.source_name
        ?? findWikipediaSourceConfig(h.row.source_slug)?.page?.replace(/_/g, ' ')
        ?? h.row.source_slug
      const overlay: MergeOverlay = {
        title: parsed.title!,
        title_native: parsed.title_native ?? null,
        title_english_meaningful: parsed.title_english_meaningful ?? null,
        original_language: null,
        authors: parsed.authors!,
        year: parsed.year!,
        first_published_year: null,
        reason_slug: reason.slug!,
        action_type: defaults.action_type,
        scope_slug: defaults.scope_slug,
        ban_status: defaults.ban_status,
        description_book: null,
        description_ban: null,
        inclusion_rationale:
          `Auto-merged on slug collision: dedup originally missed because parsed title `
          + `had a year suffix; post-backfill the canonical slug '${h.bookSlug}' matches `
          + `existing book #${h.bookId}. Source: Wikipedia ${sourceName}.`,
        target_book_id: h.bookId,
      }
      try {
        const ctx = getQueueSourceContext(h.row.source_slug, ad, h.row.source_url)
        const result = await mergeQueueRowIntoBook(
          h.row.id,
          overlay,
          ctx,
          pg,
          sb,
          'auto-merge-slug-collisions',
        )
        success++
        if (success % 10 === 0) console.log(`  … ${success}/${hits.length}`)
        if (result.queue_update_error) {
          console.log(`  ⚠ q#${h.row.id} → book #${result.book_id} but queue marker failed: ${result.queue_update_error}`)
        }
      } catch (err) {
        failures++
        console.log(`  ✗ q#${h.row.id} → ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } finally {
    await pg.end()
  }

  console.log(`\nDone. Success: ${success}, Failures: ${failures}`)
}

main().catch(e => { console.error(e); process.exit(1) })
