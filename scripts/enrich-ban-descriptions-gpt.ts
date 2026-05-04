/**
 * GPT-powered ban description enrichment.
 * Generates a concrete, specific description_ban for each book:
 * named school districts, courts, lawsuits, challengers, author reactions, outcomes.
 *
 * The ban data already stored (country, year, institution, actor, reasons, scope)
 * is fed directly into the prompt so GPT can build on documented facts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts             # dry-run, 3 samples
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --overwrite
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --slug=the-kite-runner
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY     = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const slugArg   = process.argv.find(a => a.startsWith('--slug='))
const delayArg  = process.argv.find(a => a.startsWith('--delay='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 999 : 3)
const SLUG      = slugArg?.split('=')[1] ?? null
const DELAY     = delayArg ? parseInt(delayArg.split('=')[1]) : 500

type BanRow = {
  year_started:     number | null
  year_ended:       number | null
  status:           string
  action_type:      string
  country_code:     string
  region:           string | null
  institution:      string | null
  actor:            string | null
  description:      string | null
  countries:        { name_en: string } | null
  scopes:           { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
}

type BookRow = {
  id:                   number
  title:                string
  slug:                 string
  first_published_year: number | null
  description_book:     string | null
  book_authors:         { authors: { display_name: string } | null }[]
  bans:                 BanRow[]
}

function buildPrompt(book: BookRow): string {
  const author    = book.book_authors[0]?.authors?.display_name ?? null
  const authorStr = author ? ` by ${author}` : ''
  const yearStr   = book.first_published_year ? ` (${book.first_published_year})` : ''
  const descStr   = book.description_book
    ? `\nBook synopsis: ${book.description_book.slice(0, 400)}`
    : ''

  // Sort bans: earliest first, then group by country
  const sorted = [...book.bans].sort((a, b) => (a.year_started ?? 9999) - (b.year_started ?? 9999))

  const banLines = sorted.map(ban => {
    const country   = ban.countries?.name_en ?? ban.country_code
    const scope     = ban.scopes?.label_en ?? 'unknown scope'
    const reasons   = ban.ban_reason_links.map(l => l.reasons?.label_en).filter(Boolean).join(', ') || 'unspecified'
    const year      = ban.year_started ? ` ${ban.year_started}` : ''
    const ended     = ban.year_ended   ? ` (lifted ${ban.year_ended})`
                    : ban.status === 'historical' ? ' (historical)' : ''
    const action    = ban.action_type ?? 'banned'
    const instPart  = ban.institution  ? ` | institution: ${ban.institution}` : ''
    const actorPart = ban.actor        ? ` | challenger/actor: ${ban.actor}` : ''
    const regionPart = ban.region      ? ` (${ban.region})` : ''
    const notePart  = ban.description  ? ` | note: ${ban.description}` : ''
    return `- ${country}${regionPart}${year}${ended}: ${action} at ${scope} level, reason: ${reasons}${instPart}${actorPart}${notePart}`
  }).join('\n')

  return `You are writing factual ban history copy for a banned books reference website.

Book: "${book.title}"${authorStr}${yearStr}${descStr}

Documented bans:
${banLines}

Write 2–3 sentences of maximally concrete, journalistic ban history. Follow this priority order:
1. Lead with the most notable or earliest documented ban. Name the specific school district, library system, prison, or government authority.
2. If there was a lawsuit, court case, or formal board proceeding — name the jurisdiction, the case, or the outcome (upheld / overturned / settled).
3. If the author or publisher made a notable public statement or legal response — include it.
4. State the official reason given by the banning authority.
5. If the ban was later lifted or the book reinstated, note it with the year.

Rules:
- Use only facts you are confident about from the historical record
- When you have no specific named case, describe accurately what the documented data shows: country, year, scope, and stated reason
- Never invent institution names, case names, official names, or reactions you are not certain about
- Do not start with "This book", "The book", or "It"
- Do not use vague constructions like "has been banned in multiple countries"
- Do not add hedges like "reportedly" or "allegedly" unless genuinely uncertain about a documented fact
- Output only the 2–3 sentence paragraph — no headers, no labels, no preamble`
}

async function generate(client: OpenAI, book: BookRow): Promise<string | null> {
  try {
    const res = await client.chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  350,
      temperature: 0,
      messages: [{ role: 'user', content: buildPrompt(book) }],
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
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
      id, title, slug, first_published_year, description_book,
      book_authors(authors(display_name)),
      bans(
        year_started, year_ended, status, action_type,
        country_code, region, institution, actor, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug, label_en))
      )
    `)
    .order('title')

  if (SLUG) {
    query = (query as any).eq('slug', SLUG)
  } else if (!OVERWRITE) {
    query = (query as any).is('description_ban', null)
  }

  const { data, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all      = (data ?? []) as unknown as BookRow[]
  const eligible = all.filter(b => b.bans.length > 0)
  const batch    = eligible.slice(0, LIMIT)

  console.log(`\n── enrich-ban-descriptions-gpt (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (OVERWRITE) console.log('  --overwrite: replacing existing description_ban too')
  console.log(`  Eligible: ${eligible.length}  Processing: ${batch.length}\n`)

  let written = 0, skipped = 0, errors = 0

  for (const book of batch) {
    const author    = book.book_authors[0]?.authors?.display_name ?? ''
    const countries = [...new Set(book.bans.map(b => b.countries?.name_en ?? b.country_code))].join(', ')
    console.log(`[${book.slug}]`)
    console.log(`  ${book.title}${author ? ` / ${author}` : ''}  (${book.bans.length} ban${book.bans.length !== 1 ? 's' : ''}: ${countries})`)

    const desc = await generate(openai, book)

    if (!desc) {
      console.log(`  → SKIP (no usable response)`)
      skipped++
    } else {
      console.log(`  → ${desc.length > 400 ? desc.slice(0, 400) + '…' : desc}`)
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('books')
          .update({ description_ban: desc })
          .eq('id', book.id)
        if (upErr) { console.error(`  ✗ ${upErr.message}`); errors++ }
        else       { console.log(`  ✓ written`); written++ }
      }
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\nDone.  Written: ${written}  Skipped: ${skipped}  Errors: ${errors}`)
  if (!APPLY) console.log('DRY-RUN — add --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
