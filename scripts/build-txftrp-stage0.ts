/**
 * Stage-0 for the Texas Freedom to Read Project's 2025–26 removal tracker
 * ("One year of SB 12 and SB 13", txftrp.org/one_year_of_sb_12_and_sb_13).
 *
 * Source: a public Google Sheet, one row per district × title, built from
 * districts' public-information releases (each row links its PDF on Drive in
 * `Source`). PEN America credits TXFTRP's records requests and the sheet carries
 * a "PEN Status" column, so it is a PEN feeder like Magnusson: the output goes
 * through import-magnusson-delta.ts (per-district dedup, any year), NOT import-pen.
 *
 * Mapping:
 *   - PEN Status "Banned by Restriction" → restricted, "Banned…" → banned; rows without a
 *     PEN Status: Status "Removed …" → banned, "Restricted …" (aged up / AP / HS only) → restricted
 *   - PEN Status "OUT OF SCOPE" and Date "NOT (FOR) PEN" rows are dropped (PEN's own call)
 *   - title = PEN TITLE when filled (normalised), else Title; authors "Last, First" → parseAuthors
 *   - year = the row's Date (Aug–Dec 2026 = typo for 2025, the tracker ends mid-2026);
 *     no usable date → 2025, start of the 2025–26 school year
 *
 *   curl -sL 'https://docs.google.com/spreadsheets/d/1QuzHQw_dA2BJva288X3E0HDnFDnX5vY8PvsSa-0lYJo/export?format=csv' \
 *     -o data/txftrp/txftrp-2026-11-03.csv
 *   npx tsx scripts/build-txftrp-stage0.ts --in=data/txftrp/txftrp-2026-11-03.csv
 *   → data/txftrp/stage0-2026-11-03.json, then:
 *   npx tsx --env-file=.env.local scripts/import-magnusson-delta.ts --in=data/txftrp/stage0-2026-11-03.json \
 *     --out-dir=data/txftrp --batch-source-name="$TXFTRP_NAME" --batch-source-url=$TXFTRP_URL \
 *     --row-source-name="Texas school district public-information release (via Texas Freedom to Read Project)" \
 *     --batch-label="the Texas Freedom to Read Project's 2025–26 removal tracker"
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { flagValue } from './lib/cli'
import { parseAuthors, PLACEHOLDER_TITLE, type Stage0Row } from './build-magnusson-stage0'

export const TXFTRP_SOURCE_NAME = 'Texas Freedom to Read Project — One year of SB 12 and SB 13 (2025–26 removal tracker)'
export const TXFTRP_SOURCE_URL = 'https://www.txftrp.org/one_year_of_sb_12_and_sb_13'

const IN = flagValue('in') ?? 'data/txftrp/txftrp-2026-11-03.csv'
const OUT = IN.replace(/txftrp-(\d{4}-\d{2}-\d{2})\.csv$/, 'stage0-$1.json')

// Minimal RFC-4180 parser (quoted fields with commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') q = false; else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function banYear(raw: string): number {
  const d = raw.trim().toLowerCase()
  let year: number | null = null
  let month = -1
  const full = d.match(/\b(20\d\d)\b/)
  if (full) year = Number(full[1])
  else {
    const short = d.match(/^([a-z]{3})[a-z]*-(\d{2})$/) // "Dec-25"
    if (short) { year = 2000 + Number(short[2]); month = MONTHS.indexOf(short[1]) }
  }
  if (month < 0) month = MONTHS.findIndex(m => d.startsWith(m) || d.includes(`/${MONTHS.indexOf(m) + 1}/`))
  const slash = d.match(/^(\d{1,2})\/\d{1,2}\/(20\d\d)$/)
  if (slash) month = Number(slash[1]) - 1
  if (year === 2026 && month >= 7) return 2025 // "December 2026" etc. — tracker ends mid-2026
  return year === 2025 || year === 2026 ? year : 2025
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

// Several districts pasted library-catalogue (MARC) records: "Howe, Marie, 1950-",
// "edited by Dahlia Adler.", "D. A. (Douglas A.) Powell", "John. Green".
const UNKNOWN_AUTHOR = /^(unknown|unspecified|unlisted|n\/?a|various)\b/i
function cleanAuthorField(raw: string): string {
  return raw
    .replace(/,?\s*\d{4}-(\d{4})?\.?/g, '')          // life dates
    .replace(/\b(edited|compiled|illustrated|translated) by\s+/gi, '')
    .replace(/,?\s*et al\.?/gi, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')                   // fuller-form expansions
    .replace(/\b([A-Z][a-z]{2,})\.(?=\s)/g, '$1')       // "John. Green"
    .replace(/[.,;\s]+$/, '')
}
const fixAuthor = (a: string) => a.replace(/\b([A-Z][a-z]{2,})\.(?=\s|$)/g, '$1').replace(/\.$/, '').trim()

// Catalogue sentence case ("The dangerous gift", "Pirate latitudes : a novel") →
// title case; " : " → ": "; generic ": a novel" subtitles dropped.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'the', 'to', 'with', 'vs'])
function cleanTitle(t: string): string {
  let s = t.replace(/\s+:\s+/g, ': ').replace(/:\s*(a|an)\s+(novel|memoir|graphic novel)$/i, '').trim()
  const words = s.split(' ')
  const sentenceCase = words.length > 1 && !/[A-Z]/.test(words.slice(1).join(' ').replace(/(^|:\s)[A-Z]/g, ''))
  if (sentenceCase) {
    s = words
      .map((w, i) => (i > 0 && SMALL.has(w) && !words[i - 1].endsWith(':') ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
  }
  return s
}

function main() {
  const [header, ...data] = parseCsv(readFileSync(IN, 'utf8'))
  const col = (name: string) => {
    const i = header.findIndex(h => h.trim() === name)
    if (i < 0) throw new Error(`column "${name}" missing — sheet layout changed`)
    return i
  }
  const C = {
    district: col('School District'), title: col('Title'), penTitle: col('PEN TITLE'), author: col('Author'),
    date: col('Date'), penStatus: col('PEN Status'), status: col('Status'), source: col('Source'),
    hb900: col('HB 900'), sb13: col('SB 13'), sb12: col('SB 12'),
  }
  const out: Stage0Row[] = []
  const skip: Record<string, number> = {}
  const bump = (k: string) => (skip[k] = (skip[k] ?? 0) + 1)

  for (const r of data) {
    if (r.length < header.length - 2 || !clean(r[C.district] ?? '')) { bump('blank-row'); continue }
    const status = clean(r[C.status])
    const penStatus = clean(r[C.penStatus])
    const date = clean(r[C.date])
    if (penStatus === 'OUT OF SCOPE') { bump('pen-out-of-scope'); continue }
    if (/^not (for )?pen$/i.test(date)) { bump('not-for-pen'); continue }
    // PEN's classification wins when present ("Removed from Elementary Collection"
    // is "Banned by Restriction" there); otherwise the tracker's own Status.
    const action =
      penStatus === 'Banned by Restriction' ? 'restricted'
      : /^Banned/.test(penStatus) ? 'banned'
      : /^removed/i.test(status) ? 'banned' : /^restricted/i.test(status) ? 'restricted' : null
    if (!action) { bump(`status:${status || 'empty'}`); continue }

    const title = cleanTitle(clean(clean(r[C.penTitle]) || clean(r[C.title])).replace(/^"(.*)"$/, '$1').replace(/\s*\([A-Z]{2,3}\)\s*$/, ''))
    const authorRaw = cleanAuthorField(clean(r[C.author]))
    if (UNKNOWN_AUTHOR.test(authorRaw)) { bump('author-unknown'); continue } // title-only matching is namesake-prone
    const authors = parseAuthors(authorRaw, '').map(fixAuthor).filter(Boolean)
    if (!title || !authors.length) { bump('no-title-or-author'); continue }
    if (PLACEHOLDER_TITLE.test(title)) { bump('placeholder'); continue }

    const statutes = [['HB 900', C.hb900], ['SB 13', C.sb13], ['SB 12', C.sb12]]
      .filter(([, i]) => clean(r[i as number]) === 'TRUE').map(([n]) => n)
    out.push({
      magnusson_id: null,
      title,
      authors,
      country_code: 'US',
      region: 'Texas',
      institution: clean(r[C.district]),
      year: banYear(date),
      scope_slug: 'school',
      action_type: action,
      reason_slug: 'other',
      source_url: /^https?:\/\//.test(clean(r[C.source])) ? clean(r[C.source]) : null,
      source_name: TXFTRP_SOURCE_NAME,
      decision_raw: [status, statutes.length ? `statutes: ${statutes.join(', ')}` : '', penStatus && `PEN: ${penStatus}`, date && `date: ${date}`]
        .filter(Boolean).join(' | '),
    })
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  const by = (k: keyof Stage0Row) => out.reduce<Record<string, number>>((a, r) => ((a[String(r[k])] = (a[String(r[k])] ?? 0) + 1), a), {})
  console.log(`${data.length} sheet rows → ${out.length} stage-0 rows → ${OUT}`)
  console.log('skipped', skip)
  console.log('action', by('action_type'), 'year', by('year'))
  console.log('distinct titles', new Set(out.map(r => r.title.toLowerCase())).size)
}

main()
