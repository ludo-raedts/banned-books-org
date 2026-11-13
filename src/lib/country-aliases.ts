// Search-term aliases that stand for a whole jurisdiction. Text search matches
// titles and authors only, so a query for "DDR" or "GDR" found nothing even though
// the catalogue holds 200+ East German bans (filed under country code DD, whose
// name is "East Germany (DDR)"). A query that is exactly one of these terms is
// treated as the jurisdiction as well as a text query.
//
// Exact match only (after normalising): "gdr" must not fire on "gdrive", and a
// title that merely contains "east germany" still goes through the text path.

const ALIASES: Record<string, string[]> = {
  DD: [
    'ddr',
    'gdr',
    'east germany',
    'east german',
    'ost-deutschland',
    'ostdeutschland',
    'ost deutschland',
    'german democratic republic',
    'deutsche demokratische republik',
    'ostzone',
    'sbz',
    'soviet occupation zone',
    'sowjetische besatzungszone',
  ],
}

function normalise(q: string): string {
  return q.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')
}

const LOOKUP = new Map<string, string>(
  Object.entries(ALIASES).flatMap(([code, terms]) => terms.map(t => [t, code] as const)),
)

/** The ISO-ish country code a free-text query stands for, or null. */
export function countryCodeForQuery(q: string): string | null {
  return LOOKUP.get(normalise(q)) ?? null
}
