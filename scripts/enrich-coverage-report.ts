/**
 * enrich-coverage-report.ts — render the before/after coverage report for a
 * parallel-enrichment run. The DB snapshots are the source of truth for the
 * deltas (not the enrichers' stdout, which is informational only).
 *
 * Inputs:
 *   --before=<coverage-before.json>   (required; from enrich-coverage-snapshot --snapshot=)
 *   --after=<coverage-after.json>     (required)
 *   --run-dir=<dir>                   (optional; to embed manifest + log links + confidence.json)
 *   --out=<report.md>                 (default data/enrichment-coverage-report-<date>.md)
 *
 * Usage:
 *   npx tsx scripts/enrich-coverage-report.ts --before=.../coverage-before.json --after=.../coverage-after.json --run-dir=...
 */
import fs from 'node:fs'
import { flagValue } from './lib/cli'

interface Snap {
  capturedAt: string
  total: number
  nonEnglish: number
  dims: Array<{ key: string; label: string; have: number; denom: number; gap: number }>
}

const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'))
const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100)

function main() {
  const beforePath = flagValue('before')
  const afterPath = flagValue('after')
  if (!beforePath || !afterPath) {
    console.error('need --before= and --after= snapshot paths')
    process.exit(1)
  }
  const before: Snap = read(beforePath)
  const after: Snap = read(afterPath)
  const runDir = flagValue('run-dir')
  const date = after.capturedAt.slice(0, 10)
  const out = flagValue('out') ?? `data/enrichment-coverage-report-${date}.md`

  const lines: string[] = []
  lines.push(`# Enrichment coverage report — ${date}`)
  lines.push('')
  lines.push(`Catalogue: **${after.total} books** (${after.nonEnglish} non-English originals).`)
  lines.push(`Before: ${before.capturedAt} · After: ${after.capturedAt}`)
  lines.push('')
  lines.push('| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const a of after.dims) {
    const b = before.dims.find((x) => x.key === a.key)
    const bHave = b?.have ?? 0
    const bPct = pct(bHave, b?.denom ?? a.denom)
    const aPct = pct(a.have, a.denom)
    const delta = a.have - bHave
    lines.push(
      `| ${a.label} | ${bHave} | ${a.have} | ${delta >= 0 ? '+' : ''}${delta} | ` +
        `${bPct.toFixed(1)}% | ${aPct.toFixed(1)}% | ${a.gap} |`,
    )
  }
  lines.push('')
  lines.push('_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._')
  lines.push('')

  // Confidence / rollback summary, if the auditor wrote one.
  const confPath = runDir ? `${runDir}/confidence.json` : null
  if (confPath && fs.existsSync(confPath)) {
    const c = read(confPath)
    lines.push('## Confidence audit & rollback')
    lines.push('')
    lines.push(`Threshold ${c.threshold} · applied=${c.apply}.`)
    lines.push(`Reverted **${c.total}** low-confidence/invalid writes ` +
      `(native-title ${c.native?.reverted ?? 0}, cover ${c.structural?.coverReverted ?? 0}, isbn ${c.structural?.isbnReverted ?? 0}).`)
    lines.push('')
  }

  // Per-source run manifest / logs.
  if (runDir && fs.existsSync(`${runDir}/manifest.json`)) {
    const m = read(`${runDir}/manifest.json`)
    lines.push('## Run')
    lines.push('')
    lines.push(`Started ${m.startedAt}. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):`)
    lines.push('')
    for (const s of m.sources ?? []) {
      lines.push(`- **${s.name}** — pid ${s.pid}, log \`${s.log}\``)
    }
    lines.push('')
  }

  fs.writeFileSync(out, lines.join('\n'))
  console.log(`report → ${out}`)
  console.log('\n' + lines.join('\n'))
}

main()
