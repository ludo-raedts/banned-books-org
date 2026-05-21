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
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts                  # dry-run, up to 50
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply          # write to DB
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --limit=10       # cap at 10
 *   npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --photos-only --apply
 */

import { adminClient } from '../src/lib/supabase'
import { authorLadder } from '../src/lib/enrich/_author-ladder'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { cleanWikiExtract } from '../src/lib/text/clean-wiki-extract'

const APPLY = process.argv.includes('--apply')
const PHOTOS_ONLY = process.argv.includes('--photos-only')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.replace('--limit=', ''), 10) : 50
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='))
const IDS = IDS_ARG ? IDS_ARG.replace('--ids=', '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n)) : null
const DELAY_MS = 200
const WIKI_UA = 'banned-books.org/1.0 (contact@banned-books.org)'

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

function extractNationalityFromCategories(categories: string[]): string | null {
  // Look for categories like "Category:American novelists", "Category:British writers" etc.
  const writerTerms = [
    'novelists', 'writers', 'authors', 'poets', 'dramatists', 'playwrights',
    'journalists', 'essayists', 'screenwriters', 'editors',
  ]
  for (const cat of categories) {
    const lower = cat.toLowerCase()
    const hasWriterTerm = writerTerms.some(t => lower.includes(t))
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

  const supabase = adminClient()

  const baseQuery = supabase
    .from('authors')
    .select('id, display_name, slug, name_native, name_transliterated, name_english, original_language')
    .not('slug', 'is', null)
    .order('display_name')
    .limit(LIMIT)

  if (IDS) baseQuery.in('id', IDS)

  const { data, error } = PHOTOS_ONLY
    ? await baseQuery.not('bio', 'is', null).is('photo_url', null)
    : await baseQuery.is('bio', null)

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  type AuthorRow = {
    id: number
    display_name: string
    slug: string
    name_native: string | null
    name_transliterated: string | null
    name_english: string | null
    original_language: string | null
  }
  const authors = (data ?? []) as AuthorRow[]

  const target = PHOTOS_ONLY ? 'with bio but no photo' : 'without bio'
  if (authors.length === 0) {
    console.log(`No authors ${target} found.`)
    return
  }

  console.log(`Found ${authors.length} author(s) ${target}.\n`)

  let enriched = 0
  let skipped = 0

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

      // ── Photos-only branch: only the thumbnail matters ────────────────
      if (PHOTOS_ONLY) {
        if (!photo) {
          console.log(`✗ ${author.display_name} — no Wikipedia thumbnail`)
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
        skipped++
        continue
      }

      // 3. Extract structured data from categories
      const birthYear = extractYearFromCategories(categories, 'births')
      const deathYear = extractYearFromCategories(categories, 'deaths')
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

  console.log(`\n── Done ──`)
  console.log(`Enriched : ${enriched}`)
  console.log(`Skipped  : ${skipped}`)
  if (!APPLY) console.log(`\nDry-run complete. Re-run with --apply to write to DB.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
