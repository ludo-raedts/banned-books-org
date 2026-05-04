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
 *   1. ISBN-13        — Open Library + Google Books
 *   2. Cover images   — Open Library + Google Books
 *   3. Gutenberg IDs  — Gutendex API
 *   4. Descriptions   — Open Library + Google Books (GPT fallback built-in)
 *
 *  GPT (skipped with --free-only, costs API credits):
 *   5. Descriptions (GPT fallback for books OL/GB couldn't find)
 *   6. Ban descriptions
 *   7. Censorship context
 *   8. Ban reason classification
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts
 *     → dry-run: shows eligible counts per step, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply
 *     → run all steps including GPT
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only
 *     → run only free steps (no OpenAI cost)
 *   npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50
 *     → cap each GPT step at 50 books (useful for incremental runs)
 */

import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const APPLY      = process.argv.includes('--apply')
const FREE_ONLY  = process.argv.includes('--free-only')
const GPT_LIMIT  = (() => {
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
}

const steps: Step[] = [
  {
    name: 'ISBN-13',
    script: 'enrich-isbn.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
  },
  {
    name: 'Cover images',
    script: 'enrich-covers-continuous.ts',
    // --once = single pass (don't loop); also uses ISBN-13 which we enrich in step 1
    args: APPLY ? ['--once'] : ['--once'],
    gpt: false,
    alwaysWrites: true,
  },
  {
    name: 'Gutenberg IDs',
    script: 'enrich-gutenberg.ts',
    args: [],
    gpt: false,
    alwaysWrites: true,
  },
  {
    name: 'Book descriptions (OL / Google Books)',
    script: 'enrich-descriptions.ts',
    args: APPLY ? ['--apply'] : [],
    gpt: false,
  },
  {
    name: 'Book descriptions (GPT fallback)',
    script: 'enrich-descriptions-gpt.ts',
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
  const mode = APPLY
    ? (FREE_ONLY ? 'APPLY — free steps only' : `APPLY — all steps (GPT limit: ${GPT_LIMIT}/step)`)
    : 'DRY-RUN'

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
    const skip = step.gpt && FREE_ONLY

    banner(`${num} ${step.name}${tag}${skip ? '  — skipped' : ''}`)

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
