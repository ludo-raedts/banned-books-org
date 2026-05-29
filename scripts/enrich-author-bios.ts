/**
 * Enrich author records in Supabase using Wikipedia as the primary source.
 *
 * Default mode — for each author without a bio (bio IS NULL):
 *   1. Search Wikipedia for the author's name
 *   2. Fetch intro extract, birth year, death year, nationality/country, photo
 *   3. Write bio, birth_year, death_year, birth_country, photo_url to DB
 *
 * --photos-only mode — for each author with a bio but no photo
 * (bio IS NOT NULL AND photo_url IS NULL): fetch and write only photo_url,
 * leaving the existing bio and dates untouched. Use this to backfill
 * pictures for authors who were enriched before they had a Wikipedia infobox
 * thumbnail, or whose bio was filled manually.
 *
 * Resumability — authors that we permanently can't enrich (no Wikipedia
 * page, disambig hit, non-person article, no thumbnail in photos-only)
 * are cached to `data/enrich-author-bios.state.json` and excluded on the
 * next run. Without this, every invocation re-tries the same alphabetically-
 * first names. Pass --retry-skipped to ignore the cache for one run, or
 * --reset-cache to wipe it.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts                    # dry-run, up to 50
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply            # write to DB
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --limit=10         # cap at 10
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --photos-only --apply
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --retry-skipped    # re-try cached skips
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --reset-cache      # wipe skip cache
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { authorLadder } from '../src/lib/enrich/_author-ladder'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { cleanWikiExtract } from '../src/lib/text/clean-wiki-extract'

const APPLY = process.argv.includes('--apply')
const PHOTOS_ONLY = process.argv.includes('--photos-only')
const RETRY_SKIPPED = process.argv.includes('--retry-skipped')
const RESET_CACHE = process.argv.includes('--reset-cache')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.replace('--limit=', ''), 10) : 50
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='))
const IDS = IDS_ARG ? IDS_ARG.replace('--ids=', '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n)) : null
const DELAY_MS = 200
const WIKI_UA = 'banned-books.org/1.0 (contact@banned-books.org)'
const CACHE_PATH = path.resolve(process.cwd(), 'data/enrich-author-bios.state.json')

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Wikipedia types ─────────────────────────────────────────────────────────

interface WikiSearchResult {
  query: {
    search: Array<{ pageid: number; title: string }>
  }
}

interface WikiPageResult {
  query: {
    pages: Record<string, {
      pageid: number
      title: string
      extract?: string
      thumbnail?: { source: string }
      categories?: Array<{ title: string }>
    }>
  }
}

interface WikiFullExtract {
  query: {
    pages: Record<string, { extract?: string }>
  }
}

// ─── Wikipedia helpers ────────────────────────────────────────────────────────

async function searchWikipedia(name: string): Promise<number | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) return null
    const data = await res.json() as WikiSearchResult
    const hit = data?.query?.search?.[0]
    return hit?.pageid ?? null
  } catch { return null }
}

async function fetchPageDetails(pageId: number): Promise<{
  extract: string | null
  photo: string | null
  categories: string[]
}> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|pageimages|categories&exintro=true&exsentences=8&pithumbsize=400&pilicense=any&cllimit=50&format=json`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) return { extract: null, photo: null, categories: [] }
    const data = await res.json() as WikiPageResult
    const page = Object.values(data?.query?.pages ?? {})[0]
    if (!page) return { extract: null, photo: null, categories: [] }
    return {
      extract: page.extract ?? null,
      photo: page.thumbnail?.source ?? null,
      categories: (page.categories ?? []).map(c => c.title),
    }
  } catch { return { extract: null, photo: null, categories: [] } }
}

async function fetchFullExtract(pageId: number): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&format=json`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) return null
    const data = await res.json() as WikiFullExtract
    const page = Object.values(data?.query?.pages ?? {})[0]
    return page?.extract ?? null
  } catch { return null }
}

// ─── Data extraction ──────────────────────────────────────────────────────────

function extractYearFromCategories(categories: string[], type: 'births' | 'deaths'): number | null {
  for (const cat of categories) {
    // e.g. "Category:1947 births" or "Category:1950 deaths"
    const m = cat.match(/Category:(\d{4})\s+/)
    if (m && cat.toLowerCase().includes(type)) {
      return parseInt(m[1], 10)
    }
  }
  return null
}

// Mapping from adjective/gentilicial words found in categories → country name
const NATIONALITY_MAP: Record<string, string> = {
  'american': 'United States',
  'canadian': 'Canada',
  'british': 'United Kingdom',
  'english': 'United Kingdom',
  'scottish': 'United Kingdom',
  'welsh': 'United Kingdom',
  'irish': 'Ireland',
  'australian': 'Australia',
  'new zealand': 'New Zealand',
  'french': 'France',
  'german': 'Germany',
  'austrian': 'Austria',
  'swiss': 'Switzerland',
  'dutch': 'Netherlands',
  'belgian': 'Belgium',
  'swedish': 'Sweden',
  'norwegian': 'Norway',
  'danish': 'Denmark',
  'finnish': 'Finland',
  'icelandic': 'Iceland',
  'spanish': 'Spain',
  'portuguese': 'Portugal',
  'italian': 'Italy',
  'greek': 'Greece',
  'russian': 'Russia',
  'soviet': 'Soviet Union',
  'ukrainian': 'Ukraine',
  'polish': 'Poland',
  'czech': 'Czech Republic',
  'hungarian': 'Hungary',
  'romanian': 'Romania',
  'bulgarian': 'Bulgaria',
  'serbian': 'Serbia',
  'croatian': 'Croatia',
  'turkish': 'Turkey',
  'iranian': 'Iran',
  'israeli': 'Israel',
  'egyptian': 'Egypt',
  'nigerian': 'Nigeria',
  'kenyan': 'Kenya',
  'south african': 'South Africa',
  'ghanaian': 'Ghana',
  'zimbabwean': 'Zimbabwe',
  'tanzanian': 'Tanzania',
  'ugandan': 'Uganda',
  'senegalese': 'Senegal',
  'cameroonian': 'Cameroon',
  'congolese': 'Democratic Republic of the Congo',
  'ethiopian': 'Ethiopia',
  'indian': 'India',
  'pakistani': 'Pakistan',
  'bangladeshi': 'Bangladesh',
  'sri lankan': 'Sri Lanka',
  'nepali': 'Nepal',
  'chinese': 'China',
  'japanese': 'Japan',
  'korean': 'South Korea',
  'vietnamese': 'Vietnam',
  'thai': 'Thailand',
  'indonesian': 'Indonesia',
  'filipino': 'Philippines',
  'malaysian': 'Malaysia',
  'singaporean': 'Singapore',
  'mexican': 'Mexico',
  'colombian': 'Colombia',
  'chilean': 'Chile',
  'argentinian': 'Argentina',
  'argentine': 'Argentina',
  'peruvian': 'Peru',
  'venezuelan': 'Venezuela',
  'brazilian': 'Brazil',
  'cuban': 'Cuba',
  'puerto rican': 'Puerto Rico',
  'jamaican': 'Jamaica',
  'haitian': 'Haiti',
}

// Category-fragment terms that indicate the page subject is a person who
// writes/creates. Used both to derive nationality and as a person-signal
// gate (see hasWriterCategory below).
const WRITER_CATEGORY_TERMS = [
  'novelists', 'writers', 'authors', 'poets', 'dramatists', 'playwrights',
  'journalists', 'essayists', 'screenwriters', 'editors', 'biographers',
  'memoirists', 'columnists', 'lyricists', 'translators', 'illustrators',
  'cartoonists', 'mangaka', 'manga artists', 'comics artists',
  'children\'s writers', 'songwriters',
]

function extractNationalityFromCategories(categories: string[]): string | null {
  for (const cat of categories) {
    const lower = cat.toLowerCase()
    const hasWriterTerm = WRITER_CATEGORY_TERMS.some(t => lower.includes(t))
    if (!hasWriterTerm) continue

    // Strip "Category:" prefix and lowercase
    const body = lower.replace(/^category:/, '').trim()
    // Try longest match first (e.g. "south african" before "african")
    const sorted = Object.entries(NATIONALITY_MAP).sort((a, b) => b[0].length - a[0].length)
    for (const [adj, country] of sorted) {
      if (body.startsWith(adj)) return country
    }
  }
  return null
}

function hasWriterCategory(categories: string[]): boolean {
  return categories.some(c => {
    const lower = c.toLowerCase()
    return WRITER_CATEGORY_TERMS.some(t => lower.includes(t))
  })
}

// Disambiguation-page detector. Wikipedia extracts for disambig pages
// follow a stable pattern: "X may refer to:" (sometimes "X or Y may refer
// to:") near the top. Stripping HTML first, then checking the first
// ~120 chars is enough.
function isDisambigExtract(html: string): boolean {
  const text = stripHtml(html).toLowerCase()
  const head = text.slice(0, 120)
  if (head.startsWith('may refer to')) return true
  return /^[^.!?\n]{0,100}\bmay refer to\b/.test(head)
}

function hasDisambigCategory(categories: string[]): boolean {
  return categories.some(c => /\bdisambiguation\b/i.test(c))
}

function hasCensorshipContent(fullText: string): boolean {
  const lower = fullText.toLowerCase()
  return ['ban', 'censor', 'suppress', 'prohibit', 'challeng', 'obscen', 'banned', 'forbidden']
    .some(kw => lower.includes(kw))
}

// Strip HTML tags, decode entities, and remove bracketed IPA pronunciation
// — Wikipedia extracts include all three. `cleanWikiExtract` handles the
// last two; the tag strip stays here because the extract-API HTML is the
// only place we see real tags.
function stripHtml(html: string): string {
  const noTags = html
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleanWikiExtract(noTags)
}

// ─── Skip cache ───────────────────────────────────────────────────────────────
// Authors that Wikipedia permanently can't help with (no page, disambig hit,
// non-person article, no thumbnail in photos-only mode) get pinned here so
// subsequent runs skip past them instead of re-burning API calls on the same
// alphabetically-first names. Separate buckets per mode because the skip
// criteria differ (a "no thumbnail" author is still a valid bio candidate).

type CacheBucket = { skippedIds: number[] }
type Cache = { bios: CacheBucket; photosOnly: CacheBucket; updatedAt?: string }

function loadCache(): Cache {
  const empty: Cache = { bios: { skippedIds: [] }, photosOnly: { skippedIds: [] } }
  if (RESET_CACHE) {
    try { fs.unlinkSync(CACHE_PATH) } catch { /* no-op */ }
    return empty
  }
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Cache>
    return {
      bios: { skippedIds: parsed.bios?.skippedIds ?? [] },
      photosOnly: { skippedIds: parsed.photosOnly?.skippedIds ?? [] },
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return empty
  }
}

function saveCache(cache: Cache): void {
  cache.updatedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8')
}

// ─── Bio construction ─────────────────────────────────────────────────────────

function buildBio(params: {
  extract: string
  authorName: string
  birthYear: number | null
  deathYear: number | null
  birthCountry: string | null
  hasCensorship: boolean
}): string {
  const { extract, birthYear, deathYear, birthCountry, hasCensorship } = params

  // Clean up the extract
  let prose = stripHtml(extract).replace(/\s+/g, ' ').trim()

  // Append birth/death/country context if not already obviously present in first sentence
  const metaParts: string[] = []
  if (birthYear && birthCountry && !prose.toLowerCase().includes(birthYear.toString())) {
    metaParts.push(`born in ${birthCountry} in ${birthYear}`)
    if (deathYear) metaParts.push(`died in ${deathYear}`)
  } else if (birthYear && !prose.includes(birthYear.toString())) {
    metaParts.push(`born ${birthYear}`)
    if (deathYear && !prose.includes(deathYear.toString())) metaParts.push(`died ${deathYear}`)
  }
  if (metaParts.length > 0) {
    const suffix = metaParts.join(', ')
    // Only append if it adds value and prose doesn't already contain this info
    if (!prose.endsWith('.')) prose += '.'
    prose += ` (${suffix}.)`
  }

  if (hasCensorship && !prose.toLowerCase().includes('ban') && !prose.toLowerCase().includes('censor')) {
    prose += ' Their work has been subject to censorship or banning challenges.'
  }

  return prose
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = PHOTOS_ONLY ? 'photos-only' : 'bios'
  console.log(`\n── enrich-author-bios (${APPLY ? 'APPLY' : 'DRY-RUN'}, mode=${mode}, limit=${LIMIT}) ──\n`)

  type AuthorRow = {
    id: number
    display_name: string
    slug: string
    name_native: string | null
    name_transliterated: string | null
    name_english: string | null
    original_language: string | null
  }

  const cache = loadCache()
  const bucket = PHOTOS_ONLY ? cache.photosOnly : cache.bios
  const skipSet = new Set<number>(RETRY_SKIPPED || IDS ? [] : bucket.skippedIds)
  if (RESET_CACHE) console.log('Cache reset.')
  else if (RETRY_SKIPPED) console.log(`Cache ignored for this run (${bucket.skippedIds.length} previously-skipped IDs).`)
  else if (skipSet.size > 0) console.log(`Excluding ${skipSet.size} previously-skipped author(s) from query.`)

  // Flush the cache on Ctrl-C so partial progress isn't lost. Installed
  // here, before the long loop, so an interrupt mid-run still pins what
  // we've already learned.
  process.on('SIGINT', () => { saveCache(cache); console.log('\nInterrupted — cache saved.'); process.exit(130) })

  const supabase = adminClient()

  // Paginate the candidate set client-side so we can filter out cached
  // skipped IDs without blowing the URL length limit on `.not('id','in',...)`.
  // Pagination needs a stable order — display_name plus id as tie-breaker
  // (per the Supabase pagination memory). Stops once we have LIMIT survivors
  // or the source is exhausted.
  const PAGE = 1000
  const authors: AuthorRow[] = []
  let offset = 0
  let totalScanned = 0
  while (authors.length < LIMIT) {
    let q = supabase
      .from('authors')
      .select('id, display_name, slug, name_native, name_transliterated, name_english, original_language')
      .not('slug', 'is', null)
      .order('display_name')
      .order('id')
      .range(offset, offset + PAGE - 1)

    q = PHOTOS_ONLY ? q.not('bio', 'is', null).is('photo_url', null) : q.is('bio', null)
    if (IDS) q = q.in('id', IDS)

    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    const page = (data ?? []) as AuthorRow[]
    totalScanned += page.length
    for (const row of page) {
      if (skipSet.has(row.id)) continue
      authors.push(row)
      if (authors.length >= LIMIT) break
    }
    if (page.length < PAGE) break
    offset += PAGE
  }

  const target = PHOTOS_ONLY ? 'with bio but no photo' : 'without bio'
  if (authors.length === 0) {
    console.log(`No authors ${target} found (scanned ${totalScanned}).`)
    return
  }

  console.log(`Found ${authors.length} author(s) ${target} (scanned ${totalScanned}).\n`)

  let enriched = 0
  let skipped = 0
  const newlyCachedSkips: number[] = []
  const SAVE_EVERY = 25
  const cacheSkip = (authorId: number) => {
    if (skipSet.has(authorId)) return
    skipSet.add(authorId)
    newlyCachedSkips.push(authorId)
    bucket.skippedIds.push(authorId)
    if (newlyCachedSkips.length % SAVE_EVERY === 0) saveCache(cache)
  }

  for (const author of authors) {
    try {
      // 1. Search Wikipedia using the name ladder. For non-English authors
      //    the English pen name (when known) or canonical anglicised
      //    display_name hit-rate Wikipedia better than transliterations
      //    or native-script forms. First variant that returns a page wins;
      //    subsequent ones aren't tried so we don't waste API quota.
      const ladder = authorLadder(author)
      let pageId: number | null = null
      let usedVariant = ''
      for (const variant of ladder) {
        pageId = await searchWikipedia(variant.name)
        await sleep(DELAY_MS)
        if (pageId !== null) {
          usedVariant = variant.source === 'canonical' ? '' : ` [via ${variant.source}]`
          break
        }
      }
      if (!pageId) {
        console.log(`✗ ${author.display_name} — not found on Wikipedia`)
        cacheSkip(author.id)
        skipped++
        continue
      }

      // 2. Fetch page details (extract + photo + categories)
      const { extract, photo: photoRaw, categories } = await fetchPageDetails(pageId)
      // Gate photo URL through the allowlist — Wikipedia thumbnails are
      // upload.wikimedia.org so this should be a no-op in practice, but the
      // guarantee belongs here at the boundary, not in render.
      const photo = isAllowedImageUrl(photoRaw) ? photoRaw : null
      await sleep(DELAY_MS)

      // ── Not-a-person guards (incident 2026-05-23) ────────────────────
      // Wikipedia search resolves short / ambiguous author names to the
      // wrong article: "Desert" → geography, "Iona" → island, "Hua"/"Chii"
      // → disambig pages. Skip the enrichment entirely when the Wikipedia
      // hit shows none of the person-signals. Both guards run in
      // photos-only mode too — otherwise we'd save a photo of Rub al Khali.
      //
      //   G1  disambig page  — extract starts with "X may refer to" OR
      //                        a "Disambiguation" category is present
      //   G2  no person signal — none of {birth year, death year, writer
      //                        category} fires. We treat the page as a
      //                        non-biographical article (geography,
      //                        concept, organization, etc.).
      const birthYear = extract ? extractYearFromCategories(categories, 'births') : null
      const deathYear = extract ? extractYearFromCategories(categories, 'deaths') : null
      const isDisambig = !!extract && (isDisambigExtract(extract) || hasDisambigCategory(categories))
      const hasPersonSignal =
        birthYear !== null ||
        deathYear !== null ||
        hasWriterCategory(categories)

      if (isDisambig) {
        console.log(`✗ ${author.display_name} — Wikipedia hit is a disambiguation page (skipping)`)
        cacheSkip(author.id)
        skipped++
        continue
      }
      if (!hasPersonSignal) {
        console.log(`✗ ${author.display_name} — Wikipedia hit has no person signals (likely a geographic/concept article)`)
        cacheSkip(author.id)
        skipped++
        continue
      }

      // ── Photos-only branch: only the thumbnail matters ────────────────
      if (PHOTOS_ONLY) {
        if (!photo) {
          console.log(`✗ ${author.display_name} — no Wikipedia thumbnail`)
          cacheSkip(author.id)
          skipped++
          continue
        }
        console.log(`✓ ${author.display_name}${usedVariant} — photo: ${photo}`)
        if (APPLY) {
          const { error: ue } = await supabase
            .from('authors')
            .update({ photo_url: photo })
            .eq('id', author.id)
          if (ue) { console.error(`  DB error: ${ue.message}`); skipped++; continue }
        }
        enriched++
        continue
      }

      if (!extract) {
        console.log(`✗ ${author.display_name} — no extract from Wikipedia`)
        cacheSkip(author.id)
        skipped++
        continue
      }

      // 3. Extract structured data from categories
      const birthCountry = extractNationalityFromCategories(categories)

      // 4. Check full article for censorship mentions
      const fullText = await fetchFullExtract(pageId)
      await sleep(DELAY_MS)
      const censorshipMentioned = fullText ? hasCensorshipContent(fullText) : false

      // 5. Build bio
      const bio = buildBio({
        extract,
        authorName: author.display_name,
        birthYear,
        deathYear,
        birthCountry,
        hasCensorship: censorshipMentioned,
      })

      // 6. Output
      const photoLabel = photo ? 'yes' : 'no'
      console.log(
        `✓ ${author.display_name}${usedVariant} — bio: ${bio.length} chars | ` +
        `birth: ${birthYear ?? '?'} | death: ${deathYear ?? '—'} | ` +
        `country: ${birthCountry ?? '?'} | photo: ${photoLabel}`
      )

      // 7. Write to DB
      if (APPLY) {
        const updates: Record<string, unknown> = { bio }
        if (birthYear !== null) updates.birth_year = birthYear
        if (deathYear !== null) updates.death_year = deathYear
        if (birthCountry !== null) updates.birth_country = birthCountry
        if (photo !== null) updates.photo_url = photo

        const { error: ue } = await supabase
          .from('authors')
          .update(updates)
          .eq('id', author.id)

        if (ue) console.error(`  DB error: ${ue.message}`)
        else enriched++
      } else {
        enriched++
      }
    } catch (err) {
      console.error(`✗ ${author.display_name} — error: ${err instanceof Error ? err.message : String(err)}`)
      skipped++
    }
  }

  if (newlyCachedSkips.length > 0) saveCache(cache)

  console.log(`\n── Done ──`)
  console.log(`Enriched      : ${enriched}`)
  console.log(`Skipped       : ${skipped}`)
  console.log(`Cached skips  : +${newlyCachedSkips.length} (total ${bucket.skippedIds.length} for ${mode})`)
  if (!APPLY) console.log(`\nDry-run complete. Re-run with --apply to write to DB.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
