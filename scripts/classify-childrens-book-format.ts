/**
 * LLM-classify the children's/YA books in the catalogue into one of three
 * publishing-format buckets so the /banned-childrens-books directory can
 * later split into finer sections (picture-book / middle-grade / young-
 * adult) instead of the current two coarse buckets.
 *
 * Why: the books table tags ~462 books as `children` or `young-adult` but
 * almost none carry the fine-grained tags. We use Claude (auto-falls back
 * to OpenAI) to read each book's metadata and decide which bucket fits.
 *
 * Strategy:
 *   - Pull every book with any children/YA tag + ≥1 documented ban.
 *   - Skip books that already carry a fine tag (idempotent re-runs).
 *   - Batch 15 books per LLM call to keep total runtime to ~5 min.
 *   - Append the new fine tag to `books.genres` (preserves existing tags).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/classify-childrens-book-format.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/classify-childrens-book-format.ts --write
 *   pnpm tsx --env-file=.env.local scripts/classify-childrens-book-format.ts --write --limit 30
 *     (limit caps how many books to process — useful for first-write smoke)
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const WRITE = process.argv.includes('--write')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit'))?.split('=')[1] ?? process.argv[process.argv.indexOf('--limit') + 1]
const LIMIT = LIMIT_ARG && !isNaN(Number(LIMIT_ARG)) ? Number(LIMIT_ARG) : Infinity

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const FINE_TAGS = ['picture-book', 'middle-grade-fiction', 'young-adult-fiction'] as const
const SOURCE_TAGS = ['children', 'childrens-literature', 'young-adult', 'young-adult-fiction', 'middle-grade-fiction', 'picture-book'] as const

type Format = 'picture-book' | 'middle-grade-fiction' | 'young-adult-fiction' | 'unknown'

type BookRow = {
  id: number
  title: string
  slug: string
  first_published_year: number | null
  description_book: string | null
  genres: string[] | null
  book_authors: { authors: { display_name: string } | null }[] | null
  bans: { id: number }[] | null
}

async function fetchCandidates(): Promise<BookRow[]> {
  const filter = SOURCE_TAGS.map(t => `genres.cs.{${t}}`).join(',')
  const out: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, slug, first_published_year, description_book, genres, book_authors(authors(display_name)), bans(id)')
      .or(filter)
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as unknown as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return out.filter(b => (b.bans?.length ?? 0) >= 1)
}

function hasFineTag(genres: string[] | null): boolean {
  if (!genres) return false
  return FINE_TAGS.some(t => genres.includes(t))
}

function authorOf(b: BookRow): string {
  return (b.book_authors ?? []).map(ba => ba.authors?.display_name).filter((s): s is string => !!s)[0] ?? 'Unknown'
}

const PROMPT_PREFIX = `You are classifying children's and young-adult books by their as-published format. For each book below, reply with one of these labels:

- "picture-book" — published for ages roughly 4–8, illustrated, typically under 50 pages, dialogue-light text
- "middle-grade-fiction" — published for ages roughly 8–12, longer prose, fewer illustrations, age-appropriate themes
- "young-adult-fiction" — published for ages 12+, complex themes (identity, sex, violence, mortality, politics)
- "unknown" — title/description doesn't give enough information to classify, or the book is not actually a children's/YA book

Use the book's first publication year, title, author, description, and existing genre tags as evidence. Don't guess wildly — when in doubt between two adjacent buckets, pick the older audience (middle-grade over picture-book, young-adult over middle-grade). When in doubt whether a book belongs to children's/YA literature at all, reply "unknown".

Output: a JSON array. Each entry: {"id": <integer>, "format": "<one of the four labels>"}. Reply with ONLY the JSON, no surrounding prose, no code fences.

Books:
`

const BATCH_SIZE = 15
const CLAUDE_MODEL = 'claude-opus-4-7'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'

async function classifyBatch(batch: BookRow[]): Promise<Record<number, Format>> {
  const payload = batch.map(b => ({
    id: b.id,
    title: b.title,
    author: authorOf(b),
    year: b.first_published_year,
    description: (b.description_book ?? '').slice(0, 400),
    current_tags: (b.genres ?? []).filter(g => SOURCE_TAGS.includes(g as typeof SOURCE_TAGS[number])),
  }))
  const prompt = PROMPT_PREFIX + JSON.stringify(payload, null, 2)

  let raw: string
  if (process.env.ANTHROPIC_API_KEY) {
    const c = new Anthropic()
    const response = await c.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
  } else if (process.env.OPENAI_API_KEY) {
    const c = new OpenAI()
    const response = await c.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Reply with valid JSON only — no prose, no Markdown.' },
        { role: 'user', content: prompt },
      ],
    })
    raw = response.choices[0]?.message?.content ?? ''
  } else {
    throw new Error('No LLM credentials — set ANTHROPIC_API_KEY or OPENAI_API_KEY')
  }

  // Strip fences, find outer JSON array
  const trimmed = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = fence ? fence[1] : trimmed
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1) {
    console.warn(`  [warn] no JSON array in response: ${raw.slice(0, 200)}`)
    return {}
  }
  let parsed: unknown
  try { parsed = JSON.parse(candidate.slice(start, end + 1)) } catch (e) {
    console.warn(`  [warn] JSON parse failed: ${e instanceof Error ? e.message : e}`)
    return {}
  }
  if (!Array.isArray(parsed)) return {}

  const out: Record<number, Format> = {}
  for (const row of parsed as Array<{ id: number; format: string }>) {
    const f = row.format as Format
    if (FINE_TAGS.includes(f as typeof FINE_TAGS[number]) || f === 'unknown') {
      out[row.id] = f
    }
  }
  return out
}

async function applyTag(bookId: number, currentGenres: string[] | null, newTag: string): Promise<void> {
  const current = currentGenres ?? []
  if (current.includes(newTag)) return
  const next = [...current, newTag]
  const { error } = await supabase.from('books').update({ genres: next }).eq('id', bookId)
  if (error) throw new Error(`update books.${bookId}: ${error.message}`)
}

async function main() {
  console.log(`Mode: ${WRITE ? 'WRITE' : 'dry-run'}${LIMIT < Infinity ? `  limit=${LIMIT}` : ''}`)
  console.log('Fetching candidates…')
  const all = await fetchCandidates()
  console.log(`  ${all.length} books with children/YA tag + ≥1 ban`)
  const needClassification = all.filter(b => !hasFineTag(b.genres))
  const alreadyTagged = all.length - needClassification.length
  const todo = needClassification.slice(0, LIMIT)
  console.log(`  ${alreadyTagged} already carry a fine tag — skip`)
  console.log(`  ${needClassification.length} need classification${LIMIT < Infinity ? `, processing first ${todo.length} (--limit)` : ''}`)
  if (todo.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const stats = { 'picture-book': 0, 'middle-grade-fiction': 0, 'young-adult-fiction': 0, unknown: 0 }
  const logRows: string[] = []
  let batchNum = 0
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    batchNum++
    const batch = todo.slice(i, i + BATCH_SIZE)
    process.stdout.write(`Batch ${batchNum} (${i + 1}–${i + batch.length} of ${todo.length})… `)
    const t0 = Date.now()
    const classifications = await classifyBatch(batch)
    const ms = Date.now() - t0
    process.stdout.write(`${ms}ms\n`)

    for (const b of batch) {
      const f = classifications[b.id] ?? 'unknown'
      stats[f]++
      logRows.push(`  ${f.padEnd(22)} #${b.id.toString().padEnd(6)} ${b.title.slice(0, 60)}`)
      if (f !== 'unknown' && WRITE) {
        try { await applyTag(b.id, b.genres, f) }
        catch (e) { console.warn(`    [write fail] #${b.id}: ${e instanceof Error ? e.message : e}`) }
      }
    }
  }

  console.log('\nClassifications:')
  console.log(logRows.join('\n'))
  console.log('\nSummary:')
  for (const [tag, n] of Object.entries(stats)) console.log(`  ${tag.padEnd(22)} ${n}`)
  console.log(`\n${WRITE ? 'Wrote' : 'Would write'} ${stats['picture-book'] + stats['middle-grade-fiction'] + stats['young-adult-fiction']} new tags across ${todo.length} books (${stats.unknown} unknown).`)
}

main().catch(err => { console.error(err); process.exit(1) })
