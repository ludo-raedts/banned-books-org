/**
 * Second-pass author photo enrichment for authors where Wikipedia-search came
 * up empty (in enrich-author-bios.ts --photos-only).
 *
 * Sources, in order:
 *   1. Wikidata — wbsearchentities → P31=Q5 (human) + writer-ish P106 → P18 → Commons thumbnail
 *   2. OpenLibrary — /search/authors fallback, HEAD-checked
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts                  # dry-run, 50 authors
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --limit=10       # cap at 10
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --apply          # write to DB
 *
 * Writes a CSV log to data/photo-enrichment-{timestamp}.csv so you can spot-
 * check matches before/after applying. Core logic lives in
 * src/lib/enrich/author-photos.ts.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { enrichAuthorPhotos } from '../src/lib/enrich/author-photos'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.replace('--limit=', ''), 10) : 50

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function main() {
  console.log(`\n── enrich-author-photos-v2 (${APPLY ? 'APPLY' : 'DRY-RUN'}, limit=${LIMIT}) ──\n`)

  const result = await enrichAuthorPhotos({
    apply: APPLY,
    limit: LIMIT,
    onProgress: msg => console.log(msg),
  })

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const csvPath = path.join(process.cwd(), 'data', `photo-enrichment-${ts}.csv`)
  fs.mkdirSync(path.dirname(csvPath), { recursive: true })
  const rows = ['display_name,source,url,meta']
  for (const s of result.results) {
    rows.push([csvEscape(s.name), csvEscape(s.source), csvEscape(s.url), csvEscape(s.meta)].join(','))
  }
  fs.writeFileSync(csvPath, rows.join('\n') + '\n', 'utf8')

  console.log(`\n── Done ──`)
  console.log(`Accepted : ${result.accepted}  (wikidata=${result.bySource.wikidata} ol=${result.bySource.openlibrary})`)
  console.log(`Skipped  : ${result.skipped}`)
  console.log(`Errors   : ${result.errors}`)
  console.log(`CSV log  : ${path.relative(process.cwd(), csvPath)} (${result.results.length} rows)`)
  if (!APPLY) console.log(`\nDry-run complete. Re-run with --apply to write to DB.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
