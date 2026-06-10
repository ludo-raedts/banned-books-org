// CourtListener (Free Law Project) — recent U.S. court opinions in book-ban /
// school-library litigation. Powers the "In the courts" section on
// /countries/us. Public-domain data; no API key required.
//
// Query tuning: the bare `book AND banned` search returns 10k+ noisy hits
// (criminal cases, property disputes). Requiring a book-REMOVAL phrase AND a
// concrete library/school-board context term collapses that to the genuinely
// on-topic universe. We dropped the weak terms "library books" and a bare
// "First Amendment" because they leaked unrelated school-funding and criminal
// appeals (Hoke Cnty. Bd. of Educ. v. State, Williams v. Texas) into the feed.
//
// We query published opinions (type=o) — decided, substantive rulings — not
// the per-filing docket churn the @censorship.bots.law feed posts. There are
// only a handful of *decided* book-ban appellate opinions so far (most
// litigation is still pending), so this reads as a curated landmark-rulings
// panel rather than a high-frequency firehose. The date floor trims a thin
// pre-surge tail (2012–2017 library-filtering / redistricting cases).

const CL_QUERY =
  '("banned books" OR "book ban" OR "book removal" OR "removing books" OR "removal of books") ' +
  'AND ("school library" OR "public library" OR "school board")'

const FILED_AFTER = '2018-01-01'

function buildParams(extra: Record<string, string> = {}) {
  return new URLSearchParams({
    q: CL_QUERY,
    type: 'o',
    order_by: 'dateFiled desc',
    filed_after: FILED_AFTER,
    ...extra,
  })
}

// Human-facing search page on CourtListener, kept in sync with the API query
// so the "Source" link shows the reader the exact same result set.
export const COURTLISTENER_SEARCH_URL = `https://www.courtlistener.com/?${buildParams(
  { stat_Published: 'on' }
)}`

export type CourtCase = {
  caseName: string
  court: string
  dateFiled: string | null
  url: string
}

type RawResult = {
  caseName?: string
  court?: string
  dateFiled?: string | null
  absolute_url?: string
}

// Collapse near-duplicate cluster rows for the same case: lowercase, expand the
// "N.Y." abbreviation (the same NY case appears both spelled out and abbreviated),
// strip punctuation, key on the first 6 words.
function dedupeKey(caseName: string): string {
  return caseName
    .toLowerCase()
    .replace(/\bn\.y\.\b/g, 'new york')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ')
}

// Revalidate daily: court opinions are published in days-to-weeks, not minutes.
// Errors/timeouts return [] so the section simply hides — never blocks the page.
export async function fetchBookBanCourtCases(limit = 6): Promise<CourtCase[]> {
  const url = `https://www.courtlistener.com/api/rest/v4/search/?${buildParams()}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'banned-books.org (+https://www.banned-books.org)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: RawResult[] }

    const seen = new Set<string>()
    const cases: CourtCase[] = []
    for (const r of data.results ?? []) {
      const caseName = r.caseName?.trim()
      const path = r.absolute_url
      if (!caseName || !path) continue
      const key = dedupeKey(caseName)
      if (seen.has(key)) continue
      seen.add(key)
      cases.push({
        caseName,
        court: r.court?.trim() || 'U.S. court',
        dateFiled: r.dateFiled ?? null,
        url: `https://www.courtlistener.com${path}`,
      })
      if (cases.length >= limit) break
    }
    return cases
  } catch {
    return []
  }
}
