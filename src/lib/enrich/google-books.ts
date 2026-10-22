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
import { titlesMatch, authorsAgree } from './title-match'

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

export const GB_FIELDS_COVER = 'items(volumeInfo(title,authors,imageLinks))'
export const GB_FIELDS_ISBN = 'items(volumeInfo(title,authors,industryIdentifiers,language))'
export const GB_FIELDS_DESCRIPTION = 'items(id,volumeInfo(title,authors,description,infoLink))'
export const GB_FIELDS_FULL =
  'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,' +
  'industryIdentifiers,pageCount,categories,maturityRating,imageLinks,language,infoLink,canonicalVolumeLink))'

// ── Core request ──────────────────────────────────────────────────────────

const GB_BASE = 'https://www.googleapis.com/books/v1/volumes'
const DEFAULT_DELAY_MS = 600

// Dedicated keys, in rotation order: GOOGLE_BOOKS_API_KEY → GOOGLE_BOOKS_API_KEY2.
// The daily quota is PER GCP PROJECT, so a second key only adds quota when it
// belongs to a different project. On a per-day 429 the client advances to the
// next key and retries; GbQuotaError is only thrown once the LAST key is
// exhausted. Falls back to GOOGLE_AI_API_KEY (Gemini — same project as key 1,
// so no extra quota) only when no dedicated key is set; '' = keyless (quota 0).
const GB_KEYS = [process.env.GOOGLE_BOOKS_API_KEY, process.env.GOOGLE_BOOKS_API_KEY2]
  .filter((k): k is string => typeof k === 'string' && k.length > 0)
if (GB_KEYS.length === 0 && process.env.GOOGLE_AI_API_KEY) GB_KEYS.push(process.env.GOOGLE_AI_API_KEY)
let keyIdx = 0

export function hasGbKey(): boolean {
  return GB_KEYS.length > 0
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
  constructor(message = 'Google Books daily quota exceeded (HTTP 429)') {
    super(message)
    this.name = 'GbQuotaError'
  }
}

// Thrown when ONE query path is unusable while Google Books as a whole still
// works (see the health probes below). Subclass of GbQuotaError so every
// existing `instanceof GbQuotaError` catch already treats it as "GB did not
// answer — skip without stamping". Callers that want to keep using the other
// GB paths for the rest of the run check for this class FIRST and only drop
// the one lookup; the shared latch (gbQuotaTripped) stays off.
export class GbUnavailableError extends GbQuotaError {
  constructor(message = 'Google Books field-restricted queries unavailable (isbn:/intitle:/inauthor: return no results)') {
    super(message)
    this.name = 'GbUnavailableError'
  }
}

// Once a daily-quota 429 lands on the LAST key we latch this: every subsequent
// gbVolumes() throws immediately without a network round-trip, so a long sweep
// aborts fast instead of hammering a dead quota.
let quotaTripped = false
export function gbQuotaTripped(): boolean {
  return quotaTripped
}

// Low-level: run a raw Google Books volumes query and return the items array.
// Returns [] on a genuine miss or transient network/parse failure, but THROWS
// GbQuotaError on 429 (quota) — see the class doc for why these must differ —
// and GbUnavailableError for an `isbn:` query while field-restricted queries
// are broken (see the health probes).
// Sleeps `delayMs` AFTER the call so a tight caller loop stays within rate.
// 429 disambiguation: the per-day quota body says "Queries per day"; a
// short-window rate limit does not. Retry rate limits, fail fatally on daily.
const DAILY_QUOTA_RE = /per day|perday|dailylimit/i
const MAX_RATE_RETRIES = 6
const MAX_5XX_RETRIES = 3        // per query: 2s, 4s, 8s
const MAX_CONSECUTIVE_5XX = 5    // queries in a row still failing → treat GB as down
let consecutive5xx = 0

// Health probes. A degraded Google Books does not only 503: it also answers
// "200, totalItems 0" for queries that certainly have hits, which callers
// cannot tell apart from a genuine miss. So before the first query and every
// PROBE_EVERY queries after that we run two probes:
//
//   (a) FREE-TEXT probe (`brave new world huxley`, hundreds of hits). No hits
//       → GB is down for real: latch quotaTripped like an exhausted quota, so
//       callers fall back to OL/Wikipedia instead of recording false misses.
//   (b) FIELD-RESTRICTED probes (`isbn:…`, `intitle:… inauthor:…`). No hits
//       while (a) succeeds → the PARTIAL regression Google has had since
//       ~2026-09-30 (Google issue tracker 569300353, P2, unfixed as of
//       2026-10-22): volumes.list returns 200/totalItems 0 for most queries
//       that carry a field operator — `isbn:` always, and `intitle:`/
//       `inauthor:` for nearly every title (verified 2026-10-22 on both keys:
//       `intitle:animal farm inauthor:orwell`, `intitle:lord of the flies
//       inauthor:golding`, `inauthor:orwell`, every `isbn:` → 0; `brave new
//       world huxley`, `hatchet paulsen`, `animal farm orwell` → hundreds).
//       A structured 0 is therefore NOT evidence of absence. In this mode:
//         • `isbn:` queries throw GbUnavailableError without a network call
//           (no free-text equivalent: a bare ISBN as free text returns junk);
//           callers skip the lookup without stamping not_found/no_match/tried.
//         • `intitle:`/`inauthor:` queries are rewritten to plain free text
//           (`intitle:hatchet inauthor:paulsen` → `hatchet paulsen`), which
//           still works. Every caller already guards free-text results with
//           title-containment + author-agreement (covers.ts has always used
//           this path), so precision is unchanged; recall is what we lose
//           for the quarantined isbn: path only.
//       Before 2026-10-22 the single canary was itself a field-restricted
//       query, so it tripped on every run and disabled GB entirely — which
//       also blocked the free-text cover tier that still works.
const PROBE_FREE_TEXT = 'brave new world huxley'
const PROBE_FIELD = ['isbn:9780061120084', 'intitle:hatchet inauthor:paulsen']
const PROBE_EVERY = 100
let callsSinceProbe = PROBE_EVERY
let inProbe = false
let fieldRestrictedBroken = false
export function gbFieldRestrictedBroken(): boolean {
  return fieldRestrictedBroken
}

const FIELD_OP_RE = /\b(intitle|inauthor|inpublisher|subject|isbn|lccn|oclc):/i
const ISBN_OP_RE = /\bisbn:/i

export function hasGbFieldOperator(query: string): boolean {
  return FIELD_OP_RE.test(query)
}

// `intitle:brave new world inauthor:huxley` → `brave new world huxley`.
export function stripGbFieldOperators(query: string): string {
  return query.replace(new RegExp(FIELD_OP_RE.source, 'gi'), '').replace(/\s+/g, ' ').trim()
}

async function probe(query: string): Promise<boolean> {
  const hits = await gbVolumes(query, { maxResults: 1, fields: 'items(id)', delayMs: 0 })
  return hits.length > 0
}

async function checkHealth(): Promise<void> {
  inProbe = true
  try {
    if (!(await probe(PROBE_FREE_TEXT))) {
      quotaTripped = true
      console.warn('[google-books] free-text health probe returned no results — Google Books looks down; disabling it for this run')
      throw new GbQuotaError('Google Books degraded (free-text probe returned no results)')
    }
    let fieldOk = true
    for (const q of PROBE_FIELD) {
      if (!(await probe(q))) { fieldOk = false; break }
    }
    if (!fieldOk && !fieldRestrictedBroken) {
      fieldRestrictedBroken = true
      console.warn(
        '[google-books] mode: field-restricted queries broken (Google issue 569300353) — ' +
        'isbn: lookups are skipped as unavailable (no verdict stamped); intitle:/inauthor: lookups run as free text',
      )
    } else if (fieldOk && fieldRestrictedBroken) {
      fieldRestrictedBroken = false
      console.warn('[google-books] mode: field-restricted queries work again — back to structured queries')
    }
  } finally {
    inProbe = false
    callsSinceProbe = 0
  }
}

export async function gbVolumes(query: string, opts: GbQueryOpts = {}): Promise<GbVolume[]> {
  if (quotaTripped) throw new GbQuotaError()
  if (!inProbe) {
    if (++callsSinceProbe > PROBE_EVERY) await checkHealth()
    if (fieldRestrictedBroken && hasGbFieldOperator(query)) {
      if (ISBN_OP_RE.test(query)) throw new GbUnavailableError()
      query = stripGbFieldOperators(query)
    }
  }
  const { maxResults = 5, fields = GB_FIELDS_FULL, delayMs = DEFAULT_DELAY_MS } = opts

  for (let attempt = 0; ; attempt++) {
    // URL is rebuilt per attempt: a daily-quota 429 can rotate keyIdx mid-loop.
    const key = GB_KEYS[keyIdx] ?? ''
    const keyParam = key ? `&key=${key}` : ''
    const url =
      `${GB_BASE}?q=${encodeURIComponent(query)}` +
      `&maxResults=${maxResults}&fields=${fields}${keyParam}`

    let res: Response
    try {
      // Default 30s timeout: a stalled connection must never hang a caller's
      // worker pool (a fetch without signal waits indefinitely).
      res = await fetch(url, { signal: opts.signal ?? AbortSignal.timeout(30_000) })
    } catch {
      if (delayMs > 0) await sleep(delayMs)
      return [] // transient network failure / timeout — treat as a miss
    }

    if (res.status === 429) {
      // 429 has TWO meanings; tell them apart by the body:
      //   - per-day quota exhausted → fatal, throw GbQuotaError (caller stops).
      //   - short-window rate limit ("per minute"/"per 100 seconds") → transient;
      //     back off (2s,4s,8s,16s,32s,60s) and RETRY. Latching this as fatal was
      //     a bug: a run aborted after ~100 calls and wasted the daily quota.
      const body = await res.text().catch(() => '')
      if (DAILY_QUOTA_RE.test(body)) {
        if (keyIdx < GB_KEYS.length - 1) {
          keyIdx++
          console.warn(`[google-books] daily quota exhausted on key ${keyIdx}/${GB_KEYS.length} — rotating to key ${keyIdx + 1}`)
          attempt = -1 // fresh backoff budget on the new key
          continue
        }
        quotaTripped = true
        throw new GbQuotaError()
      }
      if (attempt < MAX_RATE_RETRIES) {
        await sleep(Math.min(60_000, 2_000 * 2 ** attempt))
        continue
      }
      // Still rate-limited after full backoff — stop cleanly; the cursor lets the
      // next scheduled run resume where we left off.
      quotaTripped = true
      throw new GbQuotaError()
    }

    if (res.status >= 500) {
      // 5xx = Google Books itself is down (Oct 2026: hours of 503 "Service
      // temporarily unavailable" on BOTH keys). Returning [] here made callers
      // record a miss ("no GB data", cover sources_tried) for every book.
      // Back off and retry; if it persists, latch like an exhausted quota so
      // callers stop using GB this run instead of writing false negatives.
      if (attempt < MAX_5XX_RETRIES) {
        await sleep(2_000 * 2 ** attempt)
        continue
      }
      if (++consecutive5xx >= MAX_CONSECUTIVE_5XX) {
        quotaTripped = true
        console.warn(`[google-books] ${consecutive5xx} queries in a row failed with HTTP ${res.status} — Google Books looks down; disabling it for this run`)
        throw new GbQuotaError(`Google Books unavailable (HTTP ${res.status})`)
      }
      return []
    }
    consecutive5xx = 0

    if (delayMs > 0) await sleep(delayMs)
    if (!res.ok) return []
    try {
      const json = (await res.json()) as { items?: GbVolume[] }
      return json.items ?? []
    } catch {
      return []
    }
  }
}

// ── Query builders ──────────────────────────────────────────────────────────

// Exact-edition lookup. Highest precision: the ISBN binds a single edition, so
// no title-matching guard is needed on the result. Throws GbUnavailableError
// (no network call) while field-restricted queries are broken.
export function gbVolumesByIsbn(isbn: string, opts: GbQueryOpts = {}): Promise<GbVolume[]> {
  return gbVolumes(`isbn:${isbn}`, { maxResults: 1, ...opts })
}

// Title (+ optional author) search using the structured operators. Results
// still need a title-match guard from the caller (search falls back to the
// most-popular sibling for an obscure query). While field-restricted queries
// are broken this transparently runs as free text (`title author`).
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
  opts: { requireTitleMatch?: boolean; expectedAuthor?: string } = {},
): Promise<GbCoverResult> {
  const requireTitleMatch = opts.requireTitleMatch ?? true
  let sawPlaceholder = false
  for (const v of volumes) {
    if (requireTitleMatch && !titlesMatch(expectedTitle, v.volumeInfo?.title ?? '')) continue
    // Author guard for title/free-text searches: title containment alone lets a
    // same-word wrong book through (e.g. "A Feast for the Seaweeds" → "Seaweed:
    // A Global History"). Lenient — only rejects when both sides name authors
    // and none overlap. Skipped for ISBN-direct lookups (requireTitleMatch off),
    // where the ISBN already binds the exact edition.
    if (requireTitleMatch && opts.expectedAuthor && !authorsAgree(opts.expectedAuthor, v.volumeInfo?.authors ?? [])) continue
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
