/**
 * Detect Google Books "image not available" placeholders by perceptual hash.
 *
 * The reference image lives at assets/google-books-placeholder.png. Its pHash
 * is computed once on first call and cached for the process lifetime. Any
 * candidate image whose Hamming distance to the reference is <= the threshold
 * is treated as a placeholder.
 */

import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import phash from 'sharp-phash'
import distance from 'sharp-phash/distance'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLACEHOLDER_PATH = path.resolve(__dirname, '../../assets/google-books-placeholder.png')

export const PLACEHOLDER_HAMMING_THRESHOLD = 5
const FETCH_TIMEOUT_MS = 5000
const MAX_BYTES = 2 * 1024 * 1024

let cachedHash: string | null = null

export async function getPlaceholderHash(): Promise<string> {
  if (cachedHash) return cachedHash
  const buf = await fs.readFile(PLACEHOLDER_PATH)
  cachedHash = await phash(buf)
  return cachedHash
}

export type PlaceholderCheck =
  | { ok: true;  hash: string; hammingDistance: number }
  | { ok: false; reason: 'placeholder'; hash: string; hammingDistance: number }
  | { ok: false; reason: 'fetch_failed' | 'too_large' | 'timeout' | 'hash_failed'; detail: string }

export async function checkImageUrl(url: string): Promise<PlaceholderCheck> {
  const placeholderHash = await getPlaceholderHash()
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

  if (!res.ok) {
    return { ok: false, reason: 'fetch_failed', detail: `HTTP ${res.status}` }
  }

  const lengthHeader = res.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
    return { ok: false, reason: 'too_large', detail: `${lengthHeader} bytes (header)` }
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) {
    return { ok: false, reason: 'too_large', detail: `${buf.byteLength} bytes` }
  }

  let imgHash: string
  try {
    imgHash = await phash(buf)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'hash_failed', detail: msg }
  }

  const dist = distance(imgHash, placeholderHash)
  if (dist <= PLACEHOLDER_HAMMING_THRESHOLD) {
    return { ok: false, reason: 'placeholder', hash: imgHash, hammingDistance: dist }
  }
  return { ok: true, hash: imgHash, hammingDistance: dist }
}
