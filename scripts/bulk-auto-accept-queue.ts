#!/usr/bin/env tsx
// Bulk auto-accept pending queue rows that have no real blocker after the
// Phase 1+2 reason-mapping pass.
//
// Calls the same `approveQueueRow()` helper that the admin /approve endpoint
// uses, so the resulting books / bans / source links are identical to a
// human click. Auto-accepted rows are marked `reviewed_by = 'auto-bulk'`
// for audit. Run with `--write` to actually commit; default is dry-run.
//
// Eligibility — ALL must hold:
//   - status = 'pending_review'
//   - reason_mapping.slug is non-null (filled by Phase 1+2)
//   - parsed_row.year, parsed_row.authors[0], parsed_row.title present
//   - section_defaults resolvable + source_context resolvable
//   - dedup_check.kind in (null, 'none') — duplicates went via auto-merge,
//     possible_duplicates need a human fuzzy-match decision
//   - quality_flags exclude:
//       model_3_review_needed       (Sprint A doctrine: non-Latin → manual)
//       defamation_suit_civil       (civil suit, editorial)
//       civil_action_private_party  (civil injunction, editorial)
//       civil_court_stay_order      (procedural stay, editorial)
//       possible_duplicate          (fuzzy dedup — human decides merge)
//       unmapped_reason             (no slug picked; covered by reason check)
//       incomplete_year             (commitParsedRow throws on year=null)
//       no_author / no_title        (commitParsedRow throws)
//
// Acceptable flags that do NOT block:
//   - source_default_reason       (Phase 1+2 source-fallback slug)
//   - citation_needed             (Wikipedia flagged but the data is there)
//   - author_disjunction          (we kept first author — fine)
//   - import_ban_no_explicit_reason (slug='other' is a valid mapping)
//
// Idempotent against re-runs: rows already 'approved' / 'rejected' are not
// in the candidate set; approveQueueRow uses the SELECT-then-INSERT pattern
// in the committer (book by slug, ban by (book,country,year,scope)) so a
// retry against the same queue row produces the same book/ban IDs.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/bulk-auto-accept-queue.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/bulk-auto-accept-queue.ts --write
//   npx tsx --env-file=.env.local scripts/bulk-auto-accept-queue.ts --write --limit=20
import { Client } from 'pg'
import { adminClient } from '../src/lib/supabase'
import {
  approveQueueRow,
  findWikipediaSourceConfig,
  getQueueSectionDefaults,
  getQueueSourceContext,
  type ApproveOverlay,
} from '../src/lib/imports/review-approve'
import type { SectionConfig } from '../src/lib/wikipedia/types'

const WRITE = process.argv.includes('--write')
const limitFlag = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitFlag ? Number(limitFlag.split('=')[1]) : null

const BLOCKING_FLAGS = new Set([
  // model_3_review_needed intentionally NOT here — operator decision
  // 2026-05-14: bilingual title splits from the wikitext parser are stable
  // enough to trust the Latin transliteration as canonical. Cases where
  // the canonical title still contains CJK / Arabic / etc. (parser's
  // bilingual splitter didn't fire because the separator was '=' instead
  // of '/') are caught by the NON_LATIN_SCRIPT_IN_TITLE filter below.
  'defamation_suit_civil',
  'civil_action_private_party',
  'civil_court_stay_order',
  'possible_duplicate',
  'unmapped_reason',
  'incomplete_year',
  'no_author',
  'no_title',
])

// Memory doctrine: non-Latin title-translation cases need manual review. The
// parser's bilingual-title splitter is on `/` but some HK source rows use
// `=` as the separator (e.g. "德蘭修女來作我的光 = Mother Teresa..."), which
// leaves the canonical title as the unsplit bilingual blob. We catch those
// here by refusing to auto-accept any title containing CJK, Cyrillic,
// Arabic, Hebrew, Devanagari, Thai, Hangul, or Greek script characters.
// Accented-Latin (é, ñ, ß) passes through.
const NON_LATIN_SCRIPT_IN_TITLE = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Greek}]/u

type ParsedRow = {
  title?: string
  title_native?: string | null
  title_transliterated?: string | null
  title_english_meaningful?: string | null
  authors?: string[]
  year?: number | null
}

type AgreementDetails = {
  parsed_row?: ParsedRow
  section_anchor?: string
  source_context?: { source_name?: string | null; section_heading?: string | null }
  reason_mapping?: { slug?: string | null; confidence?: string | null }
  dedup_check?: { kind?: string } | null
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

// Resolve SectionConfig for a queue row by matching section_anchor against
// the live WIKIPEDIA_SOURCES registry. Mirrors findSectionForRow in
// scripts/remap-unmapped-queue.ts. Returns null when the source slug isn't
// in the registry (e.g. renamed source). Used to pick up
// SectionConfig.original_language for the overlay.
function findSectionForRow(row: QueueRow): SectionConfig | null {
  const cfg = findWikipediaSourceConfig(row.source_slug)
  if (!cfg) return null
  const ad = row.agreement_details ?? {}
  const anchor =
    ad.parsed_row && 'source_anchor' in ad.parsed_row
      ? (ad.parsed_row as { source_anchor?: string }).source_anchor ?? ''
      : ad.section_anchor ?? ''
  const matched = cfg.sections.find(s => s.heading.replace(/ /g, '_') === anchor)
  return matched ?? cfg.sections[0] ?? null
}

async function loadPending(s: ReturnType<typeof adminClient>): Promise<QueueRow[]> {
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
  return all
}

type Eligibility =
  | { ok: true; overlay: ApproveOverlay }
  | { ok: false; reason: string }

function evaluate(row: QueueRow): Eligibility {
  const ad = row.agreement_details ?? {}
  const parsed = ad.parsed_row ?? {}
  const flags = ad.quality_flags ?? []
  const reason = ad.reason_mapping
  const dedupKind = ad.dedup_check?.kind

  if (!parsed.title) return { ok: false, reason: 'missing title' }
  if (!parsed.authors?.length) return { ok: false, reason: 'missing authors' }
  if (parsed.year == null) return { ok: false, reason: 'missing year' }
  if (!reason?.slug) return { ok: false, reason: 'no reason_slug' }
  if (dedupKind && dedupKind !== 'none') return { ok: false, reason: `dedup=${dedupKind}` }
  if (NON_LATIN_SCRIPT_IN_TITLE.test(parsed.title)) {
    return { ok: false, reason: 'non-Latin script in title (per Sprint A doctrine)' }
  }

  const blockingPresent = flags.filter(f => BLOCKING_FLAGS.has(f))
  if (blockingPresent.length > 0) {
    return { ok: false, reason: `blocking flag: ${blockingPresent.join(',')}` }
  }

  const defaults = getQueueSectionDefaults(row.source_slug, ad)
  if (!defaults) return { ok: false, reason: 'section defaults unresolvable' }

  // SectionConfig also carries `original_language` for sources that span a
  // single language (Hong Kong = 'zh', etc). When set, we propagate it into
  // the overlay so books from those sources land with the right
  // original_language code instead of NULL.
  const section = findSectionForRow(row)
  const originalLanguage = section?.original_language ?? null

  const sourceName =
    ad.source_context?.source_name
    ?? findWikipediaSourceConfig(row.source_slug)?.page?.replace(/_/g, ' ')
    ?? row.source_slug
  const sectionHeading = ad.source_context?.section_heading ?? '(section)'

  const inclusionRationale =
    `Auto-accepted from Wikipedia ${sourceName} → ${sectionHeading}. `
    + `Reason classified as '${reason.slug}' (confidence ${reason.confidence ?? '?'}).`

  const overlay: ApproveOverlay = {
    title: parsed.title,
    title_native: parsed.title_native ?? null,
    title_english_meaningful: parsed.title_english_meaningful ?? null,
    original_language: originalLanguage,
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
  }
  return { ok: true, overlay }
}

async function main() {
  const sb = adminClient()
  const rows = await loadPending(sb)
  console.log(`Pending rows: ${rows.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${LIMIT ? ` (limit=${LIMIT})` : ''}\n`)

  const eligible: Array<{ row: QueueRow; overlay: ApproveOverlay }> = []
  const skipReasons = new Map<string, number>()
  const skippedSamples = new Map<string, Array<{ id: number; title: string }>>()

  for (const row of rows) {
    const r = evaluate(row)
    if (r.ok) {
      eligible.push({ row, overlay: r.overlay })
    } else {
      const bucket = r.reason.split(':')[0]
      skipReasons.set(bucket, (skipReasons.get(bucket) ?? 0) + 1)
      const samples = skippedSamples.get(bucket) ?? []
      if (samples.length < 3) {
        samples.push({
          id: row.id,
          title: row.agreement_details?.parsed_row?.title ?? '(no title)',
        })
        skippedSamples.set(bucket, samples)
      }
    }
  }

  console.log(`Eligible:           ${eligible.length}`)
  console.log(`Skipped:            ${rows.length - eligible.length}\n`)

  console.log('── SKIP REASONS ──')
  for (const [reason, n] of [...skipReasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${reason}`)
    for (const s of skippedSamples.get(reason) ?? []) {
      console.log(`         e.g. q#${s.id} "${s.title.slice(0, 50)}"`)
    }
  }

  if (eligible.length === 0) {
    console.log('\nNothing eligible to accept.')
    return
  }

  // Per-source + per-reason breakdown for the eligible set
  console.log('\n── ELIGIBLE BY SOURCE ──')
  const bySource = new Map<string, number>()
  for (const e of eligible) {
    bySource.set(e.row.source_slug, (bySource.get(e.row.source_slug) ?? 0) + 1)
  }
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${src}`)
  }
  console.log('\n── ELIGIBLE BY REASON ──')
  const byReason = new Map<string, number>()
  for (const e of eligible) {
    byReason.set(e.overlay.reason_slug, (byReason.get(e.overlay.reason_slug) ?? 0) + 1)
  }
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${reason}`)
  }

  // 10 random samples
  console.log('\n── 10 SAMPLES ──')
  const samples = eligible
    .sort((a, b) => (a.row.id * 31 + 7) % 997 - (b.row.id * 31 + 7) % 997)
    .slice(0, 10)
  for (const s of samples) {
    const authors = s.overlay.authors.slice(0, 2).join(', ').slice(0, 28)
    console.log(
      `  q#${s.row.id} [${s.row.source_slug}] "${s.overlay.title.slice(0, 35)}" / ${authors} (${s.overlay.year}) → ${s.overlay.reason_slug}`,
    )
  }

  if (!WRITE) {
    console.log(`\n[DRY-RUN] Re-run with --write to commit ${eligible.length} approvals.`)
    return
  }

  const subset = LIMIT ? eligible.slice(0, LIMIT) : eligible
  console.log(`\nApplying ${subset.length} approvals${LIMIT && LIMIT < eligible.length ? ` (capped at --limit=${LIMIT})` : ''}...`)
  const pg = newPgClient()
  await pg.connect()
  let success = 0
  let failures = 0

  try {
    for (const e of subset) {
      const ad = e.row.agreement_details ?? {}
      try {
        const ctx = getQueueSourceContext(e.row.source_slug, ad, e.row.source_url)
        const result = await approveQueueRow(
          e.row.id,
          e.overlay,
          ctx,
          pg,
          sb,
          'auto-bulk',
        )
        success++
        if (success % 20 === 0) console.log(`  … ${success}/${subset.length}`)
        if (result.queue_update_error) {
          console.log(`  ⚠ q#${e.row.id} → book #${result.book_id} but queue marker failed: ${result.queue_update_error}`)
        }
      } catch (err) {
        failures++
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  ✗ q#${e.row.id} → ${msg}`)
      }
    }
  } finally {
    await pg.end()
  }

  console.log(`\nDone. Success: ${success}, Failures: ${failures}`)
}

main().catch(e => { console.error(e); process.exit(1) })
