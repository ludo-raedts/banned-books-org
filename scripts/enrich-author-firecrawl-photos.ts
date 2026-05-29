#!/usr/bin/env tsx
/**
 * Firecrawl photo-only enrichment for the largest Tier-3 cluster: 789
 * Latin-script authors that already have a bio but no photo_url. Source:
 * EN Wikipedia, one Firecrawl scrape per author.
 *
 * Pipeline per author:
 *   1. EN Wikipedia opensearch (free) → article title
 *   2. Surname-gate (matches diagnostic): surname token must appear in title.
 *      Drops 60+ false-positive matches like
 *        "Andrea Robertson" → "André Roberson"
 *      that survived the diagnostic's looser prefix gate.
 *   3. Firecrawl scrape → first non-icon Wikimedia Commons image
 *   4. Validate URL through isAllowedImageUrl() — never write a URL that
 *      next/image will 500 on
 *   5. UPDATE authors SET photo_url = … (only if --apply)
 *
 * Resumable: saves progress to data/firecrawl-photos-state.json every 25
 * authors. Re-run with --resume to continue from the last save.
 *
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-photos.ts                # dry-run, all candidates
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-photos.ts --limit=20    # first 20 only
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-photos.ts --apply       # write to DB
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-photos.ts --apply --resume
 *
 * Budget: ~1 Firecrawl credit per author. Full set ≈ 789 credits.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'

const execFileP = promisify(execFile)

const APPLY = process.argv.includes('--apply')
const RESUME = process.argv.includes('--resume')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG.slice(8), 10) || 0) : 0

const PAGE = 1000
const WIKI_DELAY_MS = 200
const WIKI_UA =
  'banned-books-org-enrichment/1.0 (https://banned-books.org; ludo.raedts@voys.nl)'
const STATE_PATH = join(process.cwd(), 'data/firecrawl-photos-state.json')
const CSV_DIR = join(process.cwd(), 'data')

const NON_LATIN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Greek}]/u

type Author = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  photo_url: string | null
}

type Outcome =
  | 'applied'
  | 'planned' // dry-run, would-apply
  | 'no-wiki-match'
  | 'fuzzy-mismatch'
  | 'no-image-found'
  | 'image-rejected-by-host'
  | 'firecrawl-error'

type Result = {
  id: number
  display_name: string
  slug: string
  book_count: number
  wiki_title: string | null
  photo_url: string | null
  outcome: Outcome
  note?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ── Surname gate (matches _audit_tier3_wikipedia_coverage.ts) ─────────────

const TRAILING_NOISE = /^(jr\.?|sr\.?|i{1,3}v?|i?v|md|phd|esq\.?|\([^)]*\))$/i

function extractSurname(displayName: string): string {
  const s = displayName.trim()
  const commaIdx = s.indexOf(',')
  if (commaIdx > 0) return s.slice(0, commaIdx).trim().replace(/[.,;:]+$/, '')
  const tokens = s.split(/\s+/).filter(t => t.length > 0)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const cleaned = tokens[i].replace(/[.,;:!?]+$/, '')
    if (!TRAILING_NOISE.test(cleaned) && cleaned.length >= 2) return cleaned
  }
  return tokens[tokens.length - 1]?.replace(/[.,;:!?]+$/, '') ?? ''
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function articleMatchesSurname(displayName: string, articleTitle: string): boolean {
  const surname = extractSurname(displayName)
  if (surname.length < 2) return false
  const re = new RegExp(`\\b${escapeRegex(surname)}\\b`, 'i')
  return re.test(articleTitle)
}

// ── Wikipedia + Firecrawl ─────────────────────────────────────────────────

async function wikiOpenSearchEn(query: string): Promise<string | null> {
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.searchParams.set('action', 'opensearch')
  url.searchParams.set('search', query)
  url.searchParams.set('limit', '1')
  url.searchParams.set('format', 'json')
  url.searchParams.set('namespace', '0')
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) return null
    const data = (await res.json()) as [string, string[], string[], string[]]
    return data[1]?.[0] ?? null
  } catch {
    return null
  }
}

function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

async function firecrawlScrape(url: string): Promise<string> {
  const { stdout } = await execFileP(
    'firecrawl',
    ['scrape', url, '--only-main-content', '--format', 'markdown'],
    { maxBuffer: 10 * 1024 * 1024 },
  )
  return stdout
}

// Blacklist of filename fragments that strongly indicate "not a portrait".
// Discovered empirically in the photo-only pilot dry-run: flags (nationality
// infobox), maps (subject's country), Ambox templates (maintenance banners),
// audio icons, project logos, and coats-of-arms all turned up as the first
// inline image when the article had no real person-photo. Case-insensitive.
const NON_PORTRAIT_KEYWORDS = [
  'Flag_of', 'Flag-of', 'Flag_Of',
  'Map_of', 'Karte_', 'Locator_',
  'Ambox_', 'Template-', 'Question_book', 'Edit-clear', 'Disambig_',
  'Stub_', 'Crystal_', 'Padlock',
  'Coat_of_arms', 'Wappen_', 'Escudo_',
  'Loudspeaker', 'Speakerlink', 'Sound-icon',
  'Commons-logo', 'Wikidata-logo', 'Wiktionary-logo', 'Wikisource-logo',
  'Wikinews-logo', 'Wikibooks-logo', 'Wikiquote-logo',
  'Symbol_', 'Logo_', '_Logo.',
  'Signature', '_signature.',
]
const NON_PORTRAIT_RE = new RegExp(
  NON_PORTRAIT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
)

function extractFirstWikimediaImage(md: string): string | null {
  const re = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    const url = m[1]
    if (!/upload\.wikimedia\.org/.test(url)) continue
    // SVG: almost always a logo / flag / icon, not a person photograph.
    // Real Wikipedia portraits are JPG (occasionally PNG).
    if (/\.svg(?:[?/]|$)/i.test(url) || /\/svg\//i.test(url)) continue
    if (NON_PORTRAIT_RE.test(url)) continue
    // Skip favicons & list-icon thumbnails.
    if (/\/(?:16|20|24|32|48)px-/.test(url)) continue
    return url
  }
  return null
}

// ── Data fetch ─────────────────────────────────────────────────────────────

async function fetchPhotoOnlyCandidates(
  sb: ReturnType<typeof adminClient>,
): Promise<Author[]> {
  const out: Author[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('authors')
      .select('id, display_name, slug, bio, photo_url')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as Author[]) {
      if (NON_LATIN.test(r.display_name)) continue
      const hasBio = !!r.bio && r.bio.trim().length > 0
      const missingPhoto = !r.photo_url || r.photo_url.trim() === ''
      if (!hasBio || !missingPhoto) continue
      out.push(r)
    }
    if (data.length < PAGE) break
  }
  return out
}

async function fetchBookCounts(
  sb: ReturnType<typeof adminClient>,
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('book_authors')
      .select('author_id, book_id')
      .order('book_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const aid = r.author_id as number
      counts.set(aid, (counts.get(aid) ?? 0) + 1)
    }
    if (data.length < PAGE) break
  }
  return counts
}

// ── State ─────────────────────────────────────────────────────────────────

type SavedState = { startedAt: string; results: Result[] }

function loadState(): SavedState | null {
  if (!existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as SavedState
  } catch {
    return null
  }
}

function saveState(s: SavedState): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2))
}

// ── Process one author ────────────────────────────────────────────────────

async function processOne(
  sb: ReturnType<typeof adminClient>,
  a: Author,
  bookCount: number,
): Promise<Result> {
  const base: Omit<Result, 'outcome'> = {
    id: a.id,
    display_name: a.display_name,
    slug: a.slug,
    book_count: bookCount,
    wiki_title: null,
    photo_url: null,
  }

  await sleep(WIKI_DELAY_MS)
  const title = await wikiOpenSearchEn(a.display_name)
  if (!title) return { ...base, outcome: 'no-wiki-match' }
  base.wiki_title = title

  if (!articleMatchesSurname(a.display_name, title))
    return { ...base, outcome: 'fuzzy-mismatch' }

  let md: string
  try {
    md = await firecrawlScrape(wikiUrl(title))
  } catch (e) {
    return { ...base, outcome: 'firecrawl-error', note: (e as Error).message }
  }

  const photo = extractFirstWikimediaImage(md)
  if (!photo) return { ...base, outcome: 'no-image-found' }

  if (!isAllowedImageUrl(photo))
    return { ...base, outcome: 'image-rejected-by-host', photo_url: photo }

  base.photo_url = photo

  if (APPLY) {
    const { error } = await sb
      .from('authors')
      .update({ photo_url: photo })
      .eq('id', a.id)
    if (error) return { ...base, outcome: 'firecrawl-error', note: error.message }
    return { ...base, outcome: 'applied' }
  }
  return { ...base, outcome: 'planned' }
}

// ── CSV log ────────────────────────────────────────────────────────────────

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`
  return s
}

function writeCsvLog(results: Result[]): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(CSV_DIR, `firecrawl-photos-${ts}.csv`)
  mkdirSync(CSV_DIR, { recursive: true })
  const rows = ['id,display_name,book_count,outcome,wiki_title,photo_url,note']
  for (const r of results) {
    rows.push(
      [
        r.id,
        csvEscape(r.display_name),
        r.book_count,
        r.outcome,
        csvEscape(r.wiki_title),
        csvEscape(r.photo_url),
        csvEscape(r.note),
      ].join(','),
    )
  }
  writeFileSync(path, rows.join('\n') + '\n', 'utf8')
  return path
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const sb = adminClient()

  console.log(
    `── enrich-author-firecrawl-photos (${APPLY ? 'APPLY' : 'DRY-RUN'}${RESUME ? ', RESUME' : ''}${LIMIT ? `, limit=${LIMIT}` : ''}) ──`,
  )

  console.log('Fetching photo-only candidates…')
  const all = await fetchPhotoOnlyCandidates(sb)
  console.log(`  ${all.length} candidate(s)`)

  console.log('Fetching book counts…')
  const counts = await fetchBookCounts(sb)

  type Pending = { author: Author; book_count: number }
  const sorted: Pending[] = all
    .map(a => ({ author: a, book_count: counts.get(a.id) ?? 0 }))
    .sort((a, b) => b.book_count - a.book_count || a.author.id - b.author.id)

  let results: Result[] = []
  let toProcess = sorted
  if (RESUME) {
    const saved = loadState()
    if (saved) {
      results = saved.results
      const done = new Set(results.map(r => r.id))
      toProcess = sorted.filter(p => !done.has(p.author.id))
      console.log(`  Resuming: ${results.length} done, ${toProcess.length} remaining`)
    }
  }
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT)
  console.log(`  Processing ${toProcess.length}\n`)

  const SAVE_EVERY = 25
  let i = 0
  for (const p of toProcess) {
    i++
    const r = await processOne(sb, p.author, p.book_count)
    results.push(r)

    const marker =
      r.outcome === 'applied'
        ? '✓'
        : r.outcome === 'planned'
          ? '·'
          : r.outcome === 'firecrawl-error'
            ? '✗'
            : '~'
    console.log(
      `  [${i}/${toProcess.length}] ${marker} id=${r.id} ${r.outcome} — ${r.display_name}${r.photo_url ? ` → ${r.photo_url.slice(0, 70)}…` : ''}`,
    )

    if (i % SAVE_EVERY === 0) {
      saveState({ startedAt: new Date().toISOString(), results })
    }
  }

  saveState({ startedAt: new Date().toISOString(), results })

  // Summary by outcome.
  const counts2 = new Map<Outcome, number>()
  for (const r of results) counts2.set(r.outcome, (counts2.get(r.outcome) ?? 0) + 1)

  const csvPath = writeCsvLog(results)
  console.log('\n── Summary ──')
  for (const o of [
    'applied',
    'planned',
    'no-wiki-match',
    'fuzzy-mismatch',
    'no-image-found',
    'image-rejected-by-host',
    'firecrawl-error',
  ] as Outcome[]) {
    const n = counts2.get(o) ?? 0
    if (n > 0) console.log(`  ${o.padEnd(24)} ${n}`)
  }
  console.log(`  CSV log: ${csvPath}`)
  if (!APPLY) console.log('\nDry-run. Re-run with --apply to write to DB.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
