/**
 * Master enrichment pipeline — fills all open fields across the catalogue.
 *
 * Run this after adding new books, or periodically to keep data fresh.
 * Executes each enrichment step in order; every step only touches records
 * that still have empty fields (idempotent).
 *
 * Steps
 * ─────
 *  Free (no API cost, always run):
 *   1. ISBN-13              — Open Library + Google Books
 *   2. Cover images         — Open Library + Google Books (first-pass)
 *   3. Cover images (v2)    — title-only / Wikipedia retries with pHash placeholder rejection
 *   4. Gutenberg IDs        — Gutendex API  (slow; skip with --no-gutenberg)
 *   5. archive.org IDs      — Advanced Search API (slow; skip with --no-archive)
 *   6. Descriptions (v2)    — Wikipedia + Open Library + Google Books with
 *                             title-fuzz + author-surname cross-check.
 *                             Includes grounded LLM synthesis unless --free-only.
 *
 *  GPT (skipped with --free-only, costs API credits):
 *   7. Ban descriptions
 *   8. Censorship context
 *   9. Ban reason classification
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
 */

import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

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

const steps: Step[] = [
  {
    name: 'ISBN-13',
    script: 'enrich-isbn.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
  },
  {
    name: 'Cover images (first-pass)',
    script: 'enrich-covers-continuous.ts',
    // --once = single pass (don't loop); also uses ISBN-13 which we enrich in step 1
    args: APPLY ? ['--once'] : ['--once'],
    gpt: false,
    alwaysWrites: true,
  },
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

  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
