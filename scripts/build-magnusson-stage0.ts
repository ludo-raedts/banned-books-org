/**
 * Stage-0 builder for the Magnusson Book Censorship Database (Dr. Tasslyn
 * Magnusson / EveryLibrary Institute) — "Censorship Database - FOR
 * DISTRIBUTION.xlsx", shared by the author on 2026-10-09 (permission by e-mail
 * 2026-08-05 to reference with attribution; see data/outreach-tracker.md §K).
 *
 * Input:  data/magnusson/db.json — the `01_Database` sheet exported to JSON
 *         (raw export is gitignored: shared privately, attribution-only).
 * Output: data/magnusson/stage0-<date>.json — one row per book × institution ×
 *         ban-event, ONLY for decisions that are real bans/restrictions
 *         (user decision 2026-10-10: challenges that were retained/pending and
 *         "Weeded/Deselected" are out of scope, PEN doctrine).
 *
 * Magnusson is PEN's upstream feeder, so the importer
 * (import-magnusson-delta.ts) skips everything already present per district.
 *
 * Usage:
 *   npx tsx scripts/build-magnusson-stage0.ts [--in=data/magnusson/db.json] [--date=2026-10-09]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { flagValue } from './lib/cli'

const IN = flagValue('in') ?? 'data/magnusson/db.json'
const DATE = flagValue('date') ?? '2026-10-09'
const OUT = `data/magnusson/stage0-${DATE}.json`

export const MAGNUSSON_SOURCE_NAME = 'Magnusson Book Censorship Database (EveryLibrary Institute)'
export const MAGNUSSON_SOURCE_URL = 'https://www.everylibraryinstitute.org/book_censorship_database_magnusson'

const STATES: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' }

const BANNED = new Set(['Banned/Removed', 'Removed', 'Banned/Do Not Order', 'Banned', 'Withdrawn', 'Removed - Curriculum', 'Banned From Library'])
const RESTRICTED = new Set(['Retained/Restricted', 'Reshelved - Adult', 'Stickered'])

// Placeholder rows — a series or a bare subject heading, not one identifiable book (scope gate).
const PLACEHOLDER_TITLE = /title (not |un)specified|no further information|title only|\(series\)|\(unknown edition\)|\(vol\. not specified\)|^unspecified series|series\?$/i
const PLACEHOLDER_AUTHOR = /^(n\/a|unknown|movie|no author specified|no further information available|various)$/i

type Raw = Record<string, string | number | null>
export type Stage0Row = {
  magnusson_id: number | null
  title: string
  authors: string[]
  country_code: 'US'
  region: string
  institution: string
  year: number
  scope_slug: 'school' | 'public_library' | 'government'
  action_type: 'banned' | 'restricted'
  reason_slug: 'other'
  source_url: string | null
  source_name: string
  decision_raw: string
}

const s = (v: unknown) => (v == null ? '' : String(v).trim())

// "Maas, Sarah J." → "Sarah J. Maas"; "Kendi, Ibram X. and Reynolds, Jason" → two names.
export function parseAuthors(raw: string, coAuthors: string): string[] {
  const parts = [raw, coAuthors].filter(Boolean).join(';')
    .split(/\s*;\s*|\s+and\s+|\s*&\s*/).map(p => p.trim()).filter(Boolean)
  const names = parts.map(p => {
    const m = p.match(/^([^,]+),\s*([^,]+)$/)
    return (m ? `${m[2]} ${m[1]}` : p).replace(/\s+/g, ' ').trim()
  })
  return [...new Set(names)]
}

function main() {
  const rows = JSON.parse(readFileSync(IN, 'utf8')) as Raw[]
  const out: Stage0Row[] = []
  const skip: Record<string, number> = {}
  const bump = (k: string) => (skip[k] = (skip[k] ?? 0) + 1)
  for (let r of rows) {
    const decision = s(r.Decision)
    let action: Stage0Row['action_type'] | null = BANNED.has(decision) ? 'banned' : RESTRICTED.has(decision) ? 'restricted' : null
    // "Retained"/"Reshelved" WITH a restriction flag = access restricted, not retained as-is.
    if (!action && /^(Retained|Reshelved)$/.test(decision) && s(r.Restrictions) === 'Yes') action = 'restricted'
    if (!action) { bump(`decision:${decision || 'null'}`); continue }

    // Title/author swapped in the source ("Niven, Jennifer" | "Breathless").
    if (/^[A-Z][\w'-]+, [A-Z][\w.]+( [A-Z][\w.]*)?$/.test(s(r.Title)) && !s(r.Author).includes(',') && s(r.Author).split(' ').length > 1) {
      r = { ...r, Title: r.Author, Author: r.Title }
    }
    // Excel turned "November 9" (Colleen Hoover) into a date.
    if (/^\d{4}-11-09$/.test(s(r.Title)) && /hoover/i.test(s(r.Author))) r = { ...r, Title: 'November 9' }
    // Strip PEN-style author disambiguators: "Perfect (EH)" → "Perfect".
    const title = s(r.Title).replace(/\s*\([A-Z]{2,3}\)\s*$/, '')
    const authors = parseAuthors(s(r.Author), s(r.Book_Co_Author))
    if (!title || !authors.length) { bump('no-title-or-author'); continue }
    if (PLACEHOLDER_TITLE.test(title) || authors.every(a => PLACEHOLDER_AUTHOR.test(a))) { bump('placeholder'); continue }
    const region = STATES[s(r.State).toUpperCase()]
    if (!region) { bump('no-state'); continue }
    const yearM = s(r.Year).match(/^(\d{4})/)
    if (!yearM) { bump('no-year'); continue }

    const inst = s(r.Institution_Type)
    const district = s(r.District_or_Overseeing_Agency)
    const library = s(r.Library_Name)
    let scope: Stage0Row['scope_slug']
    let institution: string
    if (inst === 'Academic Library') {
      // The only academic rows: the April 2025 DoD-ordered removals at the
      // U.S. Naval Academy's Nimitz Library — a federal directive, not a school board.
      if (!/defense/i.test(district)) { bump('academic-other'); continue }
      scope = 'government'
      institution = 'U.S. Naval Academy (Nimitz Library)'
    } else if (inst === 'Public Library' || (!inst && /librar/i.test(library || district))) {
      scope = 'public_library'
      institution = library || district
    } else {
      scope = 'school'
      institution = district || s(r.School_Name)
    }
    if (!institution) { bump('no-institution'); continue }

    out.push({
      magnusson_id: typeof r.ID === 'number' ? r.ID : null,
      title, authors, country_code: 'US', region, institution,
      year: Number(yearM[1]), scope_slug: scope, action_type: action, reason_slug: 'other',
      source_url: s(r.Primary_Source_URL).startsWith('http') ? s(r.Primary_Source_URL) : null,
      source_name: MAGNUSSON_SOURCE_NAME, decision_raw: decision,
    })
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`rows in: ${rows.length} → stage-0: ${out.length} → ${OUT}`)
  console.log('skipped:', Object.entries(skip).sort((a, b) => b[1] - a[1]).slice(0, 15))
  const by = (k: keyof Stage0Row) => Object.entries(out.reduce<Record<string, number>>((a, r) => ((a[String(r[k])] = (a[String(r[k])] ?? 0) + 1), a), {}))
  console.log('scope:', by('scope_slug'), 'action:', by('action_type'))
}

if (require.main === module) main()
