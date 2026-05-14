#!/usr/bin/env tsx
/**
 * Wikipedia bulk-parser CLI.
 *
 *   pnpm tsx --env-file=.env.local scripts/import-wikipedia-list.ts --source india --dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-wikipedia-list.ts --source india --apply
 *
 * --dry-run is the default. --apply must be passed explicitly to perform any
 * DB writes (auto-approve commits + review-queue upserts).
 *
 * Detailed per-row output for both modes is written to
 * data/wikipedia-import-runs/<source>-<timestamp>.json so the operator can
 * inspect the classification before re-running with --apply.
 */
import { promises as fs } from 'fs'
import path from 'path'
import { adminClient } from '../src/lib/supabase'
import { WIKIPEDIA_SOURCES } from '../src/lib/wikipedia/config'
import { fetchWikipediaPage } from '../src/lib/wikipedia/fetcher'
import { parseWikipediaPage } from '../src/lib/wikipedia/parser'
import { mapReason, type ReasonMapResult } from '../src/lib/wikipedia/reason-mapper'
import { dedupAgainstBooks } from '../src/lib/wikipedia/dedup'
import {
  commitDecision,
  decide,
  newPgClient,
  type ImporterContext,
} from '../src/lib/wikipedia/importer'
import type {
  DedupResult,
  ImportDecision,
  ParsedRow,
  SectionConfig,
} from '../src/lib/wikipedia/types'

type CliArgs = { source: string; apply: boolean }

function parseArgs(): CliArgs {
  let source = ''
  let apply = false
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--source=')) source = a.slice('--source='.length)
    else if (a === '--source') source = argv[++i] ?? ''
    else if (a === '--apply') apply = true
    else if (a === '--dry-run') apply = false
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: pnpm tsx --env-file=.env.local scripts/import-wikipedia-list.ts ' +
          '--source <name> [--dry-run|--apply]',
      )
      process.exit(0)
    }
  }
  if (!source) {
    console.error(
      'Missing --source. Run with --help for usage. ' +
        `Available: ${Object.keys(WIKIPEDIA_SOURCES).join(', ')}`,
    )
    process.exit(1)
  }
  return { source, apply }
}

type Classified = {
  row: ParsedRow
  section: SectionConfig
  reason: ReasonMapResult
  dedup: DedupResult
  decision: ImportDecision
}

async function main(): Promise<void> {
  const args = parseArgs()
  const config = WIKIPEDIA_SOURCES[args.source]
  if (!config) {
    console.error(
      `Unknown source: ${args.source}. ` +
        `Available: ${Object.keys(WIKIPEDIA_SOURCES).join(', ')}`,
    )
    process.exit(1)
  }

  const sb = adminClient()

  console.log(`[fetch] Wikipedia page: ${config.page}`)
  const fetched = await fetchWikipediaPage(config.page)
  console.log(`[fetch] revid ${fetched.revid}, wikitext ${fetched.wikitext.length} chars`)

  console.log(`[parse] section detection + table extraction`)
  const sections = parseWikipediaPage(fetched.wikitext, config.sections)
  const perSection = sections.map(s => ({ heading: s.section.heading, count: s.rows.length }))
  const sectionFmt = perSection.map(s => `${s.count} ${s.heading.toLowerCase()}`).join(' + ')
  const allRows = sections.flatMap(s =>
    s.rows.map(row => ({ row, section: s.section })),
  )
  console.log(`[parse] ${allRows.length} rows: ${sectionFmt}`)

  console.log(`[classify] reason mapping + dedup against books table`)
  const classified: Classified[] = []
  for (const item of allRows) {
    const reason = mapReason(item.row.notes_raw)
    const dedup = await dedupAgainstBooks(sb, item.row)
    const decision = decide({
      row: item.row,
      reason: reason.mapping,
      reasonFlags: reason.extra_flags,
      dedup,
    })
    classified.push({ row: item.row, section: item.section, reason, dedup, decision })
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const dupCount = classified.filter(c => c.dedup.kind === 'duplicate').length
  const newCount = classified.length - dupCount
  const autoCount = classified.filter(c => c.decision.mode === 'auto_approve').length
  const addBanCount = classified.filter(c => c.decision.mode === 'auto_add_ban').length
  const reviewCount = classified.filter(c => c.decision.mode === 'review').length

  const flagCounts = new Map<string, number>()
  for (const c of classified) {
    if (c.decision.mode !== 'review') continue
    for (const f of c.decision.quality_flags) {
      flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1)
    }
  }
  const flagBreakdown = [...flagCounts.entries()].sort((a, b) => b[1] - a[1])

  console.log()
  console.log(`Wikipedia source: ${args.source} (revid ${fetched.revid})`)
  console.log(`Parsed: ${allRows.length} rows (${sectionFmt})`)
  console.log(`After dedup: ${newCount} new, ${dupCount} already in DB`)
  console.log(`Auto-approve (new book + ban): ${autoCount}`)
  console.log(`Auto-add-ban  (existing book): ${addBanCount}`)
  console.log(`Review queue:                  ${reviewCount}`)
  for (const [flag, count] of flagBreakdown) {
    console.log(`  - ${count} ${flag}`)
  }

  // ── Dump run details ───────────────────────────────────────────────────
  await fs.mkdir('data/wikipedia-import-runs', { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpPath = path.join('data/wikipedia-import-runs', `${args.source}-${ts}.json`)
  const dumpRows = classified.map(c => ({
    title: c.row.title,
    authors: c.row.authors,
    year: c.row.year,
    state: c.row.state,
    section: c.section.heading,
    notes: c.row.notes_raw,
    quality_flags: c.row.quality_flags,
    reason_mapping: c.reason.mapping,
    reason_flags: c.reason.extra_flags,
    dedup: c.dedup,
    decision_mode: c.decision.mode,
    review_quality_flags:
      c.decision.mode === 'review' ? c.decision.quality_flags : null,
  }))
  await fs.writeFile(
    dumpPath,
    JSON.stringify(
      {
        source: args.source,
        page: config.page,
        revid: fetched.revid,
        fetched_at: fetched.fetched_at,
        per_section_counts: perSection,
        summary: {
          parsed: allRows.length,
          dup: dupCount,
          auto: autoCount,
          auto_add_ban: addBanCount,
          review: reviewCount,
        },
        flag_breakdown: flagBreakdown,
        rows: dumpRows,
      },
      null,
      2,
    ),
  )
  console.log(`\n[output] details written to ${dumpPath}`)

  if (!args.apply) {
    console.log(`\n[dry-run] no DB writes performed`)
    return
  }

  // ── Apply ──────────────────────────────────────────────────────────────
  console.log(`\n[apply] performing writes`)
  const pg = newPgClient()
  await pg.connect()

  let applied = 0
  let queued = 0
  let bansAdded = 0       // new bans created on existing books
  let bansIdempotent = 0  // ban already existed (no-op write)
  let errors = 0
  try {
    const ctx: ImporterContext = {
      sourceConfig: config,
      page: config.page,
      revid: fetched.revid,
    }
    for (const c of classified) {
      try {
        const r = await commitDecision(sb, pg, ctx, c.section, c.decision)
        if (r.mode === 'auto_approve') applied++
        else if (r.mode === 'review') queued++
        else if (r.mode === 'auto_add_ban') {
          if (r.created) bansAdded++
          else bansIdempotent++
        }
      } catch (err) {
        errors++
        console.error(`  [error] ${c.row.title}: ${(err as Error).message}`)
      }
    }
  } finally {
    await pg.end()
  }

  console.log(
    `\n[apply] applied=${applied}, queued=${queued}, ` +
      `bans_added=${bansAdded}, bans_idempotent=${bansIdempotent}, errors=${errors}`,
  )
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
