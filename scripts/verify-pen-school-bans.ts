// verify-pen-school-bans.ts — ground PEN America school-ban records against the
// upstream PEN Index source files and set bans.confidence='verified' for the ones
// that genuinely match.
//
// A "verified" checkmark here means: the cited PEN America Index of School Book
// Bans actually lists THIS title being banned in THIS state + district. That is
// a reproducible, source-grounded claim — not an ad-hoc flag.
//
// Scope: the two clean, single-edition PEN sources whose bans carry full
// (state, district) granularity:
//   src#2131  PEN Index 2023-2024  → data/pen-2023-24.csv          (10,051 bans)
//   src#2068  PEN Index 2024-2025  → data/pen-america-2024-25.json (6,674 bans)
// The generic "PEN America" catch-all (src#190, mixed eras, no district) is
// intentionally OUT of scope — it cannot be grounded against one file.
//
// Matching: a ban is grounded when a PEN record exists in the SAME (state,
// district) whose title matches via titlesMatch(). District-level matches are
// applied; title+state-only matches and misses are reported for review, never
// auto-verified.
//
// Run (dry):  pnpm tsx --env-file=.env.local scripts/verify-pen-school-bans.ts
// Run (write): …/verify-pen-school-bans.ts --apply

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import { adminClient } from '../src/lib/supabase'
import { titlesMatch } from '../src/lib/enrich/title-match'

const APPLY = process.argv.includes('--apply')
// --revert sets the grounded bans' confidence back to 'reported' instead of
// 'verified' — used to undo the write after the per-ban verified badge was
// dropped in favour of the single documented book-level data_quality check.
const REVERT = process.argv.includes('--revert')
const TARGET = REVERT ? 'reported' : 'verified'
const sb = adminClient()

const norm = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

type PenRow = { title: string; state: string; district: string }

function loadCsv(file: string): PenRow[] {
  const text = readFileSync(resolve(__dirname, '..', 'data', file), 'utf8')
  // banner rows 1-2, real header on line 3
  const rows = parse(text, { columns: true, from_line: 3, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[]
  return rows
    .map((r) => ({ title: r['Title'] ?? '', state: r['State'] ?? '', district: r['District'] ?? '' }))
    .filter((r) => r.title)
}

function loadJson(file: string): PenRow[] {
  const data = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', file), 'utf8')) as Record<string, string>[]
  return data
    .map((r) => ({ title: r.title ?? '', state: r.state ?? '', district: r.district ?? '' }))
    .filter((r) => r.title)
}

const SOURCES = [
  { id: 2131, label: 'PEN Index 2023-2024', rows: () => loadCsv('pen-2023-24.csv') },
  { id: 2068, label: 'PEN Index 2024-2025', rows: () => loadJson('pen-america-2024-25.json') },
]

async function linkedBanIds(sourceId: number): Promise<number[]> {
  const ids: number[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb
      .from('ban_source_links')
      .select('ban_id')
      .eq('source_id', sourceId)
      .order('ban_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    ids.push(...(data as { ban_id: number }[]).map((r) => r.ban_id))
    if (data.length < PAGE) break
    from += PAGE
  }
  return ids
}

async function run() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  let grandGrounded = 0

  for (const src of SOURCES) {
    const pen = src.rows()
    // index titles by (state|district) and by (state) for fallback reporting
    const byDistrict = new Map<string, string[]>()
    const byState = new Map<string, string[]>()
    for (const r of pen) {
      const dk = `${norm(r.state)}|${norm(r.district)}`
      ;(byDistrict.get(dk) ?? byDistrict.set(dk, []).get(dk)!).push(r.title)
      const sk = norm(r.state)
      ;(byState.get(sk) ?? byState.set(sk, []).get(sk)!).push(r.title)
    }

    const banIds = await linkedBanIds(src.id)
    let district = 0
    let stateOnly = 0
    const groundedBanIds: number[] = []
    const misses: string[] = []

    for (let i = 0; i < banIds.length; i += 500) {
      const slice = banIds.slice(i, i + 500)
      const { data, error } = await sb
        .from('bans')
        .select('id, region, institution, confidence, books(title)')
        .in('id', slice)
      if (error) throw error
      for (const b of data as { id: number; region: string | null; institution: string | null; confidence: string; books: { title: string } | null }[]) {
        const title = b.books?.title ?? ''
        const dk = `${norm(b.region)}|${norm(b.institution)}`
        const sk = norm(b.region)
        const dCand = byDistrict.get(dk) ?? []
        const sCand = byState.get(sk) ?? []
        if (dCand.some((t) => titlesMatch(title, t))) {
          district++
          groundedBanIds.push(b.id)
        } else if (sCand.some((t) => titlesMatch(title, t))) {
          stateOnly++
          if (misses.length < 12) misses.push(`STATE-ONLY #${b.id} "${title}" @ ${b.region} / ${b.institution}`)
        } else {
          if (misses.length < 12) misses.push(`MISS       #${b.id} "${title}" @ ${b.region} / ${b.institution}`)
        }
      }
    }

    const unmatched = banIds.length - district - stateOnly
    console.log(`\n${src.label} (src#${src.id}) — ${banIds.length} linked bans, ${pen.length} PEN records`)
    console.log(`  ✓ district-grounded : ${district} (${Math.round((district / banIds.length) * 100)}%)  → will verify`)
    console.log(`  ~ state-only match  : ${stateOnly}  (reported, not verified)`)
    console.log(`  ✗ unmatched         : ${unmatched}  (reported, not verified)`)
    if (misses.length) console.log('  samples:\n' + misses.map((m) => '    ' + m).join('\n'))

    grandGrounded += groundedBanIds.length
    if (APPLY && groundedBanIds.length) {
      for (let i = 0; i < groundedBanIds.length; i += 500) {
        const slice = groundedBanIds.slice(i, i + 500)
        const { error } = await sb.from('bans').update({ confidence: TARGET }).in('id', slice)
        if (error) throw error
      }
      console.log(`  applied confidence='${TARGET}' to ${groundedBanIds.length} bans`)
    }
  }

  console.log(`\n${APPLY ? `set confidence='${TARGET}' on` : '[dry] would set'} ${grandGrounded} bans.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
