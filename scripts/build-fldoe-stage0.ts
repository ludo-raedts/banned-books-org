/**
 * Stage-0 for the Florida Department of Education's annual report of school
 * library/classroom materials removed or discontinued after a parent/resident
 * objection — §1006.28(2)(e), Florida Statutes (HB 1069). One PDF per school
 * year, e.g. 2025–26: https://www.fldoe.org/file/5574/2526-SDRPS.pdf
 *
 * The PDF is a public state report, but fldoe.org's Akamai front refuses
 * non-browser downloads: save it from a browser into data/fldoe/ first.
 *
 *   pdftotext -layout data/fldoe/2526-SDRPS.pdf data/fldoe/2526-SDRPS.txt
 *   npx tsx scripts/build-fldoe-stage0.ts --in=data/fldoe/2526-SDRPS.txt --date=2026-11-09
 *   → data/fldoe/stage0-2026-11-09.json, then (same per-district dedup as Magnusson/TXFTRP):
 *   npx tsx --env-file=.env.local scripts/import-magnusson-delta.ts --in=data/fldoe/stage0-2026-11-09.json \
 *     --out-dir=data/fldoe --batch-source-name="$FLDOE_NAME" --batch-source-url=$FLDOE_URL \
 *     --row-source-name="Florida Department of Education — §1006.28(2) district report" \
 *     --batch-label="the Florida Department of Education's 2025–26 district removal report"
 *
 * Layout (pdftotext -layout): a district name on its own line, then either
 * "None Removed or Discontinued" or one or more "Grades …" headers followed by
 * "Title<2+ spaces>Author" rows. Every listed title was removed or discontinued
 * → action_type banned, year = start of the school year.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { flagValue } from './lib/cli'
import { parseAuthors, type Stage0Row } from './build-magnusson-stage0'

export const FLDOE_SOURCE_NAME = 'Florida Department of Education — 2025–26 School District Reporting Pursuant to Section 1006.28(2), F.S.'
export const FLDOE_SOURCE_URL = 'https://www.fldoe.org/file/5574/2526-SDRPS.pdf'

const IN = flagValue('in') ?? 'data/fldoe/2526-SDRPS.txt'
const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const YEAR = Number(flagValue('year') ?? 2025)
const OUT = `data/fldoe/stage0-${DATE}.json`

// The 67 county districts plus the state's lab/virtual/special schools.
const COUNTIES = ['Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River', 'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee', 'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota', 'Seminole', 'St. Johns', 'St. Lucie', 'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington']
const isSpecialSchool = (s: string) => /Lab School|Virtual School|Scholars Academy|School for the Deaf/.test(s)
// Districts whose name in our PEN-era rows is not "<County> County School District";
// keep one name per district so institution contexts and the per-district dedup line up.
const DISTRICT_NAMES: Record<string, string> = {
  Collier: 'Collier County Public Schools',
  Escambia: 'Escambia County Public Schools',
  Hernando: 'Hernando County Schools',
  'Indian River': 'Indian River County Schools',
  Lake: 'Lake County Schools',
  Leon: 'Leon County Schools',
  Manatee: 'School District of Manatee County',
  Orange: 'Orange County Public Schools',
  Polk: 'Polk County Public Schools',
  'Santa Rosa': 'Santa Rosa County Schools',
  'St. Lucie': 'St. Lucie Public Schools',
}
const institutionFor = (d: string) =>
  isSpecialSchool(d) ? d : DISTRICT_NAMES[d] ?? `${d} County School District`

function main() {
  const lines = readFileSync(IN, 'utf8').split('\n')
  const out: Stage0Row[] = []
  const odd: string[] = []
  let district: string | null = null
  let grades: string | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const cells = line.split(/\s{2,}/)
    if (cells.length === 1) {
      if (COUNTIES.includes(line) || isSpecialSchool(line)) { district = line; grades = null; continue }
      if (/^Grades?\b/.test(line)) { grades = line; continue }
      if (/^None Removed/.test(line)) continue
      if (district) odd.push(`${district}: ${line}`)
      continue
    }
    if (!district || !grades) continue // title block / column header
    if (cells.length !== 2) { odd.push(`${district}: ${line}`); continue }
    const [title, author] = cells
    const authors = parseAuthors(author, '')
    if (!authors.length) { odd.push(`${district}: no author: ${line}`); continue }
    out.push({
      magnusson_id: null,
      title,
      authors,
      country_code: 'US',
      region: 'Florida',
      institution: institutionFor(district),
      year: YEAR,
      scope_slug: 'school',
      action_type: 'banned',
      reason_slug: 'other',
      source_url: FLDOE_SOURCE_URL,
      source_name: FLDOE_SOURCE_NAME,
      decision_raw: `Removed or discontinued (${grades}) after a parent/resident objection — FDOE §1006.28(2) report`,
    } as Stage0Row)
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  const perDistrict: Record<string, number> = {}
  for (const r of out) perDistrict[r.institution!] = (perDistrict[r.institution!] ?? 0) + 1
  console.log(`${out.length} rows → ${OUT}`)
  console.table(perDistrict)
  if (odd.length) console.log(`UNPARSED (${odd.length}):\n  ${odd.join('\n  ')}`)
}

main()
