/**
 * GPT-powered genre enrichment for books with an empty `genres` array.
 *
 * Picks 1–3 slugs from the fixed 21-slug vocabulary defined in
 * src/components/genre-badge.tsx. Uses title + author + first_published_year +
 * description_book as signal. Returns UNKNOWN-equivalent when nothing fits or
 * the model has no idea — book stays in the candidate pool.
 *
 * Idempotent: only targets books where `genres = '{}'`. Manual edits via the
 * admin (or seed-genres.ts) survive re-runs because their `genres` is non-empty.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts             # dry-run, 5 samples
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --slug=animal-farm
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --overwrite --slug=animal-farm
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY     = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const slugArg   = process.argv.find(a => a.startsWith('--slug='))
const delayArg  = process.argv.find(a => a.startsWith('--delay='))
const modelArg  = process.argv.find(a => a.startsWith('--model='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 999 : 5)
const SLUG      = slugArg?.split('=')[1] ?? null
const DELAY     = delayArg ? parseInt(delayArg.split('=')[1]) : 300
const MODEL     = modelArg?.split('=')[1] ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

// Mirror of GENRES in src/components/genre-badge.tsx. Keep in sync until the
// vocabulary moves to a DB table.
const GENRE_SLUGS = [
  'children',
  'young-adult',
  'fantasy',
  'dystopian',
  'science-fiction',
  'literary-fiction',
  'historical-fiction',
  'coming-of-age',
  'memoir',
  'non-fiction',
  'satire',
  'political-fiction',
  'romance',
  'thriller',
  'magical-realism',
  'graphic-novel',
  'horror',
  'essay',
  'experimental',
  'controversial-non-fiction',
  'political-non-fiction',
] as const

type GenreSlug = typeof GENRE_SLUGS[number]
const GENRE_SET = new Set<string>(GENRE_SLUGS)

const POLICY = `You classify books for banned-books.org by literary genre. You may
pick 1 to 3 slugs from a fixed vocabulary; no other values are allowed.

Vocabulary (slug → meaning):
- children:                Picture books and middle-grade fiction for under-12s
- young-adult:             Teen-targeted fiction (12–18)
- fantasy:                 Secondary-world or magic-driven fiction
- dystopian:               Bleak future / totalitarian-society fiction (1984, Brave New World, Handmaid's Tale)
- science-fiction:         SF — speculative tech, space, future. Note: pure dystopia → dystopian
- literary-fiction:        Character/style-driven adult fiction, often canonical
- historical-fiction:      Fiction set in a documented past period
- coming-of-age:           Bildungsroman, growing-up narratives (often paired with young-adult or literary-fiction)
- memoir:                  Author's first-person life writing — non-fiction
- non-fiction:             General non-fiction that doesn't fit a more specific non-fiction slug
- satire:                  Satirical works — fiction OR essay
- political-fiction:       Novel where politics is the central subject
- romance:                 Romance as a primary genre (not "has a love story")
- thriller:                Suspense / crime / espionage
- magical-realism:         Realistic narrative with matter-of-fact magical elements
- graphic-novel:           Sequential-art book (manga, BD, comics in book form)
- horror:                  Horror as primary intent
- essay:                   Essay collection or single long-form essay
- experimental:            Form-breaking / avant-garde literature
- controversial-non-fiction: Non-fiction that drew sustained backlash for its claims (Mein Kampf, Anarchist Cookbook, Hit Man, Turner Diaries)
- political-non-fiction:   Non-fiction whose core subject is political analysis or polemic (NOT memoir, NOT controversial-non-fiction)

Rules:
- Pick 1–3 slugs. Prefer the smallest set that captures the work.
- Combine when honest: a YA dystopian novel = ["young-adult", "dystopian"]. To Kill a Mockingbird = ["coming-of-age", "historical-fiction"].
- Children's picture books: just ["children"]. Don't add young-adult.
- If genuinely unsure or the book isn't in your training data, return an empty array.
- Never invent slugs. Only the 21 above are allowed.`

const RESPONSE_SCHEMA = {
  name: 'genre_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      genres: {
        type: 'array',
        items: { type: 'string', enum: [...GENRE_SLUGS] },
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['genres', 'confidence'],
  },
} as const

type GenreResult = {
  genres: string[]
  confidence: 'high' | 'medium' | 'low'
}

type BookRow = {
  id:                   number
  title:                string
  slug:                 string
  first_published_year: number | null
  genres:               string[]
  description_book:     string | null
  book_authors:         { authors: { display_name: string } | null }[]
}

function buildPrompt(book: BookRow): string {
  const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') || 'unknown'
  const year   = book.first_published_year ? ` (${book.first_published_year})` : ''
  const about  = book.description_book ? `\n\nDescription:\n${book.description_book.slice(0, 800)}` : ''

  return `Book: "${book.title}" by ${author}${year}${about}

Return the structured classification. Pick 1–3 slugs that best capture this work, or an empty array if you genuinely don't know.`
}

async function classify(client: OpenAI, book: BookRow): Promise<GenreResult | null> {
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: POLICY },
        { role: 'user',   content: buildPrompt(book) },
      ],
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
    })
    const txt = res.choices[0]?.message?.content
    if (!txt) return null
    const parsed = JSON.parse(txt) as GenreResult

    const cleaned = Array.from(new Set(
      (parsed.genres ?? []).filter((g): g is GenreSlug => GENRE_SET.has(g)),
    )).slice(0, 3)

    return { genres: cleaned, confidence: parsed.confidence }
  } catch (e) {
    console.error(`  ✗ GPT error: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in .env.local')
    process.exit(1)
  }

  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('books')
    .select(`
      id, title, slug, first_published_year, genres, description_book,
      book_authors(authors(display_name))
    `)
    .order('title')

  if (SLUG) {
    query = query.eq('slug', SLUG)
  } else if (!OVERWRITE) {
    // Empty text[] arrays are stored as '{}'; Supabase needs the raw .filter form.
    query = query.filter('genres', 'eq', '{}')
  }

  const { data, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all   = (data ?? []) as unknown as BookRow[]
  const batch = all.slice(0, LIMIT)

  console.log(`\n── enrich-genres-gpt (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  model: ${MODEL}`)
  if (OVERWRITE) console.log('  --overwrite: replacing existing genres too')
  console.log(`  Candidates: ${all.length}  Processing: ${batch.length}\n`)

  let written = 0, unknown = 0, lowConf = 0, errors = 0

  for (const book of batch) {
    const author = book.book_authors[0]?.authors?.display_name ?? ''
    console.log(`[${book.slug}]  ${book.title}${author ? ` / ${author}` : ''}`)

    const result = await classify(openai, book)

    if (!result) {
      console.log(`  → error`)
      errors++
    } else if (result.genres.length === 0) {
      console.log(`  → UNKNOWN — skip (confidence=${result.confidence})`)
      unknown++
    } else if (result.confidence === 'low') {
      console.log(`  → ${result.genres.join(', ')}  (confidence=low — skip)`)
      lowConf++
    } else {
      console.log(`  → ${result.genres.join(', ')}  (confidence=${result.confidence})`)
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('books')
          .update({ genres: result.genres })
          .eq('id', book.id)
        if (upErr) { console.error(`  ✗ ${upErr.message}`); errors++ }
        else       { console.log(`  ✓ written`); written++ }
      }
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\nDone.  Written: ${written}  Unknown: ${unknown}  Low-confidence skipped: ${lowConf}  Errors: ${errors}`)
  if (!APPLY) console.log('DRY-RUN — add --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
