const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.banned-books.org').replace(/\/$/, '')
const HOST = new URL(SITE_URL).host
const INDEXNOW_BATCH_SIZE = 10_000

export type IndexNowResult =
  | { ok: true; status: number; submitted: string[] }
  | { ok: false; status: number; error: string; submitted?: string[] }

function isOwnUrl(url: string): boolean {
  try {
    return new URL(url).host === HOST
  } catch {
    return false
  }
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${path}`
}

export async function submitToIndexNow(rawUrls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY
  if (!key) {
    return { ok: false, status: 0, error: 'INDEXNOW_KEY not set' }
  }

  const urls = Array.from(new Set(rawUrls.map(absoluteUrl).filter(isOwnUrl)))
  if (urls.length === 0) {
    return { ok: false, status: 0, error: 'No valid URLs for host' }
  }

  const body = {
    host: HOST,
    key,
    keyLocation: `${SITE_URL}/indexnow.txt`,
    urlList: urls,
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text || res.statusText, submitted: urls }
    }
    return { ok: true, status: res.status, submitted: urls }
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

export function notifyIndexNow(urls: string[]): void {
  if (!process.env.INDEXNOW_KEY) return
  void submitToIndexNow(urls).then((result) => {
    if (!result.ok) {
      console.warn('[indexnow] submission failed', result.status, result.error)
    }
  })
}

export async function submitInBatches(urls: string[]): Promise<{
  total: number
  batches: number
  results: IndexNowResult[]
}> {
  const results: IndexNowResult[] = []
  for (let i = 0; i < urls.length; i += INDEXNOW_BATCH_SIZE) {
    const slice = urls.slice(i, i + INDEXNOW_BATCH_SIZE)
    results.push(await submitToIndexNow(slice))
  }
  return { total: urls.length, batches: results.length, results }
}
