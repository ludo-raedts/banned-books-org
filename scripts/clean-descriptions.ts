/**
 * Wrapper voor de quality-remediation pijplijn: één commando, twee stappen.
 *
 *   1. strip-filler-sentences.ts — free, regex. Schrapt filler-zinnen en
 *      filler-clauses uit description_ban + censorship_context, NULLt
 *      velden die ná stripping te kort zijn, en schrijft een
 *      filler-strip-needs-rewrite-<ts>.csv met de slugs die hertekend
 *      moeten worden.
 *
 *   2. rewrite-descriptions-grounded.ts — gpt-4.1-mini + web_search.
 *      Pikt vanzelf de net-geproduceerde needs-rewrite CSV op en herschrijft
 *      de zwakke velden met gegronde, named-case copy.
 *
 * Backups + logs landen in data/ (filler-strip-* en description-*).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts                 # dry-run preview
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --strip-only
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --slug=defy-me
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const APPLY      = process.argv.includes('--apply')
const STRIP_ONLY = process.argv.includes('--strip-only')
const slugArg    = process.argv.find(a => a.startsWith('--slug='))
const SLUG       = slugArg?.split('=')[1] ?? null

const DATA = path.resolve(process.cwd(), 'data')

function run(label: string, scriptPath: string, args: string[]) {
  console.log(`\n══ ${label} ══`)
  const cmd = ['tsx', '--env-file=.env.local', scriptPath, ...args]
  console.log(`   npx ${cmd.join(' ')}\n`)
  const result = spawnSync('npx', cmd, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} exited with code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

function newestNeedsRewriteCsv(): string | null {
  if (!fs.existsSync(DATA)) return null
  const files = fs.readdirSync(DATA)
    .filter(f => f.startsWith('filler-strip-needs-rewrite-') && f.endsWith('.csv'))
    .map(f => ({ f, mtime: fs.statSync(path.join(DATA, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? path.join(DATA, files[0].f) : null
}

function csvHasDataRows(p: string): boolean {
  const content = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  return content.length > 1
}

function main() {
  console.log(`── clean-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (STRIP_ONLY) console.log('  Mode: strip-only — LLM-stap wordt overgeslagen')
  if (SLUG)       console.log(`  Filter: --slug=${SLUG}`)

  // Track the latest needs-rewrite CSV that existed BEFORE strip ran, so we
  // can tell whether strip produced a new one.
  const preExistingCsv = newestNeedsRewriteCsv()

  // ── Stap 1 — strip-filler-sentences
  const stripArgs: string[] = []
  if (APPLY) stripArgs.push('--apply')
  if (SLUG)  stripArgs.push(`--slug=${SLUG}`)
  run('Stap 1/2  strip-filler-sentences.ts (free, regex)', 'scripts/strip-filler-sentences.ts', stripArgs)

  if (!APPLY) {
    console.log('\n──')
    console.log('DRY-RUN — strip-filler heeft samples gepreviewd. De rewrite-stap')
    console.log('vereist het CSV-bestand dat strip alleen in --apply mode produceert,')
    console.log('dus voer dit commando met --apply uit om beide stappen te draaien.')
    return
  }

  if (STRIP_ONLY) {
    console.log('\n--strip-only: rewrite-stap overgeslagen. Klaar.')
    return
  }

  // ── Stap 2 — rewrite-descriptions-grounded op de needs-rewrite CSV
  const csv = newestNeedsRewriteCsv()
  if (!csv || csv === preExistingCsv) {
    console.log('\nGeen nieuwe needs-rewrite CSV gevonden — niets te herschrijven. Klaar.')
    return
  }
  if (!csvHasDataRows(csv)) {
    console.log(`\n${csv} bevat alleen een header — niets te herschrijven. Klaar.`)
    return
  }
  console.log(`\nNeeds-rewrite CSV opgepakt: ${path.relative(process.cwd(), csv)}`)

  const rewriteArgs = [`--audit=${csv}`, '--apply']
  if (SLUG) rewriteArgs.push(`--slug=${SLUG}`)
  run('Stap 2/2  rewrite-descriptions-grounded.ts (gpt-4.1-mini + web_search)',
    'scripts/rewrite-descriptions-grounded.ts', rewriteArgs)

  console.log('\n══ klaar ══')
  console.log('Backups + logs: data/filler-strip-* en data/description-*')
}

main()
