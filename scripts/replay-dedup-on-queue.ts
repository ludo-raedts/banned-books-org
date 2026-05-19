#!/usr/bin/env tsx
// Replay the new dedup logic against every pending `possible_duplicate` row
// in the review queue. For each row:
//   1. Re-run dedupAgainstBooks() (now with title-normalization)
//   2. Re-run mapReason() and decide() to know the new routing
//   3. If new decision is 'auto_add_ban' → commit a new ban on the matched
//      existing book; mark queue row 'approved' (via the queue-cleanup block
//      already inside commitAutoAddBan).
//   4. If new decision is 'review' but the dedup_check shape changed →
//      update the queue row's agreement_details.dedup_check so the editor
//      sees the latest evidence (without changing status).
//
// Default: dry-run (no DB writes). Pass --apply to commit.
//
// Idempotent: rows already 'approved' are skipped; the auto_add_ban path is
// itself idempotent via the SELECT-first-then-INSERT guard inside
// commitNewBanForBook.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ImporterContext } from '../src/lib/wikipedia/importer'
import type { ParsedRow } from '../src/lib/wikipedia/types'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

type QueueRow = {
  id: number
  source_slug: string
  raw_input: { section_heading?: string } | null
  pass_a_output: Record<string, unknown> | null
  agreement_details: Record<string, unknown> | null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const limitFlag = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitFlag ? Number(limitFlag.split('=')[1]) : null

  const { adminClient } = await import('../src/lib/supabase')
  const { dedupAgainstBooks, findNearbyBanForBook } = await import('../src/lib/wikipedia/dedup')
  const { mapReason } = await import('../src/lib/wikipedia/reason-mapper')
  const { decide, commitDecision, newPgClient } = await import('../src/lib/wikipedia/importer')
  const { WIKIPEDIA_SOURCES } = await import('../src/lib/wikipedia/config')

  const SOURCE_BY_SLUG = new Map<string, (typeof WIKIPEDIA_SOURCES)[string]>()
  for (const sc of Object.values(WIKIPEDIA_SOURCES)) {
    SOURCE_BY_SLUG.set(sc.source_slug, sc)
  }

  const sb = adminClient()

  // Load all pending review rows; we filter to possible_duplicate in memory
  // so we can also report on edge cases (e.g. dedup_check.kind missing).
  const rows: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, raw_input, pass_a_output, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  const flagged = rows.filter(r => {
    const d = r.agreement_details?.dedup_check as { kind?: string } | undefined
    return d?.kind === 'possible_duplicate'
  })

  console.log(`Pending rows:               ${rows.length}`)
  console.log(`Flagged possible_duplicate: ${flagged.length}`)
  console.log(`Mode:                       ${apply ? 'APPLY' : 'DRY-RUN'}`)
  if (limit) console.log(`Limit:                      ${limit}`)
  console.log('')

  let willAddBan = 0
  let willStayReview = 0
  let willPromoteToReviewOnly = 0  // dedup_check changes but quality flags keep it in review
  let willBecomeNone = 0
  let skipped = 0
  let errors = 0
  let didCommitBan = 0
  let didUpdateDedupOnly = 0

  const pg = apply ? newPgClient() : null
  if (pg) await pg.connect()

  const subset = limit ? flagged.slice(0, limit) : flagged

  try {
    for (const row of subset) {
      try {
        const sourceConfig = SOURCE_BY_SLUG.get(row.source_slug)
        if (!sourceConfig) {
          skipped++
          continue
        }
        const sectionHeading = row.raw_input?.section_heading
        const section = sourceConfig.sections.find(s => s.heading === sectionHeading)
        if (!section) {
          skipped++
          continue
        }

        // Prefer agreement_details.parsed_row (canonical) over pass_a_output.
        const parsedRaw =
          (row.agreement_details?.parsed_row as Record<string, unknown> | undefined) ??
          row.pass_a_output
        if (!parsedRaw || !parsedRaw.title || !Array.isArray(parsedRaw.authors)) {
          skipped++
          continue
        }
        const parsedRow: ParsedRow = {
          year: (parsedRaw.year as number | null | undefined) ?? null,
          title: parsedRaw.title as string,
          title_native: (parsedRaw.title_native as string | null | undefined) ?? null,
          title_transliterated: (parsedRaw.title_transliterated as string | null | undefined) ?? null,
          title_english_meaningful:
            (parsedRaw.title_english_meaningful as string | null | undefined) ?? null,
          authors: parsedRaw.authors as string[],
          state: (parsedRaw.state as string | null | undefined) ?? null,
          notes_raw: (parsedRaw.notes_raw as string | undefined) ?? '',
          source_anchor: (parsedRaw.source_anchor as string | undefined) ?? '',
          quality_flags: (parsedRaw.quality_flags as ParsedRow['quality_flags'] | undefined) ?? [],
        }

        const dedup = await dedupAgainstBooks(sb, parsedRow)
        const reasonResult = mapReason(parsedRow.notes_raw, section.fallback_reason_slug)
        // Mirror the soft-dup check in import-wikipedia-list.ts so re-played
        // rows that target an existing book are routed to review whenever
        // that book already carries a same-country / same-scope ban within
        // ±NEARBY_BAN_YEAR_WINDOW. Without this, the replay would keep
        // promoting near-duplicates to auto_add_ban silently.
        const replayCountryCode = section.country_code ?? sourceConfig.country_code
        const nearbyBan =
          dedup.kind === 'duplicate' && parsedRow.year !== null && replayCountryCode
            ? await findNearbyBanForBook(
                sb,
                dedup.book_id,
                replayCountryCode,
                section.scope_default,
                parsedRow.year,
              )
            : null

        const decision = decide({
          row: parsedRow,
          reason: reasonResult.mapping,
          reasonFlags: reasonResult.extra_flags,
          dedup,
          nearbyBan,
        })

        const oldKind =
          (row.agreement_details?.dedup_check as { kind?: string } | undefined)?.kind ?? 'unknown'
        const dedupChanged = dedup.kind !== oldKind

        if (decision.mode === 'auto_add_ban') willAddBan++
        else if (decision.mode === 'review' && dedup.kind === 'none') willBecomeNone++
        else if (decision.mode === 'review' && dedupChanged) willPromoteToReviewOnly++
        else willStayReview++

        if (apply && pg) {
          if (decision.mode === 'auto_add_ban') {
            const ctx: ImporterContext = {
              sourceConfig,
              page: (row.agreement_details?.page as string | undefined) ?? sourceConfig.page,
              revid: (row.agreement_details?.revid as number | undefined) ?? 0,
            }
            await commitDecision(sb, pg, ctx, section, decision)
            didCommitBan++
            // The queue-cleanup block inside commitAutoAddBan marks the row 'approved'.
          } else if (dedupChanged) {
            // Persist the updated dedup_check so the editor sees current evidence.
            const newDetails = {
              ...(row.agreement_details ?? {}),
              dedup_check: dedup.kind === 'none' ? null : dedup,
            }
            const { error: upErr } = await sb
              .from('import_review_queue')
              .update({ agreement_details: newDetails })
              .eq('id', row.id)
              .eq('status', 'pending_review')
            if (upErr) {
              console.error(`  [warn] q#${row.id}: dedup-update failed: ${upErr.message}`)
            } else {
              didUpdateDedupOnly++
            }
          }
        }
      } catch (err) {
        errors++
        console.error(`  [error] q#${row.id}: ${(err as Error).message}`)
      }
    }
  } finally {
    if (pg) await pg.end()
  }

  console.log('Outcome distribution (would-be):')
  console.log(`  ${String(willAddBan).padStart(4)}  auto-add-ban (gates pass)`)
  console.log(`  ${String(willPromoteToReviewOnly).padStart(4)}  stay in review, dedup-evidence updated`)
  console.log(`  ${String(willStayReview).padStart(4)}  stay in review, no change`)
  console.log(`  ${String(willBecomeNone).padStart(4)}  dedup says 'none' (rare; signal lost)`)
  console.log(`  ${String(skipped).padStart(4)}  skipped (config/data missing)`)
  console.log(`  ${String(errors).padStart(4)}  errors`)
  if (apply) {
    console.log('')
    console.log('Applied:')
    console.log(`  ${String(didCommitBan).padStart(4)}  new bans created + queue rows approved`)
    console.log(`  ${String(didUpdateDedupOnly).padStart(4)}  dedup_check updated in place`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
