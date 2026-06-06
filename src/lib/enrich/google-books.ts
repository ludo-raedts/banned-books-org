// Shared Google Books API client. Single place for:
//   - API-key handling (keyless access now returns a per-project daily quota of
//     0 / 429 RESOURCE_EXHAUSTED, so a key is mandatory in practice). Falls back
//     to the Gemini key (same Google Cloud project) when no dedicated Books key
//     is set; the Books API must be enabled on that project.
//   - The full, typed `volumeInfo` field set (covers, descriptions, ISBNs, and
//     the metadata we did NOT use before: publishedDate, language, categories,
//     pageCount, publisher).
//   - Rate-limiting (post-call sleep, configurable per call).
//   - A placeholder-SAFE cover resolver. Google occasionally serves a generic
//     "image not available" placeholder; we have been burned by it before, so
//     covers obtained through `resolveGbCover` are always pHash-checked (and
//     degenerate horizontal strips repaired/rejected) via _placeholder.ts.
//
// Before this module, covers.ts was the only call-site that sent the API key;
// isbn.ts and descriptions-v2.ts called Google Books keyless (i.e. against a
// quota of 0). Routing every call through here fixes that.

import { checkImageUrl, repairGbStrip } from './_placeholder'
import { titlesMatch } from './title-match'

// ── Types ───────────────────────────────────────────────────────────────

export type GbImageLinks = {
  smallThumbnail?: string
  thumbnail?: string
  small?: string
  medium?: string
  large?: string
  extraLarge?: string
}

export type GbIndustryId = { type: string; identifier: string }

export type GbVolumeInfo = {
  title?: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  industryIdentifiers?: GbIndustryId[]
  pageCount?: number
  categories?: string[]
  maturityRating?: string
  imageLinks?: GbImageLinks
  language?: string
  infoLink?: string
  canonicalVolumeLink?: string
}

export type GbVolume = { id: string; volumeInfo: GbVolumeInfo }

// ── Field presets ─────────────────────────────────────────────────────────
// Google Books `fields` masks. Kept minimal per use-case to keep responses
// small; FULL is for the metadata-harvest path. Note: the `fields` value is
// embedded raw (NOT url-encoded) — the proven-working covers.ts pattern — so
// Google's field parser sees the literal parens/commas.

export const GB_FIELDS_COVER = 'items(volumeInfo(title,imageLinks))'
export const GB_FIELDS_ISBN = 'items(volumeInfo(title,authors,industryIdentifiers,language))'
export const GB_FIELDS_DESCRIPTION = 'items(id,volumeInfo(title,authors,description,infoLink))'
export const GB_FIELDS_FULL =
  'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,' +
  'industryIdentifiers,pageCount,categories,maturityRating,imageLinks,language,infoLink,canonicalVolumeLink))'

// ── Core request ──────────────────────────────────────────────────────────

const GB_BASE = 'https://www.googleapis.com/books/v1/volumes'
const DEFAULT_DELAY_MS = 600

// GOOGLE_BOOKS_API_KEY (dedicated) → GOOGLE_AI_API_KEY (Gemini, same GCP
// project) → '' (keyless; will 429 once the per-project daily quota is hit).
const GB_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? ''

export function hasGbKey(): boolean {
  return GB_KEY.length > 0
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export type GbQueryOpts = {
  maxResults?: number
  fields?: string
  delayMs?: number
  signal?: AbortSignal
}

// Thrown when Google Books returns HTTP 429 (per-project daily query quota
// exhausted — the default is only ~1,000/day). This is DISTINCT from an empty
// result: callers must treat it as "stop the run", never as "not found", or a
// quota wall mid-sweep would stamp thousands of books with false-negative
// verdicts (isbn_status='not_found', cover rejected, etc.).
export class GbQuotaError extends Error {
  constructor() {
    super('Google Books daily quota exceeded (HTTP 429)')
    this.name = 'GbQuotaError'
  }
}

// Once any call hits 429 we latch this: every subsequent gbVolumes() throws
// immediately without a network round-trip, so a long sweep aborts fast instead
// of hammering a dead quota.
let quotaTripped = false
export function gbQuotaTripped(): boolean {
  return quotaTripped
}

// Low-level: run a raw Google Books volumes query and return the items array.
// Returns [] on a genuine miss or transient network/parse failure, but THROWS
// GbQuotaError on 429 (quota) — see the class doc for why these must differ.
// Sleeps `delayMs` AFTER the call so a tight caller loop stays within rate.
export async function gbVolumes(query: string, opts: GbQueryOpts = {}): Promise<GbVolume[]> {
  if (quotaTripped) throw new GbQuotaError()
  const { maxResults = 5, fields = GB_FIELDS_FULL, delayMs = DEFAULT_DELAY_MS } = opts
  const keyParam = GB_KEY ? `&key=${GB_KEY}` : ''
  const url =
    `${GB_BASE}?q=${encodeURIComponent(query)}` +
    `&maxResults=${maxResults}&fields=${fields}${keyParam}`

  let res: Response
  try {
    res = await fetch(url, opts.signal ? { signal: opts.signal } : undefined)
  } catch {
    if (delayMs > 0) await sleep(delayMs)
    return [] // transient network failure — treat as a miss
  }
  if (delayMs > 0) await sleep(delayMs)

  if (res.status === 429) {
    quotaTripped = true
    throw new GbQuotaError()
  }
  if (!res.ok) return []
  try {
    const json = (await res.json()) as { items?: GbVolume[] }
    return json.items ?? []
  } catch {
    return []
  }
}

// ── Query builders ──────────────────────────────────────────────────────────

// Exact-edition lookup. Highest precision: the ISBN binds a single edition, so
// no title-matching guard is needed on the result.
export function gbVolumesByIsbn(isbn: string, opts: GbQueryOpts = {}): Promise<GbVolume[]> {
  return gbVolumes(`isbn:${isbn}`, { maxResults: 1, ...opts })
}

// Title (+ optional author) search using the structured operators. Results
// still need a title-match guard from the caller (search falls back to the
// most-popular sibling for an obscure query).
export function gbVolumesByTitleAuthor(
  title: string,
  author: string,
  opts: GbQueryOpts = {},
): Promise<GbVolume[]> {
  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`
  return gbVolumes(q, opts)
}

// Free-text title search (no operators) — historically the highest cover hit
// rate. Results need a title-match guard from the caller.
export function gbVolumesByTitle(title: string, opts: GbQueryOpts = {}): Promise<GbVolume[]> {
  return gbVolumes(title, opts)
}

// ── Cover extraction (placeholder-safe) ──────────────────────────────────────

// Normalise a Google Books cover URL: https, request the larger zoom, drop the
// page-curl overlay.
export function transformGbCoverUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
    .replace('edge=curl&', '')
    .replace('edge=curl', '')
}

// Best available image link, normalised. Prefers larger renditions.
export function pickGbImageLink(info: GbVolumeInfo): string | null {
  const img =
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail
  return img ? transformGbCoverUrl(img) : null
}

export type GbCoverResult =
  | { kind: 'cover'; url: string; volume: GbVolume }
  | { kind: 'placeholder' }
  | { kind: 'none' }

// Resolve a placeholder-verified cover from a set of volumes. For each volume
// whose own title contains every significant word of `expectedTitle`, picks the
// best image link and runs it through the pHash placeholder check + strip
// repair. The FIRST clean cover wins. If every candidate was Google's "image
// not available" placeholder, returns { kind: 'placeholder' } so the caller can
// record cover_status='rejected_placeholder' and stop re-trying.
//
// This is the single chokepoint that keeps placeholders out of cover_url — any
// new caller fetching a GB cover should go through here rather than reading
// imageLinks directly.
//
// `requireTitleMatch` (default true) enforces the title-containment guard, which
// is essential for title/free-text searches (they fall back to the most-popular
// sibling). Set it to false ONLY for ISBN-direct lookups, where the ISBN already
// binds the exact edition — there the volume's title legitimately differs from
// our canonical title (translations, romanisations) and the guard would wrongly
// reject a correct cover. The placeholder + strip checks run regardless.
export async function resolveGbCover(
  volumes: GbVolume[],
  expectedTitle: string,
  opts: { requireTitleMatch?: boolean } = {},
): Promise<GbCoverResult> {
  const requireTitleMatch = opts.requireTitleMatch ?? true
  let sawPlaceholder = false
  for (const v of volumes) {
    if (requireTitleMatch && !titlesMatch(expectedTitle, v.volumeInfo?.title ?? '')) continue
    const raw = pickGbImageLink(v.volumeInfo)
    if (!raw) continue
    const check = await checkImageUrl(raw)
    if (check.ok === false) {
      if (check.reason === 'placeholder') {
        sawPlaceholder = true
        continue
      }
      // Transient fetch failure — keep prior lenient behaviour (accept the URL
      // rather than discarding a probably-good cover over a network blip).
      return { kind: 'cover', url: raw, volume: v }
    }
    // Reject/repair degenerate horizontal strips (top sliver Google returns at
    // zoom=3 for some books); falls back to zoom=1 or null.
    const repaired = await repairGbStrip(raw, check.width, check.height)
    if (repaired) return { kind: 'cover', url: repaired, volume: v }
    // strip with no usable fallback — keep looking at the next volume
  }
  return sawPlaceholder ? { kind: 'placeholder' } : { kind: 'none' }
}

// Pull the ISBN-13 out of a volume's industryIdentifiers, if present.
export function gbIsbn13(info: GbVolumeInfo): string | null {
  for (const id of info.industryIdentifiers ?? []) {
    if (id.type === 'ISBN_13') return id.identifier
  }
  return null
}
