// The one fact line under a book's hero subtitle:
//   "28 documented bans · earliest in 1949 · 18 still active (in Cuba, China and the United States)"
//
// Rule that keeps it true for every mix of active and historical records:
// a country is only ever named next to a claim about the bans in THAT
// country. "still active" therefore carries its own country list, taken from
// the active bans only. The generic "including A, B and C" example list
// (first countries by year, i.e. usually the oldest, often long-lifted bans)
// is shown only when there is no active/historical split to misread — all
// bans active, or none active.
//
// Before this module the line read "28 documented bans · earliest in 1949 ·
// 18 still active · including Romania, Hungary and Bulgaria" on /books/1984,
// where those three bans are lifted and the 18 active ones are Cuba, China and
// US school districts (the review of 2026-11-15).

export type FactBan = {
  year_started: number | null
  status: string
  country_code: string
  countries: { name_en: string } | null
}

function nameList(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const shown = names.slice(0, max)
  const more = names.length - max
  return `${shown.join(', ')} and ${more} more`
}

/** Distinct country names in first-occurrence order (bans must be pre-sorted). */
function distinctCountries(bans: FactBan[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of bans) {
    if (b.countries?.name_en && !seen.has(b.country_code)) {
      seen.add(b.country_code)
      out.push(b.countries.name_en)
    }
  }
  return out
}

export function buildFactLine(sortedBans: FactBan[]): string[] {
  const n = sortedBans.length
  if (n === 0) return []
  const dated = sortedBans.filter(b => b.year_started != null)
  const earliestYear = dated.length > 0 ? Math.min(...dated.map(b => b.year_started!)) : null

  const facts: string[] = [
    n === 1
      ? `1 documented ban${earliestYear ? ` in ${earliestYear}` : ''}`
      : `${n} documented bans`,
  ]
  if (n > 1 && earliestYear) facts.push(`earliest in ${earliestYear}`)

  const active = sortedBans.filter(b => b.status === 'active')
  const mixed = active.length > 0 && active.length < n
  if (mixed) {
    const where = distinctCountries(active)
    facts.push(`${active.length} still active${where.length > 0 ? ` (in ${nameList(where)})` : ''}`)
  } else {
    const all = distinctCountries(sortedBans)
    if (all.length >= 3) facts.push(`including ${all[0]}, ${all[1]} and ${all[2]}`)
  }
  return facts
}
