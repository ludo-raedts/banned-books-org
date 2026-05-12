// Native HTTP fetcher for source URLs.
//
// Why a custom redirect handler: we want the redirect chain in the
// VerificationResult (excessive-redirect heuristic in gate.ts), and standard
// fetch redirect: 'follow' hides the chain. Manual redirect + recursion gives
// us the URL list while still capping at MAX_REDIRECTS to prevent loops.
//
// Errors are returned, not thrown — the orchestrator decides what counts as
// fatal vs retryable. HTTP >= 400 returns html=null with the response status
// intact; network errors throw (caller catches).

const USER_AGENT = 'Banned-Books-Org-Importer/1.0'
const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 10

export type FetchResult = {
  status: number
  html: string | null
  content_type: string
  fetched_at: string
  redirect_chain: string[]
  redirect_count: number
}

export async function fetchSource(url: string): Promise<FetchResult> {
  const chain: string[] = []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let currentUrl = url
    let response: Response | null = null

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      chain.push(currentUrl)
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      })

      const isRedirect = response.status >= 300 && response.status < 400
      if (!isRedirect) break

      const location = response.headers.get('location')
      if (!location) break

      currentUrl = new URL(location, currentUrl).toString()
      if (hop === MAX_REDIRECTS) {
        return {
          status: response.status,
          html: null,
          content_type: response.headers.get('content-type') ?? '',
          fetched_at: new Date().toISOString(),
          redirect_chain: chain,
          redirect_count: chain.length - 1,
        }
      }
    }

    if (!response) throw new Error('fetcher: no response')

    const contentType = response.headers.get('content-type') ?? ''
    const html = response.status >= 400 ? null : await response.text()

    return {
      status: response.status,
      html,
      content_type: contentType,
      fetched_at: new Date().toISOString(),
      redirect_chain: chain,
      redirect_count: chain.length - 1,
    }
  } finally {
    clearTimeout(timer)
  }
}
