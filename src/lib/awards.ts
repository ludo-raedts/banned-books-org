// Literary-award metadata shared by the book page, author page and any
// award hub. Mirrors the `awards` JSONB columns on books/authors (see
// migration 20260613100000 + scripts/enrich-awards.ts).
//
// Levels differ: the Nobel Prize in Literature is an AUTHOR attribute (awarded
// for the oeuvre); the Pulitzer Prize is a BOOK attribute (awarded to a work).

export type Award = {
  award: string // e.g. "Nobel Prize in Literature", "Pulitzer Prize"
  year: number
  category?: string // Pulitzer sub-prize: "Fiction" | "Novel" | "Special Citation"
}

/** Human label for an award, without the year. */
export function awardName(a: Award): string {
  if (a.award === 'Pulitzer Prize' && a.category) {
    if (a.category === 'Novel') return 'Pulitzer Prize for the Novel'
    if (a.category === 'Special Citation') return 'Pulitzer Prize Special Citation'
    return `Pulitzer Prize for ${a.category}`
  }
  return a.award
}

/** Full label with year, e.g. "Pulitzer Prize for Fiction, 1988". */
export function awardLabel(a: Award): string {
  return `${awardName(a)}, ${a.year}`
}

/** Plain schema.org `award` string, e.g. "Pulitzer Prize for Fiction (1988)". */
export function awardSchemaText(a: Award): string {
  return `${awardName(a)} (${a.year})`
}

/** Parse the JSONB column into typed awards, tolerating null/garbage. */
export function parseAwards(raw: unknown): Award[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Award => !!x && typeof x === 'object' && typeof (x as Award).award === 'string' && typeof (x as Award).year === 'number')
    .sort((a, b) => a.year - b.year)
}
