/**
 * Generate censorship_context narratives for books with 2+ bans.
 * Uses claude-haiku-4-5-20251001 (cost-efficient).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts           # dry-run (first 3)
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts --apply   # write all 50
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts --apply --limit 10
 */

import Anthropic from '@anthropic-ai/sdk'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 50 : 3)

const supabase = adminClient()
const anthropic = new Anthropic()

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type BanRow = {
  id: number
  year_started: number | null
  year_ended: number | null
  status: string
  action_type: string
  country_code: string
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
  description: string | null
}

type BookRow = {
  id: number
  title: string
  slug: string
  description_ban: string | null
  ai_drafted: boolean
  book_authors: { authors: { display_name: string } | null }[]
  bans: BanRow[]
}

function buildPrompt(book: BookRow): string {
  const author = book.book_authors
    .map(ba => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ') || 'Unknown'

  const banLines = book.bans.map(ban => {
    const country = ban.countries?.name_en ?? ban.country_code
    const year = ban.year_started ? `${ban.year_started}` : 'year unknown'
    const yearEnd = ban.year_ended ? `–${ban.year_ended}` : ban.status === 'historical' ? ' (lifted)' : ''
    const scope = ban.scopes?.label_en ?? 'national'
    const reasons = ban.ban_reason_links
      .map(l => l.reasons?.label_en)
      .filter(Boolean)
      .join(', ') || 'unspecified'
    const action = ban.action_type
    const note = ban.description ? ` — "${ban.description.slice(0, 120)}"` : ''
    return `  - ${country}, ${year}${yearEnd}: ${action} (${scope}) — reasons: ${reasons}${note}`
  }).join('\n')

  return `You are writing a factual censorship history section for banned-books.org. Write 150–250 words in plain English.

Book: ${book.title} by ${author}
Existing ban description: ${book.description_ban ?? 'none'}

Bans documented:
${banLines}

Write a short narrative that:
1. Opens with ONE sentence explaining the core reason this book gets banned (use only the documented reasons above)
2. Describes the censorship pattern across countries (refer only to the countries listed above)
3. Notes if any bans were lifted
4. Ends with one sentence about what this case illustrates about censorship patterns

Rules:
- Never invent facts not in the data provided
- Never mention countries not in the ban list
- Use neutral, factual tone
- No headers, no bullet points — flowing prose only
- If the data is insufficient for a meaningful narrative, return exactly: SKIP`
}

async function generateContext(book: BookRow): Promise<string | null> {
  const prompt = buildPrompt(book)
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = (message.content[0] as { type: string; text: string }).text.trim()
  if (text === 'SKIP' || text.startsWith('SKIP')) return null
  return text
}

async function main() {
  // Fetch qualifying books: ai_drafted=false, censorship_context IS NULL, 2+ bans
  const { data: allBooks } = await supabase
    .from('books')
    .select(`
      id, title, slug, description_ban, ai_drafted,
      book_authors(authors(display_name)),
      bans(
        id, year_started, year_ended, status, action_type, country_code, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug, label_en))
      )
    `)
    .eq('ai_drafted', false)
    .is('censorship_context', null)

  const qualifying = ((allBooks ?? []) as unknown as BookRow[])
    .filter(b => b.bans.length >= 2)
    .sort((a, b) => b.bans.length - a.bans.length)
    .slice(0, LIMIT)

  console.log(`Qualifying books: ${((allBooks ?? []) as unknown as BookRow[]).filter(b => b.bans.length >= 2).length} total`)
  console.log(`Processing: ${qualifying.length} (limit=${LIMIT}, apply=${APPLY})\n`)

  let written = 0
  let skipped = 0
  let errors = 0

  for (const book of qualifying) {
    console.log(`[${book.slug}] (${book.bans.length} bans)`)

    try {
      const context = await generateContext(book)

      if (!context) {
        console.log(`  → SKIP (model returned insufficient data)`)
        skipped++
        await sleep(200)
        continue
      }

      console.log(`  → ${context.slice(0, 120)}…`)

      if (APPLY) {
        const { error } = await supabase
          .from('books')
          .update({ censorship_context: context })
          .eq('id', book.id)
        if (error) {
          console.error(`  ✗ DB error: ${error.message}`)
          errors++
        } else {
          console.log(`  ✓ written`)
          written++
        }
      }

      await sleep(300)
    } catch (e: unknown) {
      console.error(`  ✗ API error: ${(e as Error).message}`)
      errors++
      await sleep(1000)
    }
  }

  console.log(`\nDone. Written: ${written}, Skipped: ${skipped}, Errors: ${errors}`)
  if (!APPLY) console.log('DRY-RUN — re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
