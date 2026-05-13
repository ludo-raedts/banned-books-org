// Wikipedia API fetcher using MediaWiki's action=parse endpoint.
//
// We pull wikitext (not HTML) so the parser sees the original `{| ... |}`
// table structure rather than the post-rendered DOM. revid is captured so
// the import is reproducible: a future re-run can verify against the same
// revision, or pin an older revision via &oldid= if needed.
//
// User-Agent is required by Wikipedia's policy and must identify the project
// + a contact. See https://meta.wikimedia.org/wiki/User-Agent_policy.
//
// No retry: Wikipedia's API is reliable. A failure here means a real error
// to surface to the operator, not a transient blip to swallow.

const USER_AGENT =
  'banned-books-org/1.0 (https://www.banned-books.org; admin@banned-books.org)'

export type WikipediaFetchResult = {
  wikitext: string
  revid: number
  fetched_at: string
}

type ParseApiResponse = {
  parse?: {
    wikitext?: { '*': string }
    revid?: number
  }
  error?: { code: string; info: string }
}

export async function fetchWikipediaPage(
  page: string,
): Promise<WikipediaFetchResult> {
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.searchParams.set('action', 'parse')
  url.searchParams.set('page', page)
  url.searchParams.set('format', 'json')
  url.searchParams.set('prop', 'wikitext|revid')

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(
      `wikipedia: HTTP ${res.status} ${res.statusText} for ${page}`,
    )
  }
  const json = (await res.json()) as ParseApiResponse
  if (json.error) {
    throw new Error(
      `wikipedia API error for ${page}: ${json.error.code}: ${json.error.info}`,
    )
  }
  const wikitext = json.parse?.wikitext?.['*']
  const revid = json.parse?.revid
  if (typeof wikitext !== 'string' || typeof revid !== 'number') {
    throw new Error(`wikipedia: malformed response for ${page}`)
  }
  return {
    wikitext,
    revid,
    fetched_at: new Date().toISOString(),
  }
}
