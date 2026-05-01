/**
 * Auto-fill description_ban for books that are missing it, using Claude.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/autofill-ban-descriptions.ts
 *   npx tsx --env-file=.env.local scripts/autofill-ban-descriptions.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/autofill-ban-descriptions.ts --limit 20
 *   npx tsx --env-file=.env.local scripts/autofill-ban-descriptions.ts --overwrite
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
import Anthropic from '@anthropic-ai/sdk'
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You write factual, concise ban descriptions for a database of banned books.

Rules:
- 1–3 sentences. Be specific: include year, country/authority, and reason where known.
- If a legal case exists, name it (e.g. "R v. Penguin Books (1960)").
- If documentation is thin, say so honestly ("though documentation is limited").
- If no credible ban is documented, reply with exactly: SKIP
- Never invent facts. Never use hedging like "possibly" unless genuinely uncertain.
- No markdown, no trailing citations, no "Source confidence" metadata.
- Write in the same register as these examples:
  • "Removed in 2022 by a Tennessee school board due to profanity and depictions of nudity in its Holocaust narrative, sparking national debate about historical censorship."
  • "Banned in Kenya in 1987 after authorities believed the fictional character was real and politically subversive; copies were confiscated and the author was forced into exile."
  • "Frequently banned in U.S. schools, including a 1973 North Dakota case where copies were burned, due to sexual content, language, and anti-war themes."
  • "Banned in the United Kingdom in 1928 after an obscenity trial because of its depiction of a lesbian relationship; copies were seized and destroyed before later legal reassessment."`

type BookRow = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: {
    year_started: number | null
    country_code: string
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
  }[]
}

function buildPrompt(book: BookRow): string {
  const author = book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')

  const banLines = book.bans.map((ban) => {
    const reasons = ban.ban_reason_links
      .map((l) => l.reasons?.label_en)
      .filter(Boolean)
      .join(', ')
    const country = ban.countries?.name_en ?? ban.country_code
    const year = ban.year_started ?? 'unknown year'
    return `  - ${country} (${year})${reasons ? `: ${reasons}` : ''}`
  })

  return `Write a ban description for this book:

Title: ${book.title}
Author: ${author || 'unknown'}
Known bans:
${banLines.join('\n')}

Reply with only the description sentence(s), or SKIP if no credible ban is documented.`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function generateDescription(book: BookRow): Promise<string | null> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(book) }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (!text || text === 'SKIP' || text.length < 20) return null
  return text
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const overwrite = process.argv.includes('--overwrite')
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity

  let query = supabase
    .from('books')
    .select(`
      id, slug, title, description_ban,
      book_authors(authors(display_name)),
      bans(year_started, country_code, countries(name_en), ban_reason_links(reasons(slug, label_en)))
    `)
    .order('title')

  if (!overwrite) query = query.is('description_ban', null)

  const { data: books, error } = await query
  if (error || !books) { console.error('Fetch failed:', error?.message); process.exit(1) }

  const toProcess = books.slice(0, isFinite(limit) ? limit : undefined) as unknown as BookRow[]

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing ${toProcess.length} books...\n`)

  let written = 0, skipped = 0, failed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const book = toProcess[i]
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${book.title.slice(0, 55).padEnd(55)} `)

    const desc = await generateDescription(book)
    if (!desc) {
      process.stdout.write('— skipped\n')
      skipped++
      await sleep(200)
      continue
    }

    if (dryRun) {
      process.stdout.write(`\n    → ${desc}\n`)
      written++
    } else {
      const { error: ue } = await supabase
        .from('books')
        .update({ description_ban: desc })
        .eq('id', book.id)

      if (ue) {
        process.stdout.write(`✗ ${ue.message}\n`)
        failed++
      } else {
        process.stdout.write('✓\n')
        written++
      }
    }

    await sleep(300)
  }

  console.log(`\nDone. Written: ${written}  Skipped: ${skipped}  Failed: ${failed}`)
}

main().catch(console.error)
