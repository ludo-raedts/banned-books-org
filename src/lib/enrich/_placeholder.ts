// Vercel-safe placeholder detection. Mirrors scripts/lib/placeholder.ts but
// hard-codes the pHash of assets/google-books-placeholder.png so we don't need
// to read the PNG off disk in serverless contexts (where __filename and
// import.meta resolution don't reliably point at the bundled asset).
//
// Re-compute the hash if the reference PNG ever changes:
//   pnpm tsx -e 'import("sharp-phash").then(async m => { const fs = await import("node:fs"); console.log(await m.default(fs.readFileSync("assets/google-books-placeholder.png"))) })'

import phash from 'sharp-phash'
import distance from 'sharp-phash/distance'
import sharp from 'sharp'

export const PLACEHOLDER_HASH =
  '1010011010000111011100110110011010011110001101000111011100111101'
export const PLACEHOLDER_HAMMING_THRESHOLD = 5

const FETCH_TIMEOUT_MS = 5000
const MAX_BYTES = 2 * 1024 * 1024

// A real book cover is portrait. Google Books returns a degenerate horizontal
// strip (the watermarked top sliver of the cover) for some books at zoom=3.
// Detect by aspect ratio: height/width well below 1 means a strip; a usable
// cover (incl. square board books) is >= STRIP_RATIO.
export const STRIP_RATIO = 0.7
export const PORTRAIT_RATIO = 1.2

export type PlaceholderCheck =
  | { ok: true;  hash: string; hammingDistance: number; width?: number; height?: number }
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

  let width: number | undefined
  let height: number | undefined
  try {
    const meta = await sharp(buf).metadata()
    width = meta.width
    height = meta.height
  } catch { /* dimensions are best-effort; absence just skips the aspect guard */ }

  return { ok: true, hash: candidateHash, hammingDistance: d, width, height }
}

function isGbContentUrl(url: string): boolean {
  return /books\.google\.[a-z.]+\/books\/content/i.test(url)
}

// Guard against degenerate Google Books strips. Given a zoom=3 cover URL whose
// placeholder check already passed (with measured dimensions), returns a usable
// URL — falling back to the zoom=1 variant when the zoom=3 image is a strip and
// zoom=1 is a proper portrait, or null when neither is usable. Non-GB URLs and
// unmeasured images pass through unchanged.
export async function repairGbStrip(
  url: string,
  width?: number,
  height?: number,
): Promise<string | null> {
  if (!isGbContentUrl(url) || !width || !height) return url
  if (height / width >= STRIP_RATIO) return url
  const z1 = url.replace('zoom=3', 'zoom=1')
  if (z1 === url) return null
  const check = await checkImageUrl(z1)
  if (check.ok && check.width && check.height && check.height / check.width >= PORTRAIT_RATIO) {
    return z1
  }
  return null
}

// Combined verifier for callers that don't need to distinguish a placeholder
// rejection from a strip rejection: drops placeholders, repairs/rejects strips,
// and passes non-GB URLs through. Lenient on transient fetch failures (keeps
// the URL) to preserve prior behavior.
export async function verifyGbCover(url: string): Promise<string | null> {
  if (!url.includes('books.google')) return url
  const check = await checkImageUrl(url)
  if (check.ok === false) return check.reason === 'placeholder' ? null : url
  return repairGbStrip(url, check.width, check.height)
}
