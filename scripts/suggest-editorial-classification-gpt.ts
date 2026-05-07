/**
 * Editorial-classification suggester (GPT-powered).
 *
 * Applies the editorial framework set out in the two essays
 * (/essays/what-we-document and /essays/forbidden-knowledge-iceberg) to every
 * book in the database that has at least one ban and is not yet classified.
 *
 * Routing rules — important:
 *   • warning_level === 'none' AND confidence !== 'low'
 *       → AUTO-APPLY: writes inclusion_rationale. The rationale is always
 *         internal — never publicly rendered. Auto-apply is safe because
 *         a 'none' classification produces no public-facing change.
 *   • warning_level === 'context' or 'extended', or exclude===true,
 *     or confidence === 'low'
 *       → REVIEW: writes a JSON record to data/editorial-review-<ts>.json
 *         for human review. Nothing touches the DB. This protects against
 *         unexpected public editorial-note frames appearing on book pages.
 *
 * Idempotent: skips books that already have warning_level !== 'none' or
 * inclusion_rationale set, so manual edits via the admin survive re-runs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts
 *       # dry-run, 3 samples
 *   npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply
 *       # apply to first 100 books (default --limit=100 in apply mode)
 *   npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=500
 *   npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --slug=lolita
 *       # test on one specific book
 *   npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --model=gpt-5
 *       # override model
 */

import OpenAI from 'openai'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY    = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const slugArg  = process.argv.find(a => a.startsWith('--slug='))
const delayArg = process.argv.find(a => a.startsWith('--delay='))
const modelArg = process.argv.find(a => a.startsWith('--model='))
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 100 : 3)
const SLUG     = slugArg?.split('=')[1] ?? null
const DELAY    = delayArg ? parseInt(delayArg.split('=')[1]) : 400
const MODEL    = modelArg?.split('=')[1] ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

// ─── Condensed framework, distilled from the two essays ──────────────────────
const POLICY = `You are classifying books for banned-books.org, an archive of censored
literature. Apply the editorial framework set out in two published essays
("What we document — and why that is a choice" and "Why 'forbidden knowledge'
iceberg lists collapse important distinctions").

CORE CRITERION
The archive documents restrictions on books and literary works that limit
access to ideas, identities, histories, political thought, religion,
philosophy, science, or cultural expression. Suppression — not the content's
moral status — is what makes a work belong here.

INCLUDE (even if uncomfortable)
• Politically extreme works whose suppression is itself historically significant
• Anti-religious, blasphemous, or heretical writing
• Banned LGBTQ literature, including books on the ALA most-challenged lists
• Works suppressed in colonial, totalitarian, or theocratic regimes
• Works subject to obscenity prosecutions, prison-library bans, customs
  seizures, school removals, or platform takedowns
• Memoirs, philosophy, science, religion — anything suppressed for ideas

EXCLUDE FROM THE ARCHIVE
• Material whose existence intrinsically harms third parties who cannot
  defend themselves (CSAM, abuse-facilitation manuals, exploitation material).
  Suppressing these is not censorship of expression in our sense.
• Operational propaganda directly tied to mass violence, written as an
  instrument of attack rather than as discourse (e.g. attacker manifestos
  used to recruit further attacks). These belong in terrorism archives, not
  here. Note: works often called "extremist" but read as ideology rather
  than instructions for attack (Mein Kampf, Turner Diaries) DO belong, with
  extended context.

WARNING-LEVEL TIERS

The inclusion_rationale you write is ALWAYS INTERNAL — it is never shown on
the public website. The only public effect of warning_level is whether an
"Editorial note" frame renders on the book page.

none      — Default. Use for the vast majority of books. No public editorial
            note; rationale is stored internally for our records.
            Use for politically suppressed literature, school-bans, religious
            censorship, LGBTQ removals, obscenity cases, prison bans,
            cross-border bans, retail removals, etc. — anything that fits the
            standard archive without needing extra editorial framing.
context   — Reserved for books where the framework merits explicit
            acknowledgment to readers. The public effect is a small "Editorial
            note" frame with links to the two policy essays — no rationale or
            essay is shown. Use only when readers genuinely benefit from being
            pointed at the essays (works whose suppression is tied to violence
            against the creators, or works persistently misunderstood in
            public discourse). Use VERY sparingly — most books should be 'none'.
extended  — Reserved for works at the contested edge of the archive whose
            inclusion warrants a full editorial essay. Public effect: an
            "Editorial note" frame containing extended_context (a markdown
            essay, written by hand by the editorial team — NOT by this script)
            plus the policy-essay links. We have only four extended-tier books
            in the catalogue (Mein Kampf, The Turner Diaries, The Anarchist
            Cookbook, Hit Man). Use extremely sparingly — almost no book needs
            this tier.

CONFIDENCE
high   — Clear-cut case fitting the framework
medium — Needs nuance but you have a reasoned position
low    — Genuinely unclear; would benefit from human review

INCLUSION RATIONALE (always internal — never publicly rendered)
1–2 sentences explaining concretely why the book belongs in this archive
under our criteria. Reference what kind of suppression occurred. No
boilerplate. No "this is an important book". State the specific basis
("Banned in Soviet bloc for political content", "Subject of UK obscenity
trial 1960", "Most-challenged in US schools 2021–2024", etc.). This is
internal-management language for our records, not public copy.

EXCLUDE
Set exclude=true ONLY if the book genuinely fails the inclusion criteria
above (third-party harm in the work itself, or operational-propaganda
character). Will be very rare. If exclude=true, leave inclusion_rationale
brief and put the reason in exclude_reason.`

// ─── JSON schema for structured output ────────────────────────────────────────
const RESPONSE_SCHEMA = {
  name: 'editorial_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      warning_level:        { type: 'string', enum: ['none', 'context', 'extended'] },
      inclusion_rationale:  { type: 'string' },
      exclude:              { type: 'boolean' },
      exclude_reason:       { type: ['string', 'null'] },
      confidence:           { type: 'string', enum: ['high', 'medium', 'low'] },
      reasoning_summary:    { type: 'string' },
    },
    required: ['warning_level', 'inclusion_rationale', 'exclude', 'exclude_reason', 'confidence', 'reasoning_summary'],
  },
} as const

type ClassResult = {
  warning_level: 'none' | 'context' | 'extended'
  inclusion_rationale: string
  exclude: boolean
  exclude_reason: string | null
  confidence: 'high' | 'medium' | 'low'
  reasoning_summary: string
}

// ─── DB types ────────────────────────────────────────────────────────────────
type BanRow = {
  year_started:  number | null
  year_ended:    number | null
  status:        string
  action_type:   string
  country_code:  string
  region:        string | null
  institution:   string | null
  actor:         string | null
  description:   string | null
  countries:     { name_en: string } | null
  scopes:        { label_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

type BookRow = {
  id:                   number
  title:                string
  slug:                 string
  first_published_year: number | null
  genres:               string[]
  description_book:     string | null
  description_ban:      string | null
  censorship_context:   string | null
  warning_level:        string | null
  inclusion_rationale:  string | null
  book_authors:         { authors: { display_name: string } | null }[]
  bans:                 BanRow[]
}

// ─── Prompt construction ────────────────────────────────────────────────────
function buildUserPrompt(book: BookRow): string {
  const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') || 'unknown'
  const year   = book.first_published_year ? ` (${book.first_published_year})` : ''
  const genres = book.genres?.length ? `\nGenres: ${book.genres.join(', ')}` : ''

  const banLines = book.bans.map(b => {
    const country = b.countries?.name_en ?? b.country_code
    const scope   = b.scopes?.label_en ?? 'unknown scope'
    const reasons = b.ban_reason_links.map(l => l.reasons?.slug).filter(Boolean).join(', ')
    const yearTxt = b.year_started ? ` ${b.year_started}` : ''
    const ended   = b.year_ended ? ` (lifted ${b.year_ended})` : b.status === 'historical' ? ' (historical)' : ''
    const actor   = b.actor ? ` — ${b.actor}` : ''
    const inst    = b.institution ? ` — ${b.institution}` : ''
    const desc    = b.description ? ` :: ${b.description.slice(0, 220)}${b.description.length > 220 ? '…' : ''}` : ''
    return `• ${country}${yearTxt}${ended}: ${b.action_type} at ${scope}${actor}${inst} — reasons: ${reasons || 'unspecified'}${desc}`
  }).join('\n')

  const aboutBook = book.description_book ? `\n\nAbout the book:\n${book.description_book.slice(0, 800)}` : ''
  const aboutBan  = book.description_ban  ? `\n\nWhy banned (summary):\n${book.description_ban.slice(0, 600)}` : ''
  const ctx       = book.censorship_context ? `\n\nCensorship context:\n${book.censorship_context.slice(0, 600)}` : ''

  return `Book: "${book.title}" by ${author}${year}${genres}${aboutBook}${aboutBan}${ctx}

Documented bans:
${banLines || '(none)'}

Apply the framework. Return the structured classification.`
}

async function classify(client: OpenAI, book: BookRow): Promise<ClassResult | null> {
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: POLICY },
        { role: 'user',   content: buildUserPrompt(book) },
      ],
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
    })
    const txt = res.choices[0]?.message?.content
    if (!txt) return null
    return JSON.parse(txt) as ClassResult
  } catch (e) {
    console.error(`  ✗ GPT error: ${(e as Error).message}`)
    return null
  }
}

// ─── Routing ────────────────────────────────────────────────────────────────
type ReviewItem = {
  book_id: number
  slug: string
  title: string
  reason: 'context' | 'extended' | 'exclude' | 'low_confidence'
  result: ClassResult
}

function shouldAutoApply(r: ClassResult): boolean {
  return !r.exclude
    && r.warning_level === 'none'
    && r.confidence !== 'low'
    && r.inclusion_rationale.trim().length > 30
}

function reviewReason(r: ClassResult): ReviewItem['reason'] | null {
  if (r.exclude) return 'exclude'
  if (r.warning_level === 'extended') return 'extended'
  if (r.warning_level === 'context')  return 'context'
  if (r.confidence === 'low')         return 'low_confidence'
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in .env.local')
    process.exit(1)
  }

  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  console.log(`\n── suggest-editorial-classification-gpt ──`)
  console.log(`  mode:  ${APPLY ? 'APPLY (auto-apply low-risk + write review file)' : 'DRY-RUN'}`)
  console.log(`  model: ${MODEL}`)
  console.log(`  limit: ${LIMIT}${SLUG ? `  slug: ${SLUG}` : ''}`)

  // ── Fetch candidate books ──────────────────────────────────────────────────
  let query = supabase
    .from('books')
    .select(`
      id, title, slug, first_published_year, genres,
      description_book, description_ban, censorship_context,
      warning_level, inclusion_rationale,
      book_authors(authors(display_name)),
      bans(
        year_started, year_ended, status, action_type, country_code,
        region, institution, actor, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug))
      )
    `)
    .order('id')

  if (SLUG) {
    query = query.eq('slug', SLUG)
  } else {
    // Skip books that already have a classification (warning_level !== 'none'
    // OR an inclusion_rationale already set). Defensive against re-runs.
    query = query.eq('warning_level', 'none').is('inclusion_rationale', null)
  }

  const { data, error } = await query.limit(SLUG ? 1 : LIMIT * 3) // overfetch a bit; some will be filtered out
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all      = (data ?? []) as unknown as BookRow[]
  const eligible = all.filter(b => b.bans.length > 0)
  const batch    = eligible.slice(0, LIMIT)

  console.log(`  candidates fetched: ${all.length}, with ≥1 ban: ${eligible.length}, processing: ${batch.length}\n`)

  if (batch.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // ── Process ────────────────────────────────────────────────────────────────
  const reviewItems: ReviewItem[] = []
  let autoApplied = 0
  let skipped = 0
  let errors = 0
  let toReview = 0

  for (const book of batch) {
    const author = book.book_authors[0]?.authors?.display_name ?? '(unknown)'
    console.log(`[${book.slug}]`)
    console.log(`  ${book.title} / ${author}  (${book.bans.length} ban${book.bans.length === 1 ? '' : 's'})`)

    const result = await classify(openai, book)
    if (!result) { errors++; continue }

    const tag = result.exclude
      ? `EXCLUDE (${result.exclude_reason ?? '?'})`
      : `${result.warning_level} · ${result.confidence}`
    console.log(`  → ${tag}`)
    console.log(`    rationale: ${result.inclusion_rationale.slice(0, 180)}${result.inclusion_rationale.length > 180 ? '…' : ''}`)
    if (result.reasoning_summary) {
      console.log(`    reasoning: ${result.reasoning_summary.slice(0, 180)}`)
    }

    const reason = reviewReason(result)
    if (reason) {
      reviewItems.push({ book_id: book.id, slug: book.slug, title: book.title, reason, result })
      console.log(`    → REVIEW (${reason})`)
      toReview++
    } else if (shouldAutoApply(result)) {
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('books')
          .update({
            warning_level: 'none',
            inclusion_rationale: result.inclusion_rationale.trim(),
          })
          .eq('id', book.id)
        if (upErr) {
          console.log(`    ✗ DB error: ${upErr.message}`)
          errors++
        } else {
          console.log(`    ✓ auto-applied`)
          autoApplied++
        }
      } else {
        console.log(`    [dry] would auto-apply rationale`)
        autoApplied++
      }
    } else {
      console.log(`    skip (rationale too short or other guard)`)
      skipped++
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  // ── Write review file ──────────────────────────────────────────────────────
  if (reviewItems.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reviewPath = join(process.cwd(), 'data', `editorial-review-${ts}.json`)
    writeFileSync(reviewPath, JSON.stringify(reviewItems, null, 2))
    console.log(`\nReview file written: ${reviewPath}`)
    console.log(`  → open it, review each entry, then apply via admin UI or a follow-up script.`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\nDone.`)
  console.log(`  ${APPLY ? 'auto-applied' : 'would auto-apply'}: ${autoApplied}`)
  console.log(`  flagged for review     : ${toReview}`)
  console.log(`  skipped (guard)        : ${skipped}`)
  console.log(`  errors                 : ${errors}`)
  if (!APPLY) console.log(`\nDRY-RUN — add --apply to write to DB and to a review file.`)
}

main().catch(e => { console.error(e); process.exit(1) })
