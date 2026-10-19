/**
 * Stage-0 builder for Magnusson's AIRTABLE export format: one row per ban
 * (`*Ban ID`), location as "District | ST", Decision, the law cited, and Evidence
 * URLs. First file: "Bans-For Kelly.xlsx" (2026-10-13), 2,077 bans, mostly from
 * the 2025-26 school year.
 *
 * Writes the same Stage0Row shape as build-magnusson-stage0.ts (the older
 * multi-tab Google-Sheet export), so it feeds import-magnusson-delta.ts
 * unchanged.
 *
 * Scope (same doctrine as the 2026-10-10 import, plus one extension):
 *   - banned: Banned/Removed
 *   - restricted: Retained/Restricted, Reshelved - Restricted, Stickered
 *   - "Weeded/Deselected" counts as banned ONLY when the row cites a law or
 *     content criterion (e.g. Lamar CISD "Not in alignment with … HB900"), which
 *     makes it an ideological removal. Plain weeding stays out (PEN doctrine).
 *   - retained / still in process / no action: out.
 *   - titles in quotes ('"How It Feels To Be Colored Me"') are essays or short
 *     works, not books: out (scope gate).
 *
 * Input:  data/magnusson/<name>.json (the sheet exported to JSON, gitignored)
 * Output: data/magnusson/stage0-airtable-<date>.json
 *
 * Usage: npx tsx scripts/build-magnusson-airtable-stage0.ts --in=data/magnusson/kelly-2026-10-13.json --date=2026-10-13
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { flagValue } from './lib/cli'
import { MAGNUSSON_SOURCE_NAME, PLACEHOLDER_AUTHOR, PLACEHOLDER_TITLE, STATES, parseAuthors, type Stage0Row } from './build-magnusson-stage0'

const IN = flagValue('in') ?? 'data/magnusson/kelly-2026-10-13.json'
const DATE = flagValue('date') ?? '2026-10-13'
const OUT = `data/magnusson/stage0-airtable-${DATE}.json`

const BANNED = new Set(['Banned/Removed'])
const RESTRICTED = new Set(['Retained/Restricted', 'Reshelved - Restricted', 'Stickered'])
const SCOPE: Record<string, Stage0Row['scope_slug']> = {
  'Public School District': 'school',
  'Public Library': 'public_library',
  'State Board of Education': 'government',
  Prison: 'prison',
}

type Raw = Record<string, string | number | null>
const s = (v: unknown) => (v == null ? '' : String(v).trim())

// Airtable joins lookup values CSV-style: 'Jason  Reynolds,Brendan Kiely',
// '"Henry Louis   Gates, Jr.",Kevin Burke'. Names are already "First Last".
function splitAirtableList(raw: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '"') { if (q && raw[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
}
// "Henry Louis Gates, Jr." → "Henry Louis Gates Jr."; Airtable's "(No Last Name)" /
// "(Org)" markers go ("Sapphire (No Last Name)" → "Sapphire").
const cleanName = (n: string) =>
  n.replace(/\s*\((No Last Name|Org)\)\s*$/i, '').replace(/,\s*(Jr|Sr)\.?$/i, ' $1.').trim()

// '"A Child Called ""It"": …"' → 'A Child Called "It": …'
function unquoteTitle(raw: string): string {
  const t = raw.trim()
  const u = t.startsWith('"') && t.endsWith('"') && t.length > 1 ? t.slice(1, -1).replace(/""/g, '"').trim() : t
  // NBSPs; PEN-style author initials ("Breathless (JN)", "Skin (DJN)")
  return u.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\s*\([A-Z]{2,3}\)\s*$/, '').trim()
}

function main() {
  const rows = JSON.parse(readFileSync(IN, 'utf8')) as Raw[]
  const out: Stage0Row[] = []
  const skip: Record<string, number> = {}
  const bump = (k: string) => (skip[k] = (skip[k] ?? 0) + 1)
  for (const r of rows) {
    const decision = s(r['*Decision'])
    const law = s(r['If Legislation Response or State Law - Name of Law'])
    let action: Stage0Row['action_type'] | null = BANNED.has(decision) ? 'banned' : RESTRICTED.has(decision) ? 'restricted' : null
    if (!action && decision === 'Weeded/Deselected' && law) action = 'banned'
    if (!action) { bump(`decision:${decision || 'null'}${decision === 'Weeded/Deselected' ? ' (no law)' : ''}`); continue }

    const title = unquoteTitle(s(r['*Book']))
    if (!title) { bump('no-title'); continue }
    if (title.startsWith('"')) { bump('short-work (quoted title)'); continue }
    if (PLACEHOLDER_TITLE.test(title) || /volume not specified/i.test(title)) { bump('placeholder'); continue }
    const authorNames = splitAirtableList(s(r['*Author (from *Book)'])).map(cleanName)
    // parseAuthors only flips "Last, First"; these are already First Last, so it just normalises.
    const authors = authorNames.flatMap(a => parseAuthors(a, ''))
    if (!authors.length || authors.every(a => PLACEHOLDER_AUTHOR.test(a))) { bump('no-author'); continue }

    const [institution, st] = s(r['*Location of Ban']).split(' | ').map(x => x.trim())
    const region = STATES[(st || s(r['Location State'])).toUpperCase()]
    if (!region || !institution) { bump('no-location'); continue }
    const scope = SCOPE[s(r['Type of Location (from *Location of Ban)'])]
    if (!scope) { bump(`location-type:${s(r['Type of Location (from *Location of Ban)'])}`); continue }
    const yearM = s(r['Date of Ban']).match(/(\d{4})/)
    if (!yearM) { bump('no-year'); continue }

    const url = s(r.Evidence).match(/https?:\/\/[^\s,]+/)?.[0] ?? null
    out.push({
      magnusson_id: typeof r.ID === 'number' ? r.ID : null,
      title, authors, country_code: 'US', region, institution,
      year: Number(yearM[1]), scope_slug: scope, action_type: action, reason_slug: 'other',
      source_url: url, source_name: MAGNUSSON_SOURCE_NAME,
      decision_raw: law ? `${decision} (${law})` : decision,
    })
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`rows in: ${rows.length} → stage-0: ${out.length} → ${OUT}`)
  console.log('skipped:', Object.entries(skip).sort((a, b) => b[1] - a[1]))
  const by = (k: keyof Stage0Row) => Object.entries(out.reduce<Record<string, number>>((a, x) => ((a[String(x[k])] = (a[String(x[k])] ?? 0) + 1), a), {}))
  console.log('scope:', by('scope_slug'), 'action:', by('action_type'), 'year:', by('year'))
}

if (require.main === module) main()
