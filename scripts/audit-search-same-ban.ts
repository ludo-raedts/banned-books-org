#!/usr/bin/env tsx
/**
 * Read-only check that /search applies ban-level filters to ONE ban row.
 *
 * WHY: country, year, scope, status and reason are facts about a single ban.
 * They used to be intersected as separate book sets, so "United States + 2026"
 * also returned a book banned in the US in 2019 and in France in 2026 (UX
 * review 2026-11-11, step 9). The reviewer asked for that counter-example to be
 * tested before go-live.
 *
 * CHECKS (exit 1 on any failure):
 *   1. Counter-example: books with a <country> ban in another year AND a ban in
 *      <year> only elsewhere must NOT appear for country=<country>&year=<year>.
 *   2. Exhaustive: every returned book has a <country> ban starting in <year>,
 *      and the returned set equals the set of books with such a ban.
 *
 * USAGE: pnpm tsx --env-file=.env.local scripts/audit-search-same-ban.ts [US 2026]
 */
import { searchBooks } from '../src/lib/book-search'
import { adminClient } from '../src/lib/supabase'

type Ban = { book_id: number; country_code: string; year_started: number | null }

async function allBans(): Promise<Ban[]> {
  const sb = adminClient()
  const out: Ban[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('bans').select('book_id, country_code, year_started').order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data as Ban[]))
    if (!data || data.length < 1000) return out
  }
}

async function searchIds(country: string, year: number): Promise<Set<number>> {
  const ids = new Set<number>()
  for (let offset = 0; ; offset += 96) {
    const r = await searchBooks({ country, year, offset, limit: 96, sort: 'alpha' })
    if (r.error) throw new Error(r.error)
    for (const b of r.books as { id: number }[]) ids.add(b.id)
    if (offset + 96 >= r.total) return ids
  }
}

async function main() {
  const country = process.argv[2] ?? 'US'
  const year = Number(process.argv[3] ?? 2026)
  const bans = await allBans()

  const matching = new Set(bans.filter(b => b.country_code === country && b.year_started === year).map(b => b.book_id))
  const inCountryOtherYear = new Set(bans.filter(b => b.country_code === country && b.year_started !== year).map(b => b.book_id))
  const inYearElsewhere = new Set(bans.filter(b => b.country_code !== country && b.year_started === year).map(b => b.book_id))
  const counterExamples = [...inCountryOtherYear].filter(id => inYearElsewhere.has(id) && !matching.has(id))

  const found = await searchIds(country, year)
  const leaked = counterExamples.filter(id => found.has(id))
  const notBanRow = [...found].filter(id => !matching.has(id))
  const missing = [...matching].filter(id => !found.has(id))

  console.log(`${country} + ${year}: search returned ${found.size} books; ban rows give ${matching.size} distinct books`)
  console.log(`counter-examples (${country} ban in another year + ${year} ban elsewhere only): ${counterExamples.length}, leaked into the result: ${leaked.length}`)
  console.log(`returned without a ${country} ${year} ban: ${notBanRow.length}; missing: ${missing.length} (gated books are excluded by design)`)
  if (leaked.length || notBanRow.length) {
    console.error('FAIL: results do not all belong to one ban row')
    process.exit(1)
  }
  console.log('OK')
}

main().catch(e => { console.error(e); process.exit(1) })
