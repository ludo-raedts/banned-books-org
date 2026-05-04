/**
 * GPT fallback for books that description enrichment couldn't find via
 * OpenLibrary / Google Books — typically obscure or stub-only records.
 *
 * Targets: description_book IS NULL
 * Uses GPT-4o-mini to write a factual synopsis from training knowledge.
 * Marks every result ai_drafted = true.
 * Skips if GPT returns UNKNOWN (book not in training data).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts             # dry-run, 5 samples
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply --overwrite
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply --slug=turtles-all-the-way-down
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY     = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const slugArg   = process.argv.find(a => a.startsWith('--slug='))
const delayArg  = process.argv.find(a => a.startsWith('--delay='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 999 : 5)
const SLUG      = slugArg?.split('=')[1] ?? null
const DELAY     = delayArg ? parseInt(delayArg.split('=')[1]) : 300

type BookRow = {
  id:                   number
  title:                string
  slug:                 string
  first_published_year: number | null
  genres:               string[]
  book_authors:         { authors: { display_name: string } | null }[]
  bans:                 {
    country_code: string
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { label_en: string } | null }[]
  }[]
}

function buildPrompt(book: BookRow): string {
  const author  = book.book_authors[0]?.authors?.display_name ?? null
  const genres  = (book.genres ?? []).join(', ')

  const hints = [
    author && `Author: ${author}`,
    genres && `Genre/category: ${genres}`,
  ].filter(Boolean).join('\n')

  return `Write a factual 3–5 sentence synopsis of the book "${book.title}"${author ? ` by ${author}` : ''}.

${hints}

Rules:
- Describe what the book is actually about: its subject, themes, setting, or argument
- Do NOT describe why it was banned, challenged, or censored — that belongs elsewhere
- Do NOT start with "This book" or "The book"
- Do NOT invent specific plot points or characters you are genuinely uncertain about — describe themes and subject matter instead
- If you have absolutely no knowledge of this specific book and cannot write anything factual about it, return exactly: UNKNOWN
- Output only the synopsis paragraph, no labels or preamble`
}

async function generate(client: OpenAI, book: BookRow): Promise<string | null> {
  try {
    const res = await client.chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  300,
      temperature: 0.1,
      messages: [{ role: 'user', content: buildPrompt(book) }],
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
    if (!text || text.toUpperCase().startsWith('UNKNOWN')) return null
    return text.length >= 60 ? text : null
  } catch (e) {
    console.error(`  GPT error: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let query = supabase
    .from('books')
    .select(`
      id, title, slug, first_published_year, genres,
      book_authors(authors(display_name)),
      bans(country_code, countries(name_en), ban_reason_links(reasons(label_en)))
    `)
    .order('title')

  if (SLUG) {
    query = (query as any).eq('slug', SLUG)
  } else if (!OVERWRITE) {
    query = (query as any).is('description_book', null)
  }

  const { data, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all   = (data ?? []) as unknown as BookRow[]
  const batch = all.slice(0, LIMIT)

  console.log(`\n── enrich-descriptions-gpt (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (OVERWRITE) console.log('  --overwrite: replacing existing description_book too')
  console.log(`  Missing descriptions: ${all.length}  Processing: ${batch.length}\n`)

  let written = 0, unknown = 0, errors = 0

  for (const book of batch) {
    const author = book.book_authors[0]?.authors?.display_name ?? ''
    console.log(`[${book.slug}]  ${book.title}${author ? ` / ${author}` : ''}`)

    const desc = await generate(openai, book)

    if (!desc) {
      console.log(`  → UNKNOWN — skip`)
      unknown++
    } else {
      console.log(`  → ${desc.length > 300 ? desc.slice(0, 300) + '…' : desc}`)
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('books')
          .update({ description_book: desc, ai_drafted: true })
          .eq('id', book.id)
        if (upErr) { console.error(`  ✗ ${upErr.message}`); errors++ }
        else       { console.log(`  ✓ written`); written++ }
      }
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\nDone.  Written: ${written}  Unknown: ${unknown}  Errors: ${errors}`)
  if (!APPLY) console.log('DRY-RUN — add --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
