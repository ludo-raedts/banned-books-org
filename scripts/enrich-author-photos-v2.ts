/**
 * Second-pass author photo enrichment for authors where the Wikipedia-search
 * pass in `enrich-author-bios.ts --photos-only` came up empty.
 *
 * Two sources, in order:
 *   1. Wikidata: search by name, accept only entities that are
 *      instance-of human (Q5) AND have a writer-ish occupation (P106).
 *      Pick the image filename from P18, resolve to a thumbnail URL via
 *      the Commons file API.
 *   2. OpenLibrary fallback: top match from /search/authors with work_count >= 1,
 *      then HEAD-check covers.openlibrary.org/a/olid/{OLID}-L.jpg?default=false
 *      (the ?default=false makes it 404 instead of returning a 1x1 placeholder).
 *
 * Both sources serve from hosts already in src/lib/allowed-image-hosts.ts:
 *   - upload.wikimedia.org (Wikidata P18 thumbnails)
 *   - covers.openlibrary.org (OpenLibrary author photos)
 *
 * If you ever extend this with another source, add the new hostname to
 * src/lib/allowed-image-hosts.ts — Next.js will refuse to render images
 * from hosts not in that allowlist.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts                  # dry-run, 50 authors
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --limit=10       # cap at 10
 *   npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --apply          # write to DB
 *
 * Always writes a CSV log to data/photo-enrichment-{timestamp}.csv so you can
 * spot-check matches before / after applying.
 */

import { adminClient } from '../src/lib/supabase'
import * as fs from 'node:fs'
import * as path from 'node:path'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.replace('--limit=', ''), 10) : 50
const DELAY_MS = 200
const UA = 'banned-books.org/1.0 (contact@banned-books.org)'

// Substring matchers against the English label of a Wikidata occupation (P106).
// Kept broad on purpose — better to accept "memoirist" or "translator" than to skip
// a real writer because their primary occupation label is unusual.
const WRITER_TERMS = [
  'writer', 'author', 'poet', 'novelist', 'journalist',
  'playwright', 'dramatist', 'essayist', 'screenwriter', 'columnist',
  'biographer', 'memoirist', 'translator', 'editor',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

// ─── Wikidata ────────────────────────────────────────────────────────────────

interface WdSearchHit { id: string; label?: string; description?: string }
interface WdSearchResp { search?: WdSearchHit[] }

interface WdClaim {
  mainsnak?: { datavalue?: { value?: unknown } }
}
interface WdEntity {
  claims?: Record<string, WdClaim[]>
}
interface WdEntityResp { entities?: Record<string, WdEntity> }

interface WdLabelEntity { labels?: { en?: { value: string } } }
interface WdLabelResp { entities?: Record<string, WdLabelEntity> }

interface CommonsImageInfo { thumburl?: string }
interface CommonsPage { imageinfo?: CommonsImageInfo[] }
interface CommonsResp { query?: { pages?: Record<string, CommonsPage> } }

function claimIds(claims: Record<string, WdClaim[]> | undefined, prop: string): string[] {
  return (claims?.[prop] ?? [])
    .map(c => {
      const v = c.mainsnak?.datavalue?.value
      if (typeof v === 'object' && v !== null && 'id' in v) return (v as { id: string }).id
      return null
    })
    .filter((x): x is string => Boolean(x))
}

function claimString(claims: Record<string, WdClaim[]> | undefined, prop: string): string | null {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value
  return typeof v === 'string' ? v : null
}

async function resolveCommonsImageUrl(filename: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + filename)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
  const data = await fetchJson<CommonsResp>(url)
  const pages = Object.values(data?.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.thumburl ?? null
}

interface PhotoResult {
  source: 'wikidata' | 'openlibrary' | null
  url: string | null
  meta: string
}

async function tryWikidata(name: string): Promise<PhotoResult> {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=5&format=json&origin=*`
  const search = await fetchJson<WdSearchResp>(searchUrl)
  const candidates = search?.search ?? []
  if (candidates.length === 0) return { source: null, url: null, meta: 'no wikidata match' }

  for (const cand of candidates) {
    await sleep(DELAY_MS)
    const ent = await fetchJson<WdEntityResp>(`https://www.wikidata.org/wiki/Special:EntityData/${cand.id}.json`)
    const claims = ent?.entities?.[cand.id]?.claims
    if (!claims) continue

    // Must be a human
    if (!claimIds(claims, 'P31').includes('Q5')) continue

    // Must have at least one writer-ish occupation
    const occIds = claimIds(claims, 'P106')
    if (occIds.length === 0) continue

    await sleep(DELAY_MS)
    const labelsResp = await fetchJson<WdLabelResp>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${occIds.join('|')}&props=labels&languages=en&format=json&origin=*`
    )
    const occLabels = Object.values(labelsResp?.entities ?? {})
      .map(e => e?.labels?.en?.value)
      .filter((s): s is string => Boolean(s))
      .map(s => s.toLowerCase())
    const isWriter = occLabels.some(lbl => WRITER_TERMS.some(t => lbl.includes(t)))
    if (!isWriter) continue

    const imageFile = claimString(claims, 'P18')
    if (!imageFile) continue

    await sleep(DELAY_MS)
    const url = await resolveCommonsImageUrl(imageFile)
    if (!url) continue

    return {
      source: 'wikidata',
      url,
      meta: `qid=${cand.id} occ=${occLabels.slice(0, 2).join('/')}`,
    }
  }

  return { source: null, url: null, meta: 'wikidata: no human writer with P18 found' }
}

// ─── OpenLibrary ─────────────────────────────────────────────────────────────

interface OlAuthorDoc { key?: string; name?: string; work_count?: number; birth_date?: string }
interface OlAuthorResp { docs?: OlAuthorDoc[] }

async function tryOpenLibrary(name: string): Promise<PhotoResult> {
  const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=3`
  const data = await fetchJson<OlAuthorResp>(searchUrl)
  const docs = data?.docs ?? []
  if (docs.length === 0) return { source: null, url: null, meta: 'no openlibrary match' }

  for (const doc of docs) {
    if (!doc.key) continue
    if ((doc.work_count ?? 0) < 1) continue
    // ?default=false → 404 if no real photo, else returns the actual image
    const photoUrl = `https://covers.openlibrary.org/a/olid/${doc.key}-L.jpg?default=false`
    await sleep(DELAY_MS)
    let head: Response
    try {
      head = await fetch(photoUrl, { method: 'HEAD', headers: { 'User-Agent': UA } })
    } catch {
      continue
    }
    if (head.ok) {
      return {
        source: 'openlibrary',
        url: photoUrl,
        meta: `olid=${doc.key} works=${doc.work_count ?? 0}`,
      }
    }
  }
  return { source: null, url: null, meta: 'openlibrary: no match with photo' }
}

// ─── CSV log ─────────────────────────────────────────────────────────────────

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── enrich-author-photos-v2 (${APPLY ? 'APPLY' : 'DRY-RUN'}, limit=${LIMIT}) ──\n`)

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('authors')
    .select('id, display_name, slug')
    .is('photo_url', null)
    .not('slug', 'is', null)
    .order('display_name')
    .limit(LIMIT)

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  type AuthorRow = { id: string; display_name: string; slug: string }
  const authors = (data ?? []) as AuthorRow[]
  if (authors.length === 0) { console.log('No authors without photo_url found.'); return }

  console.log(`Found ${authors.length} author(s) without photo.\n`)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const csvPath = path.join(process.cwd(), 'data', `photo-enrichment-${ts}.csv`)
  fs.mkdirSync(path.dirname(csvPath), { recursive: true })
  const csvRows: string[] = ['author_id,display_name,source,url,meta,status']

  let accepted = 0
  let skipped = 0

  for (const author of authors) {
    const wdResult = await tryWikidata(author.display_name)
    let result = wdResult
    if (!result.url) {
      await sleep(DELAY_MS)
      const olResult = await tryOpenLibrary(author.display_name)
      result = olResult.url
        ? olResult
        : { source: null, url: null, meta: `wd: ${wdResult.meta} | ol: ${olResult.meta}` }
    }

    const status = result.url ? 'accepted' : 'skipped'
    const symbol = result.url ? '✓' : '✗'
    const sourceLabel = result.source ?? '—'
    console.log(`${symbol} ${author.display_name.padEnd(40)} ${sourceLabel.padEnd(11)} ${result.meta}`)

    csvRows.push([
      csvEscape(author.id),
      csvEscape(author.display_name),
      csvEscape(result.source),
      csvEscape(result.url),
      csvEscape(result.meta),
      csvEscape(status),
    ].join(','))

    if (result.url) {
      if (APPLY) {
        const { error: ue } = await supabase
          .from('authors')
          .update({ photo_url: result.url })
          .eq('id', author.id)
        if (ue) { console.error(`  DB error: ${ue.message}`); skipped++; continue }
      }
      accepted++
    } else {
      skipped++
    }

    await sleep(DELAY_MS)
  }

  fs.writeFileSync(csvPath, csvRows.join('\n') + '\n', 'utf8')

  console.log(`\n── Done ──`)
  console.log(`Accepted : ${accepted}`)
  console.log(`Skipped  : ${skipped}`)
  console.log(`CSV log  : ${path.relative(process.cwd(), csvPath)}`)
  if (!APPLY) console.log(`\nDry-run complete. Re-run with --apply to write to DB.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
