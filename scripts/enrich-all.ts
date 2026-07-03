/**
 * Master enrichment pipeline — fills all open fields across the catalogue.
 *
 * Run this after adding new books, or periodically to keep data fresh.
 * Idempotent — every step only touches records with empty fields. Wraps the
 * whole run in a before/after coverage snapshot and a confidence-rollback pass.
 * nohup-safe: `nohup npx tsx --env-file=.env.local scripts/enrich-all.ts --apply &`.
 *
 * Phase 1 — PARALLEL free-harvest (concurrent, process-isolated; a quota stop
 * or crash in one source never aborts the others):
 *   • OL harvest      — cover / first-published-year / sibling-ISBN, exact-key, free
 *   • GB harvest      — orphan ISBN / cover, Google Books, daily-cap-aware
 *   • Native titles   — title_native + script, Wikidata, non-English books
 *
 * Phase 2 — SEQUENTIAL steps:
 *  Free (no API cost):
 *   1. Cover images (v2)    — title-only / Wikipedia retries with pHash placeholder rejection
 *   2. Gutenberg IDs        — Gutendex API  (slow; skip with --no-gutenberg)
 *   3. archive.org IDs      — Advanced Search API (slow; skip with --no-archive)
 *   4. Descriptions (v2)    — Wikipedia + Open Library + Google Books with
 *                             title-fuzz + author-surname cross-check.
 *                             Includes grounded LLM synthesis unless --free-only.
 *  GPT (skipped with --free-only, costs API credits):
 *   5. Genres   6. Ban descriptions   7. Censorship context   8. Ban reason classification
 *
 * Then: confidence audit + auto-rollback (native-title namesake/leading-article
 * scoring + isbn/cover structural re-verify) → before/after coverage report
 * (data/enrichment-coverage-report-<date>.md). Per-run logs/snapshots go to the
 * gitignored data/enrich-run/<stamp>/.
 *
 * History (2026-06-16): folded the standalone parallel supervisor
 * (enrich-parallel.sh) in here as Phase 1; dropped the old sequential enrich-isbn
 * + covers-continuous first-pass (the harvesters supersede them).
 *
 * History (2026-05-28): the previous step 6 (v1 OL/GB only) + step 7
 * (free-form GPT fallback) caused widespread hallucination across the
 * catalogue. They are now collapsed into the single v2 step which
 * grounds every LLM call on cited sources.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts
 *     → dry-run: shows eligible counts per step, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply
 *     → run all steps including GPT
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only
 *     → run only free steps (no OpenAI cost)
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg
 *     → skip the slow Gutenberg lookup step
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-archive
 *     → skip the slow archive.org lookup step
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50
 *     → cap each GPT step at 50 books (useful for incremental runs)
 *   --native-limit=N   cap the Phase-1 native-titles sweep (default 99999 = full)
 *   --threshold=0.5    confidence threshold for the rollback auditor
 */

import { spawn, spawnSync } from 'child_process'
import fs from 'node:fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { catalogReminder } from './audit-scripts-catalog'
import { captureCoverage } from './enrich-coverage-snapshot'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const APPLY        = process.argv.includes('--apply')
const FREE_ONLY    = process.argv.includes('--free-only')
const NO_GUTENBERG = process.argv.includes('--no-gutenberg')
const NO_ARCHIVE   = process.argv.includes('--no-archive')
const GPT_LIMIT    = (() => {
  const a = process.argv.find(x => x.startsWith('--gpt-limit='))
  return a ? parseInt(a.split('=')[1], 10) : 150
})()

const ROOT = resolve(__dirname, '..')
const TSX  = resolve(ROOT, 'node_modules/.bin/tsx')
const ENV  = resolve(ROOT, '.env.local')

// ── Step definitions ──────────────────────────────────────────────────────────

type Step = {
  name: string
  script: string
  args: string[]
  gpt: boolean
  alwaysWrites?: boolean  // scripts with no dry-run mode
  gutenberg?: boolean     // skipped with --no-gutenberg
  archive?: boolean       // skipped with --no-archive
}

// ── Phase 1: parallel free-harvest ─────────────────────────────────────────────
// ISBN + cover + first-published-year + native-title, from three sources that
// are DISJOINT by construction (ol-harvest = keyable books, gb-harvest =
// orphans, native-titles = non-English), so they run CONCURRENTLY with zero
// write contention. Each is skip-cached (only-when-NULL + *_checked_at) and
// cursor-checkpointed → interruption never reprocesses a completed row; and
// each is its OWN process, so a quota stop (gb 429) or crash in one never
// aborts the others. This phase replaces the old sequential enrich-isbn +
// covers-continuous first-pass (the harvesters supersede them — no double
// ISBN/cover path) and adds native-titles, which enrich-all never ran.
const NATIVE_LIMIT = (() => {
  const a = process.argv.find(x => x.startsWith('--native-limit='))
  return a ? a.split('=')[1] : '99999'
})()
const CONFIDENCE_THRESHOLD = (() => {
  const a = process.argv.find(x => x.startsWith('--threshold='))
  return a ? a.split('=')[1] : '0.5'
})()

const harvestSteps: Array<{ name: string; logName: string; script: string; args: string[] }> = [
  { name: 'OL harvest (cover/year/isbn, exact-key, free)', logName: 'ol-harvest',
    script: 'enrich-ol-harvest.ts', args: APPLY ? ['--apply'] : [] },
  { name: 'GB harvest (orphan isbn/cover, daily-cap-aware)', logName: 'gb-harvest',
    script: 'enrich-gb-harvest.ts', args: APPLY ? ['--apply'] : [] },
  { name: 'Native titles (Wikidata, non-English)', logName: 'native-titles',
    script: 'enrich-native-titles.ts', args: APPLY ? ['--apply', `--limit=${NATIVE_LIMIT}`] : [] },
]

// Kobo product links write their own column pair (kobo_url/kobo_checked_at,
// sticky NULL-targeting) — disjoint from the other harvesters, so it joins
// Phase 1. Included only when the Rakuten credentials are configured; a
// missing token would otherwise hard-exit the child. NOTE: only the API
// tier — enrich-kobo-links-site.ts (Firecrawl, paid credits) stays manual,
// like CourtListener.
if (process.env.RAKUTEN_CLIENT_ID && process.env.RAKUTEN_CLIENT_SECRET && process.env.RAKUTEN_SID) {
  harvestSteps.push({
    name: 'Kobo ebook links (Rakuten Product Search)', logName: 'kobo-links',
    script: 'enrich-kobo-links.ts', args: APPLY ? ['--apply'] : [],
  })
} else {
  console.log('  ⚠ Kobo links skipped: RAKUTEN_CLIENT_ID/SECRET/SID not all set in env')
}

const steps: Step[] = [
  {
    name: 'Cover images (v2 retries + placeholder rejection)',
    script: 'enrich-covers-v2.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
  },
  {
    name: 'Gutenberg IDs',
    script: 'enrich-gutenberg.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
    gutenberg: true,
  },
  {
    name: 'archive.org IDs',
    script: 'enrich-archive-org.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
    archive: true,
  },
  {
    // Runs AFTER Phase 1 so freshly-harvested isbn13s get probed. Default
    // mode only touches bookshop_status NULL rows (incremental, ~1 req/s);
    // full re-probes stay manual via --stale-before. The deep-vs-storefront
    // link choice on every book page depends on this status.
    name: 'Bookshop deep-link probe (new ISBNs only)',
    script: 'probe-bookshop-isbn.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
  },
  {
    // ⚠️ 2026-05-28: v2 replaces the previous two-step combo (v1 +
    // standalone GPT fallback). v2 does:
    //   - Wikipedia (EN + langlinks) + OpenLibrary + Google Books as
    //     ground truth, with title-fuzz + author-surname cross-check.
    //   - LLM-grounded synthesis ONLY when ≥2 sources confirm; never
    //     free-form generation from the model's training knowledge.
    //   - Records description_source_url + description_source_type for
    //     provenance; sets data_quality_status='confident' for cross-
    //     confirmed rows.
    //   - Skips rows the judge flagged unless --process-flagged.
    name: 'Book descriptions (multi-source v2 + grounded LLM)',
    script: 'enrich-descriptions-v2.ts',
    args: APPLY
      ? (FREE_ONLY
          ? ['--apply', '--concurrency=5']                                  // OL + GB + Wikipedia, no LLM
          : ['--apply', '--allow-llm', '--concurrency=5'])                  // also enables grounded LLM synthesis
      : [],
    gpt: false,                                                             // v2 is safe even with LLM, runs in --free-only too
  },
  {
    name: 'Genres (GPT)',
    script: 'enrich-genres-gpt.ts',
    args: APPLY ? ['--apply', `--limit=${GPT_LIMIT}`] : [],
    gpt: true,
  },
  {
    name: 'Ban descriptions (GPT)',
    script: 'enrich-ban-descriptions-gpt.ts',
    args: APPLY ? ['--apply', `--limit=${GPT_LIMIT}`] : [],
    gpt: true,
  },
  {
    name: 'Censorship context (GPT)',
    script: 'enrich-censorship-context-gpt.ts',
    args: APPLY ? ['--apply', `--limit=${GPT_LIMIT}`] : [],
    gpt: true,
  },
  {
    name: 'Ban reason classification (GPT)',
    script: 'enrich-reasons.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: true,
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────

function banner(text: string) {
  const line = '─'.repeat(60)
  console.log(`\n${line}`)
  console.log(`  ${text}`)
  console.log(line)
}

function run(step: Step, index: number, total: number): boolean {
  if (step.gpt && FREE_ONLY) {
    console.log(`  ⟶  skipped (--free-only)\n`)
    return true
  }
  if (step.gutenberg && NO_GUTENBERG) {
    console.log(`  ⟶  skipped (--no-gutenberg)\n`)
    return true
  }
  if (step.archive && NO_ARCHIVE) {
    console.log(`  ⟶  skipped (--no-archive)\n`)
    return true
  }
  if (step.alwaysWrites && !APPLY) {
    console.log(`  ⟶  skipped in dry-run (this script always writes)\n`)
    return true
  }

  const scriptPath = resolve(ROOT, 'scripts', step.script)
  const result = spawnSync(TSX, [`--env-file=${ENV}`, scriptPath, ...step.args], {
    stdio: 'inherit',
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    console.error(`\n  ✗ Step failed (exit ${result.status ?? 'unknown'})`)
    return false
  }
  return true
}

// Run the harvest sources concurrently, each detached to its own log file
// (interleaved console stdio would be unreadable). Returns per-source exit
// codes; a non-zero code (e.g. gb quota stop) is reported, never fatal.
function runParallelPhase(runDir: string): Promise<Array<{ name: string; pid: number; log: string; code: number | null }>> {
  const procs = harvestSteps.map(s => {
    const log = `${runDir}/${s.logName}.log`
    const fd = fs.openSync(log, 'w')
    const child = spawn(TSX, [`--env-file=${ENV}`, resolve(ROOT, 'scripts', s.script), ...s.args], {
      stdio: ['ignore', fd, fd],
    })
    console.log(`  ⟶  ${s.name}  (pid ${child.pid}, log ${log})`)
    return { s, child, log }
  })
  return Promise.all(
    procs.map(({ s, child, log }) =>
      new Promise<{ name: string; pid: number; log: string; code: number | null }>(res => {
        child.on('close', code => {
          console.log(`     ${s.logName}: ${code === 0 ? 'done' : `stopped (exit ${code}) — continuing`}`)
          res({ name: s.name, pid: child.pid ?? -1, log, code })
        })
      }),
    ),
  )
}

async function main() {
  const modeBase = APPLY
    ? (FREE_ONLY ? 'APPLY — free steps only' : `APPLY — all steps (GPT limit: ${GPT_LIMIT}/step)`)
    : 'DRY-RUN'
  const skipTags = [
    NO_GUTENBERG ? 'no Gutenberg' : null,
    NO_ARCHIVE ? 'no archive.org' : null,
  ].filter(Boolean)
  const mode = skipTags.length ? `${modeBase} — ${skipTags.join(', ')}` : modeBase

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  enrich-all  [${mode}]`)
  console.log(`${'═'.repeat(60)}`)

  if (!APPLY) {
    console.log(`
  No writes will happen. Each step will show eligible counts.
  Re-run with --apply to fill all open fields.
  `)
  }

  // Per-run artifacts (logs, manifest, before/after snapshots) live here; the
  // dir is gitignored. Only the report .md is committed.
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace(/-/g, '')
  const since = new Date().toISOString()
  const runDir = resolve(ROOT, 'data/enrich-run', stamp)
  fs.mkdirSync(runDir, { recursive: true })

  // ── BEFORE snapshot ──
  banner('Coverage snapshot (before)')
  const before = await captureCoverage()
  fs.writeFileSync(`${runDir}/coverage-before.json`, JSON.stringify(before, null, 2))
  for (const d of before.dims) console.log(`  ${d.label.padEnd(24)} ${d.have}/${d.denom}`)

  // ── PHASE 1: parallel free-harvest ──
  banner('Phase 1 — parallel free-harvest (ol + gb + native-titles, concurrent)')
  const harvest = await runParallelPhase(runDir)
  fs.writeFileSync(
    `${runDir}/manifest.json`,
    JSON.stringify({ startedAt: since, apply: APPLY, sources: harvest.map(h => ({ name: h.name, pid: h.pid, log: h.log })) }, null, 2),
  )

  // ── PHASE 2: sequential steps (covers-v2, gutenberg, archive, descriptions, GPT) ──
  const activeSteps = steps.filter(s => !(s.gpt && FREE_ONLY))
  let failed = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const num = `[${i + 1}/${steps.length}]`
    const tag = step.gpt ? ' (GPT)' : ''
    const skipGpt = step.gpt && FREE_ONLY
    const skipGut = step.gutenberg && NO_GUTENBERG
    const skipArc = step.archive && NO_ARCHIVE
    const skipMsg = skipGpt ? '  — skipped (--free-only)'
                  : skipGut ? '  — skipped (--no-gutenberg)'
                  : skipArc ? '  — skipped (--no-archive)'
                  : ''

    banner(`${num} ${step.name}${tag}${skipMsg}`)

    const ok = run(step, i, steps.length)
    if (!ok) failed++
  }

  console.log(`\n${'═'.repeat(60)}`)
  if (failed === 0) {
    console.log(`  ✓ Pipeline complete${APPLY ? ' — all eligible records enriched' : ' (dry-run)'}`)
  } else {
    console.log(`  ✗ ${failed} step(s) failed — check output above`)
  }
  console.log(`${'═'.repeat(60)}\n`)

  // ── AFTER snapshot ──
  banner('Coverage snapshot (after)')
  const after = await captureCoverage()
  fs.writeFileSync(`${runDir}/coverage-after.json`, JSON.stringify(after, null, 2))

  // ── Confidence audit + auto-rollback (writes confidence.json for the report) ──
  banner('Confidence audit + rollback')
  const nativeReview = resolve(ROOT, `data/native-title-enrichment-${new Date().toISOString().slice(0, 10)}.json`)
  const auditArgs = [
    `--env-file=${ENV}`, resolve(ROOT, 'scripts/audit-enrichment-confidence.ts'),
    `--since=${since}`, `--threshold=${CONFIDENCE_THRESHOLD}`,
  ]
  if (APPLY) auditArgs.push('--apply', `--native-review=${nativeReview}`)
  const audit = spawnSync(TSX, auditArgs, { encoding: 'utf-8' })
  if (audit.stdout) {
    process.stdout.write(audit.stdout)
    const jsonLine = audit.stdout.split('\n').filter(l => l.startsWith('JSON ')).pop()
    if (jsonLine) fs.writeFileSync(`${runDir}/confidence.json`, jsonLine.slice(5))
  }
  if (audit.stderr) process.stderr.write(audit.stderr)

  // ── Report (before/after %) ──
  banner('Coverage report')
  spawnSync(TSX, [
    `--env-file=${ENV}`, resolve(ROOT, 'scripts/enrich-coverage-report.ts'),
    `--before=${runDir}/coverage-before.json`, `--after=${runDir}/coverage-after.json`,
    `--run-dir=${runDir}`, `--out=${resolve(ROOT, `data/enrichment-coverage-report-${new Date().toISOString().slice(0, 10)}.md`)}`,
  ], { stdio: 'inherit' })

  // The storefront lists live on bookshop.org and don't update themselves —
  // after a run that changed ISBNs or bookshop_status, regenerate + upload.
  if (APPLY) {
    console.log(
      '\n  ↻ ISBNs of bookshop_status gewijzigd? Ververs de storefront-lijsten:\n' +
      '    npx tsx --env-file=.env.local scripts/export-bookshop-lists.ts\n' +
      '    → upload de CSV\'s via https://bookshop.org/affiliates/lists\n',
    )
  }

  // Catalog freshness — last thing you see, so new scripts don't rot out of
  // scripts/README.md. Read-only; never affects exit status on its own.
  const reminder = catalogReminder()
  if (reminder) {
    console.log(reminder)
    console.log('')
  }

  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
