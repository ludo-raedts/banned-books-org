// Upper bound on a book's plausible first_published_year, derived from its bans.
//
// A book removed from a US school or public library in year Y must have existed
// in year Y. Bans are stored by school-year start (PEN "2023-24" → 2023), so a
// book published early in Y+1 can legitimately carry a ban dated Y: the
// ceiling is Y+1. Only US school/public-library bans from 2021 on (the PEN /
// Magnusson era) count. Government bans can predate publication for real
// (samizdat, posthumous release) and are ignored.
//
// Used by enrich-ol-harvest (never writes a year above the ceiling) and by
// fix-provably-wrong-pub-years (nulls stored years above it).
import type { Client } from 'pg'

export const PUB_YEAR_CEILING_SQL = `
  select n.book_id, min(n.year_started) + 1 as ceiling
  from bans n join scopes s on s.id = n.scope_id
  where n.country_code = 'US' and s.slug in ('school', 'public_library')
    and n.year_started >= 2021
  group by n.book_id`

export async function loadPubYearCeilings(pg: Client): Promise<Map<number, number>> {
  const { rows } = await pg.query(PUB_YEAR_CEILING_SQL)
  return new Map(rows.map((r) => [Number(r.book_id), Number(r.ceiling)]))
}

export function exceedsPubYearCeiling(ceilings: Map<number, number>, bookId: number, year: number): boolean {
  const c = ceilings.get(bookId)
  return c != null && year > c
}
