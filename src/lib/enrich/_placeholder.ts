// Vercel-safe placeholder detection. Mirrors scripts/lib/placeholder.ts but
// hard-codes the pHash of assets/google-books-placeholder.png so we don't need
// to read the PNG off disk in serverless contexts (where __filename and
// import.meta resolution don't reliably point at the bundled asset).
//
// Re-compute the hash if the reference PNG ever changes:
//   pnpm tsx -e 'import("sharp-phash").then(async m => { const fs = await import("node:fs"); console.log(await m.default(fs.readFileSync("assets/google-books-placeholder.png"))) })'

import phash from 'sharp-phash'
import distance from 'sharp-phash/distance'

export const PLACEHOLDER_HASH =
  '1010011010000111011100110110011010011110001101000111011100111101'
export const PLACEHOLDER_HAMMING_THRESHOLD = 5

const FETCH_TIMEOUT_MS = 5000
const MAX_BYTES = 2 * 1024 * 1024

export type PlaceholderCheck =
  | { ok: true;  hash: string; hammingDistance: number }
  | { ok: false; reason: 'placeholder'; hash: string; hammingDistance: number }
  | { ok: false; reason: 'fetch_failed' | 'too_large' | 'timeout' | 'hash_failed'; detail: string }

export async function checkImageUrl(url: string): Promise<PlaceholderCheck> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, { signal: ctrl.signal })
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : String(err)
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { ok: false, reason: aborted ? 'timeout' : 'fetch_failed', detail: msg }
  }
  clearTimeout(timer)

  if (!res.ok) return { ok: false, reason: 'fetch_failed', detail: `HTTP ${res.status}` }

  const lengthHeader = res.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
    return { ok: false, reason: 'too_large', detail: `${lengthHeader} bytes (header)` }
  }

  let buf: Buffer
  try {
    const arr = await res.arrayBuffer()
    if (arr.byteLength > MAX_BYTES) {
      return { ok: false, reason: 'too_large', detail: `${arr.byteLength} bytes` }
    }
    buf = Buffer.from(arr)
  } catch (err) {
    return { ok: false, reason: 'fetch_failed', detail: err instanceof Error ? err.message : String(err) }
  }

  let candidateHash: string
  try {
    candidateHash = await phash(buf)
  } catch (err) {
    return { ok: false, reason: 'hash_failed', detail: err instanceof Error ? err.message : String(err) }
  }

  const d = distance(PLACEHOLDER_HASH, candidateHash)
  if (d <= PLACEHOLDER_HAMMING_THRESHOLD) {
    return { ok: false, reason: 'placeholder', hash: candidateHash, hammingDistance: d }
  }
  return { ok: true, hash: candidateHash, hammingDistance: d }
}
