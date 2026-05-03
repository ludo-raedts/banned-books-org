/**
 * GPT-powered censorship context enrichment.
 * Targets books with description_book but no censorship_context.
 * Uses GPT-4o-mini to generate concrete, specific 2-4 sentence context
 * with named cases, lawsuits, challengers, states, and outcomes.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts             # dry-run, 3 samples
 *   npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --overwrite  # also replace existing
 *   npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --slug=howl-and-other-poems
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY    = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const slugArg  = process.argv.find(a => a.startsWith('--slug='))
const delayArg = process.argv.find(a => a.startsWith('--delay='))
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 200 : 3)
const SLUG     = slugArg?.split('=')[1] ?? null
const DELAY    = delayArg ? parseInt(delayArg.split('=')[1]) : 800

type BanRow = {
  year_started:    number | null
  year_ended:      number | null
  status:          string
  action_type:     string
  country_code:    string
  region:          string | null
  institution:     string | null
  actor:           string | null
  description:     string | null
  countries:       { name_en: string } | null
  scopes:          { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
}

type BookRow = {
  id:                  number
  title:               string
  slug:                string
  first_published_year: number | null
  description_book:    string | null
  book_authors:        { authors: { display_name: string } | null }[]
  bans:                BanRow[]
}

function buildPrompt(book: BookRow): string {
  const author   = book.book_authors[0]?.authors?.display_name ?? null
  const authorNote = author ? ` by ${author}` : ''
  const yearNote   = book.first_published_year ? ` (first published ${book.first_published_year})` : ''

  const banLines = book.bans.map(ban => {
    const country   = ban.countries?.name_en ?? ban.country_code
    const scope     = ban.scopes?.label_en ?? 'unknown scope'
    const reasons   = ban.ban_reason_links.map(l => l.reasons?.label_en).filter(Boolean).join(', ')
    const year      = ban.year_started ? ` in ${ban.year_started}` : ''
    const ended     = ban.year_ended   ? ` (lifted ${ban.year_ended})` : ban.status === 'historical' ? ' (historical)' : ''
    const instNote  = ban.institution  ? ` — ${ban.institution}` : ''
    const actorNote = ban.actor        ? ` — challenged by ${ban.actor}` : ''
    const descNote  = ban.description  ? ` — note: ${ban.description}` : ''
    return `- ${country}${year}${ended}: ${ban.action_type} at ${scope} level for ${reasons || 'unspecified reasons'}${instNote}${actorNote}${descNote}`
  }).join('\n')

  return `You are writing factual censorship context for a banned books reference website.

Book: "${book.title}"${authorNote}${yearNote}
Book description: ${book.description_book?.slice(0, 500)}

Documented bans:
${banLines}

Write 2–4 sentences of concrete censorship background. Prioritise:
- Specific events: named court cases, PTA meetings, school board votes, formal complaints, customs seizures
- Named challengers, organisations, prosecutors, or officials where known from history
- Specific US states, school districts, institutions, or countries
- Actual outcomes: charges dropped, book reinstated, ban upheld, still contested
- Real years and dates

Rules:
- Use only well-established historical facts you are confident about
- If you do not know specific named events for a ban, accurately describe the pattern shown in the data (country, year, scope, reason) with neutral factual language
- Do NOT invent names, cases, or institutions you are uncertain about
- Do NOT use phrases like "According to records" or "Based on available data"
- Do NOT include generic conclusions about censorship patterns
- Output only the 2–4 sentence paragraph — no headers, no labels, no preamble`
}

async function generateContext(client: OpenAI, book: BookRow): Promise<string | null> {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.2,
      messages: [{ role: 'user', content: buildPrompt(book) }],
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
    return text.length >= 80 ? text : null
  } catch (e) {
    console.error(`  GPT error: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set')
    process.exit(1)
  }

  let query = supabase
    .from('books')
    .select(`
      id, title, slug, first_published_year, description_book,
      book_authors(authors(display_name)),
      bans(
        year_started, year_ended, status, action_type, country_code, region, institution, actor, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug, label_en))
      )
    `)
    .not('description_book', 'is', null)
    .order('title')

  if (SLUG) {
    query = query.eq('slug', SLUG)
  } else if (!OVERWRITE) {
    query = query.is('censorship_context', null)
  }

  const { data, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all      = (data ?? []) as unknown as BookRow[]
  const eligible = all.filter(b => b.bans.length > 0)
  const batch    = eligible.slice(0, LIMIT)

  console.log(`\n── enrich-censorship-context-gpt (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (OVERWRITE) console.log('  --overwrite: will replace existing context too')
  console.log(`  Eligible: ${eligible.length}  Processing: ${batch.length}\n`)

  let written = 0, skipped = 0, errors = 0

  for (const book of batch) {
    const author    = book.book_authors[0]?.authors?.display_name ?? ''
    const banCount  = book.bans.length
    const countries = [...new Set(book.bans.map(b => b.countries?.name_en ?? b.country_code))].join(', ')
    console.log(`[${book.slug}]`)
    console.log(`  ${book.title}${author ? ` / ${author}` : ''}  (${banCount} ban${banCount !== 1 ? 's' : ''}: ${countries})`)

    const context = await generateContext(openai, book)

    if (!context) {
      console.log(`  → SKIP (no usable response)`)
      skipped++
    } else {
      const preview = context.length > 180 ? context.slice(0, 180) + '…' : context
      console.log(`  → ${preview}`)
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('books')
          .update({ censorship_context: context })
          .eq('id', book.id)
        if (upErr) { console.error(`  ✗ ${upErr.message}`); errors++ }
        else       { console.log(`  ✓ written`); written++ }
      }
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\nDone.  Written: ${written}  Skipped: ${skipped}  Errors: ${errors}`)
  if (!APPLY) console.log('DRY-RUN — add --apply to write, or --slug=<slug> to test a specific book.')
}

main().catch(e => { console.error(e); process.exit(1) })
