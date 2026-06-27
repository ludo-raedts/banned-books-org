/**
 * GPT-powered genre enrichment for books with an empty `genres` array.
 *
 * Picks 1–3 slugs from the fixed 21-slug vocabulary defined in
 * src/components/genre-badge.tsx. Uses title + author + first_published_year +
 * description_book as signal. Returns UNKNOWN-equivalent when nothing fits or
 * the model has no idea — book stays in the candidate pool.
 *
 * GROUNDING GUARD (the UNKNOWN route): for rows with NO description_book, a single
 * model confidently guesses genre from the title (root cause of the 2026-05 NZ
 * Indecent-Publications import being mis-tagged YA/children/sci-fi). Such rows are
 * only accepted when GPT and Gemini INDEPENDENTLY agree (intersection of their
 * slugs); title-guesses diverge between models → empty → skip. Grounded rows (a
 * real description is in the prompt) keep the cheap single GPT call. Needs
 * GOOGLE_AI_API_KEY; without it, ungrounded rows are skipped rather than guessed.
 *
 * Idempotent: only targets books where `genres = '{}'`. Manual edits via the
 * admin (or seed-genres.ts) survive re-runs because their `genres` is non-empty.
 *
 * Books the model can't place (empty / low-confidence result) keep `genres = '{}'`
 * and so resurface on every run. After a gpt-4o-mini sweep the remaining candidates
 * ARE the hard cases — mop them up with enrich-genres-retry-gpt.ts (stronger model).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts             # dry-run, 5 samples
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --slug=animal-farm
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --overwrite --slug=animal-farm
 */

import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { adminClient } from '../src/lib/supabase'

export type EnrichGenresOptions = {
  apply:     boolean
  overwrite: boolean
  limit:     number
  slug:      string | null
  delay:     number
  model:     string
}

export function optionsFromArgv(defaults: Partial<EnrichGenresOptions> = {}): EnrichGenresOptions {
  const apply     = process.argv.includes('--apply')
  const overwrite = process.argv.includes('--overwrite')
  const limitArg  = process.argv.find(a => a.startsWith('--limit='))
  const slugArg   = process.argv.find(a => a.startsWith('--slug='))
  const delayArg  = process.argv.find(a => a.startsWith('--delay='))
  const modelArg  = process.argv.find(a => a.startsWith('--model='))
  // Default apply = no cap (paginate over the whole candidate set); dry-run = 5 samples.
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : (apply ? Infinity : 5)
  return {
    apply,
    overwrite,
    limit,
    slug:  slugArg?.split('=')[1] ?? null,
    delay: delayArg ? parseInt(delayArg.split('=')[1]) : (defaults.delay ?? 300),
    model: modelArg?.split('=')[1] ?? process.env.OPENAI_MODEL ?? defaults.model ?? 'gpt-4o-mini',
  }
}

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
- GROUNDING (critical): Only classify if a Description is provided below, OR you reliably know THIS EXACT book — this specific title by this specific author — from training data. If neither holds, return an empty array with confidence "low". NEVER infer genre from the title or author name alone: a title that merely sounds like a diary, a children's book, a memoir, a sci-fi story, etc. is NOT evidence of genre. When there is no description and you don't genuinely recognise the specific book, an empty array IS the correct, expected answer — do not guess.
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

async function classify(client: OpenAI, book: BookRow, model: string): Promise<GenreResult | null> {
  try {
    const res = await client.chat.completions.create({
      model,
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

/**
 * Second, independent classifier (Gemini) used ONLY to verify ungrounded guesses.
 * Returns the cleaned slug set, or null on error. A single model confidently
 * guesses genre from the title when no description grounds it (the root cause of
 * the NZ-import mis-tagging); two independent models disagree on a title-guess,
 * so the intersection collapses to empty = UNKNOWN.
 */
async function classifyGemini(genai: GoogleGenAI, book: BookRow): Promise<GenreSlug[] | null> {
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(book),
      config: { systemInstruction: POLICY, temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' },
    })
    const txt = (res.text ?? '').trim()
    const json = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json) as { genres?: string[] }
    return Array.from(new Set((parsed.genres ?? []).filter((g): g is GenreSlug => GENRE_SET.has(g)))).slice(0, 3)
  } catch {
    return null
  }
}

const SELECT_COLS = `
  id, title, slug, first_published_year, genres, description_book,
  book_authors(authors(display_name))
`

const PAGE = 1000

/**
 * Fetch all candidate books, paginating past Supabase's hard 1000-row cap on a
 * plain .select(). Ordered by `id` (stable, unique) so .range() never skips or
 * duplicates rows. Stops early once `limit` rows are collected.
 */
async function fetchCandidates(
  supabase: ReturnType<typeof adminClient>,
  opts: EnrichGenresOptions,
): Promise<BookRow[]> {
  const all: BookRow[] = []
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('books')
      .select(SELECT_COLS)
      // Blanket-works pseudo-books (Liste Otto "Toutes ses œuvres") have no real
      // title to classify — GPT returns UNKNOWN every run. Skip them outright.
      .eq('is_blanket_works', false)
      .order('id')
      .range(from, from + PAGE - 1)

    if (opts.slug) {
      query = query.eq('slug', opts.slug)
    } else if (!opts.overwrite) {
      // Empty text[] arrays are stored as '{}'; Supabase needs the raw .filter form.
      query = query.filter('genres', 'eq', '{}')
    }

    const { data, error } = await query
    if (error) { console.error('DB error:', error.message); process.exit(1) }

    const rows = (data ?? []) as unknown as BookRow[]
    all.push(...rows)

    if (rows.length < PAGE) break               // last page
    if (Number.isFinite(opts.limit) && all.length >= opts.limit) break
    if (opts.slug) break                          // single-target never paginates
  }
  return all
}

export async function enrichGenres(opts: EnrichGenresOptions) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in .env.local')
    process.exit(1)
  }

  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  // Second model verifies ungrounded guesses (the UNKNOWN route). Without it we
  // cannot trust a title-only classification, so ungrounded rows are declined.
  const genai    = process.env.GOOGLE_AI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY }) : null
  if (!genai) console.warn('  ⚠ GOOGLE_AI_API_KEY not set — ungrounded books (no description_book) will be skipped, not classified.')

  const all   = await fetchCandidates(supabase, opts)
  const batch = Number.isFinite(opts.limit) ? all.slice(0, opts.limit) : all

  console.log(`\n── enrich-genres-gpt (${opts.apply ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  model: ${opts.model}`)
  if (opts.overwrite) console.log('  --overwrite: replacing existing genres too')
  console.log(`  Candidates: ${all.length}  Processing: ${batch.length}\n`)

  let written = 0, unknown = 0, lowConf = 0, errors = 0

  for (const book of batch) {
    const author = book.book_authors[0]?.authors?.display_name ?? ''
    console.log(`[${book.slug}]  ${book.title}${author ? ` / ${author}` : ''}`)

    let result = await classify(openai, book, opts.model)

    // GROUNDING GUARD (the UNKNOWN route): for rows with no description_book, a
    // single model's self-reported confidence is unreliable — it returns "high"
    // on pure title-guesses (e.g. "Master Masochist" → literary-fiction). Require
    // GPT ∩ Gemini agreement; a title-guess diverges between models → empty →
    // UNKNOWN. Grounded rows (a real description is in the prompt) keep the cheap
    // single call.
    if (result && result.genres.length > 0 && !book.description_book) {
      if (!genai) {
        result = { genres: [], confidence: 'low' }
      } else {
        const gem = await classifyGemini(genai, book)
        const agreed = gem ? result.genres.filter(g => (gem as string[]).includes(g)) : []
        result = agreed.length > 0
          ? { genres: agreed.slice(0, 3), confidence: result.confidence }
          : { genres: [], confidence: 'low' }
      }
    }

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
      if (opts.apply) {
        const { error: upErr } = await supabase
          .from('books')
          .update({ genres: result.genres })
          .eq('id', book.id)
        if (upErr) { console.error(`  ✗ ${upErr.message}`); errors++ }
        else       { console.log(`  ✓ written`); written++ }
      }
    }

    if (opts.delay > 0) await new Promise(r => setTimeout(r, opts.delay))
  }

  console.log(`\nDone.  Written: ${written}  Unknown: ${unknown}  Low-confidence skipped: ${lowConf}  Errors: ${errors}`)
  if (!opts.apply) console.log('DRY-RUN — add --apply to write.')
  return { written, unknown, lowConf, errors }
}

// Run as CLI unless imported (the retry variant imports enrichGenres directly).
if (process.argv[1] && /enrich-genres-gpt\.ts$/.test(process.argv[1])) {
  enrichGenres(optionsFromArgv()).catch(e => { console.error(e); process.exit(1) })
}
