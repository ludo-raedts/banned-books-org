// prune-data.ts — retention sweep for local-only run artifacts under data/.
//
// The enrichment/audit scripts leave timestamped run artifacts, backups and
// caches in data/ (all gitignored — see the "enrichment run artifacts" block
// in .gitignore). They pile up to tens of MB and hundreds of files; this
// script deletes the ones older than the retention window. Committed files
// are NEVER touched: anything tracked by git is skipped outright, so the
// deliverable reports stay put even if a pattern accidentally overlaps.
//
// Dry-run by default; --apply deletes. --days=N overrides the 90-day window.
//
//   npx tsx scripts/prune-data.ts            # list what would be deleted
//   npx tsx scripts/prune-data.ts --apply    # delete it
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { isApply, flagValue } from './lib/cli'

const DATA_DIR = path.join(process.cwd(), 'data')
const DAYS = Number(flagValue('days') ?? '90')

// Glob-ish prefixes of known run-artifact families (mirrors .gitignore).
// A file must ALSO be untracked and older than the window to be pruned.
const FAMILIES = [
  'native-title-enrichment-',
  'cover-websearch-',
  'desc-websearch-',
  'bookshop-availability-backup-',
  'bookshop-edition-remediation-backup-',
  'legacy-books-description-backup-',
  'author-birthday-enrichment-',
  'author-links-enrichment-',
  'interview-candidates-',
  'nz-batch-rollback-backup-',
  'enrichment-rollback-',
  'publication-year-fixes-backup-',
  'consensus-descriptions-',
  'author-bio-remediation-',
  'author-ol-writes-',
  'firecrawl-',
  'merge-',
  'vague-pen-rollups-backup-',
  '_', // leading-underscore scratch dumps
]

function trackedFiles(): Set<string> {
  const out = execFileSync('git', ['ls-files', '--', 'data'], { encoding: 'utf8' })
  return new Set(out.split('\n').filter(Boolean).map(p => path.resolve(p)))
}

function main() {
  const apply = isApply()
  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000
  const tracked = trackedFiles()

  const victims: Array<{ file: string; ageDays: number; bytes: number }> = []
  for (const name of fs.readdirSync(DATA_DIR)) {
    const full = path.join(DATA_DIR, name)
    const stat = fs.statSync(full)
    if (!stat.isFile()) continue
    if (tracked.has(path.resolve(full))) continue
    if (!FAMILIES.some(prefix => name.startsWith(prefix))) continue
    if (stat.mtimeMs >= cutoff) continue
    victims.push({ file: name, ageDays: Math.floor((Date.now() - stat.mtimeMs) / 86400000), bytes: stat.size })
  }

  victims.sort((a, b) => b.ageDays - a.ageDays)
  const totalMb = victims.reduce((s, v) => s + v.bytes, 0) / 1024 / 1024

  if (victims.length === 0) {
    console.log(`✓ Nothing to prune (window: ${DAYS}d).`)
    return
  }
  for (const v of victims) {
    console.log(`${apply ? 'rm' : 'zou verwijderen'}  ${String(v.ageDays).padStart(4)}d  ${(v.bytes / 1024).toFixed(0).padStart(7)}K  data/${v.file}`)
    if (apply) fs.unlinkSync(path.join(DATA_DIR, v.file))
  }
  console.log(`\n${apply ? 'Verwijderd' : 'Zou verwijderen'}: ${victims.length} bestanden, ${totalMb.toFixed(1)} MB (ouder dan ${DAYS}d, alleen untracked run-artifacts).`)
  if (!apply) console.log('Draai met --apply om echt te verwijderen.')
}

main()
