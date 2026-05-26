#!/usr/bin/env tsx
/**
 * Step B of the Wikipedia enrichment pipeline.
 *
 * Reads data/wiki-enrichment-worklist.json (produced by step A) and, for each
 * book with a high-confidence Wikipedia URL, fetches the article, queries the
 * current DB state, and asks GPT-4o-mini to propose:
 *   - new ban events
 *   - updates to existing ban rows
 *   - rewrites of book-level description_ban / censorship_context
 *
 * Writes one JSON file per book to data/wiki-enrichment-staging/<slug>.json
 * plus a summary _summary.md. No DB writes. Step C applies after manual review.
 *
 *   node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts
 *   node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --only=6,793
 *   node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --limit=5
 *   node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --skip-existing
 *
 * Flags:
 *   --only=<book_id,book_id,...>  Only process specified book ids.
 *   --limit=N                     Stop after N books (for incremental runs).
 *   --skip-existing               Skip books that already have a staging file.
 *   --dry-llm                     Skip the OpenAI call; output a placeholder
 *                                 staging file (useful for plumbing tests).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const WORKLIST_PATH = join(process.cwd(), 'data', 'wiki-enrichment-worklist.json')
const STAGING_DIR = join(process.cwd(), 'data', 'wiki-enrichment-staging')
const SUMMARY_PATH = join(STAGING_DIR, '_summary.md')

// Flags
const ARGV = process.argv.slice(2)
const ONLY_IDS = new Set(
  (ARGV.find(a => a.startsWith('--only='))?.split('=')[1] ?? '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0),
)
const LIMIT = Number(ARGV.find(a => a.startsWith('--limit='))?.split('=')[1]) || Infinity
const SKIP_EXISTING = ARGV.includes('--skip-existing')
const DRY_LLM = ARGV.includes('--dry-llm')

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'banned-books.org-enrichment-bot (ludo.raedts@voys.nl)'
const MAX_ARTICLE_CHARS = 30000 // cap article text fed to GPT

type WorklistEntry = {
  id: number
  title: string
  slug: string
  author: string | null
  ban_count: number
  distinct_countries: number
  source_lists: string[]
  wiki: {
    url: string | null
    title: string | null
    confidence: 'high' | 'medium' | 'low' | 'none'
    score: number
    reason: string
    candidates_considered: number
  }
}

type ProposedNewBan = {
  country_code: string
  country_name: string
  year_started: number | null
  year_ended: number | null
  scope_id: number
  scope_label: string
  action_type: 'banned' | 'challenged' | 'removed' | 'restricted' | 'blocked'
  status: 'active' | 'rescinded' | 'historical' | 'unclear'
  region: string | null
  institution: string | null
  actor: string | null
  description: string
  wikipedia_quote: string
}

type ProposedUpdate = {
  ban_id: number
  patch: Record<string, unknown>
  rationale: string
  wikipedia_quote: string
}

type StagingResult = {
  book_id: number
  slug: string
  title: string
  author: string | null
  wikipedia_url: string
  generated_at: string
  new_bans: ProposedNewBan[]
  updates_to_existing: ProposedUpdate[]
  book_description_ban_rewrite: string | null
  book_censorship_context_rewrite: string | null
  notes: string | null
}

async function fetchWikipediaPlainText(url: string): Promise<string> {
  const m = url.match(/\/wiki\/(.+)$/)
  if (!m) throw new Error(`unrecognized wiki url: ${url}`)
  const wikiTitle = decodeURIComponent(m[1]).replace(/_/g, ' ')
  const u = new URL(WIKI_API)
  u.searchParams.set('action', 'query')
  u.searchParams.set('titles', wikiTitle)
  u.searchParams.set('prop', 'extracts')
  u.searchParams.set('explaintext', '1')
  u.searchParams.set('redirects', '1')
  u.searchParams.set('format', 'json')
  const r = await fetch(u, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) throw new Error(`wikipedia ${r.status}`)
  const j = (await r.json()) as {
    query?: { pages?: Record<string, { extract?: string; missing?: boolean }> }
  }
  const pages = Object.values(j.query?.pages ?? {})
  const page = pages[0]
  if (!page || page.missing) throw new Error(`page missing: ${wikiTitle}`)
  return (page.extract ?? '').slice(0, MAX_ARTICLE_CHARS)
}

type ExistingBan = {
  id: number
  country_code: string
  region: string | null
  institution: string | null
  scope_id: number
  action_type: string
  status: string
  year_started: number | null
  year_ended: number | null
  actor: string | null
  description: string | null
  confidence: string
}

type DbContext = {
  bans: ExistingBan[]
  description_ban: string | null
  censorship_context: string | null
  scopes: Map<number, { slug: string; label: string }>
}

async function loadDbContext(bookId: number): Promise<DbContext> {
  const sb = adminClient()
  const { data: book } = await sb
    .from('books')
    .select('description_ban, censorship_context')
    .eq('id', bookId)
    .single()
  const { data: bans } = await sb
    .from('bans')
    .select(
      'id, country_code, region, institution, scope_id, action_type, status, year_started, year_ended, actor, description, confidence',
    )
    .eq('book_id', bookId)
    .order('year_started')
  const { data: scopes } = await sb.from('scopes').select('id, slug, label_en')
  const scopesMap = new Map<number, { slug: string; label: string }>()
  for (const s of scopes ?? []) {
    scopesMap.set(s.id, { slug: s.slug, label: s.label_en })
  }
  return {
    bans: (bans ?? []) as ExistingBan[],
    description_ban: book?.description_ban ?? null,
    censorship_context: book?.censorship_context ?? null,
    scopes: scopesMap,
  }
}

function buildSystemPrompt(): string {
  return `You are extracting structured book-banning facts from a Wikipedia article for an academic database (banned-books.org).

You will receive (1) a Wikipedia article about a book, and (2) the current state of that book in our database. Your job: propose DB changes that are clearly supported by the article, and ONLY those.

HARD RULES:
- Each proposed event MUST be supported by a direct quote from the article that includes more than just naming a country. Acceptable: a year, a specific institution, an actor, a court case, a customs seizure, a retail withdrawal, a library relocation, a numeric outcome. Unacceptable: vague "the book was controversial in X" or "X criticised the book".
- Do NOT propose bans based on adaptations (films, TV shows).
- Do NOT propose bans based on critic opinions, reviews, religious objections without action, or protests without a concrete restriction outcome.
- Do NOT propose duplicates of events already in the database (same country + similar year + similar scope). Instead, propose an "update" if AND ONLY IF the article adds NEW concrete detail not yet present in the existing row.
- DO NOT propose an update whose patched fields would REGRESS the existing data. If the existing description already contains every fact in your proposed description, propose NO update for that field. Specifically, only propose patch.description when the article reveals facts (dates, institutions, actors, outcomes, follow-on events) that are absent from the current description.
- Same rule for book_description_ban_rewrite and book_censorship_context_rewrite: leave them null unless your rewrite ADDS material facts that the existing text lacks. Stylistic improvements alone are not enough.
- If you are unsure, OMIT the event.

SCOPES (scope_id):
  1 = School (school library / curriculum)
  2 = Public library
  3 = Prison
  4 = Government / national (state-level censorship, court ruling, customs national)
  5 = Retail (bookstores withdrawing book)
  6 = Customs / border (seizures at port of entry, separate from national ban)
  7 = Church

ACTION TYPES: banned | challenged | removed | restricted | blocked
STATUSES: active | rescinded | historical | unclear
  - "rescinded" = ban was formally lifted
  - "historical" = ban from a country that no longer exists OR lapsed without formal lifting
  - "unclear" = action happened but current status is ambiguous

COUNTRY CODES: ISO 3166-1 alpha-2. Use historical codes where applicable (SU for Soviet Union, YU for Yugoslavia, etc.).

OUTPUT: Return ONLY a JSON object matching this exact shape:
{
  "new_bans": [
    {
      "country_code": "US",
      "country_name": "United States",
      "year_started": 2007,
      "year_ended": null,
      "scope_id": 2,
      "scope_label": "Public library",
      "action_type": "restricted",
      "status": "active",
      "region": "New York" or null,
      "institution": "Brooklyn Public Library" or null,
      "actor": "patron complaint forcing reshelving" or null,
      "description": "Concrete 1-2 sentence factual description with the year/institution/actor.",
      "wikipedia_quote": "Direct quote from the article supporting this event."
    }
  ],
  "updates_to_existing": [
    {
      "ban_id": 4,
      "patch": { "description": "...", "scope_id": 4, "year_started": 1989 },
      "rationale": "current scope_id=1 (school) is wrong; Iran's action was state-level",
      "wikipedia_quote": "Direct quote supporting the correction."
    }
  ],
  "book_description_ban_rewrite": "New 1-2 paragraph description_ban incorporating all confirmed bans, or null if the existing one is already adequate.",
  "book_censorship_context_rewrite": "New 1-2 paragraph censorship_context giving historical/political framing, or null if the existing one is already adequate.",
  "notes": "Brief operator note about what you skipped and why, or null."
}

Be conservative. It is better to skip an uncertain event than to insert a wrong one.`
}

function buildUserPrompt(
  book: WorklistEntry,
  article: string,
  db: DbContext,
): string {
  const banLines = db.bans.map(b => {
    const scope = db.scopes.get(b.scope_id)
    return `  id=${b.id}  ${b.country_code}  scope=${scope?.label ?? b.scope_id}  ${b.action_type}/${b.status}  ${b.year_started ?? '?'}${b.year_ended ? '-' + b.year_ended : ''}  region=${b.region ?? 'null'}  institution=${b.institution ?? 'null'}  desc=${b.description ? `"${b.description.slice(0, 120)}…"` : 'null'}`
  })

  return `BOOK: "${book.title}"${book.author ? ` by ${book.author}` : ''}
WIKIPEDIA URL: ${book.wiki.url}

CURRENT DB STATE
================
description_ban: ${db.description_ban ? `"${db.description_ban}"` : '(null)'}

censorship_context: ${db.censorship_context ? `"${db.censorship_context}"` : '(null)'}

Existing bans (${db.bans.length}):
${banLines.length > 0 ? banLines.join('\n') : '  (none)'}

WIKIPEDIA ARTICLE (plain text, possibly truncated)
==================================================
${article}

Now produce the JSON. Remember: every proposed event needs a Wikipedia quote with specifics beyond just naming the country.`
}

async function callGpt(
  openai: OpenAI,
  system: string,
  user: string,
): Promise<Omit<StagingResult, 'book_id' | 'slug' | 'title' | 'author' | 'wikipedia_url' | 'generated_at'>> {
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  const txt = resp.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(txt) as Partial<StagingResult>
  return {
    new_bans: Array.isArray(parsed.new_bans) ? (parsed.new_bans as ProposedNewBan[]) : [],
    updates_to_existing: Array.isArray(parsed.updates_to_existing)
      ? (parsed.updates_to_existing as ProposedUpdate[])
      : [],
    book_description_ban_rewrite: parsed.book_description_ban_rewrite ?? null,
    book_censorship_context_rewrite: parsed.book_censorship_context_rewrite ?? null,
    notes: parsed.notes ?? null,
  }
}

async function main() {
  if (!existsSync(WORKLIST_PATH)) {
    throw new Error(`worklist not found: ${WORKLIST_PATH} — run step A first`)
  }
  const worklist = JSON.parse(readFileSync(WORKLIST_PATH, 'utf8')) as {
    entries: WorklistEntry[]
  }

  if (!existsSync(STAGING_DIR)) mkdirSync(STAGING_DIR, { recursive: true })

  // Skip non-high-confidence entries (no URL or auto-matcher uncertainty).
  let targets = worklist.entries.filter(e => e.wiki.confidence === 'high' && e.wiki.url)

  if (ONLY_IDS.size > 0) targets = targets.filter(e => ONLY_IDS.has(e.id))
  if (SKIP_EXISTING) {
    const existing = new Set(
      readdirSync(STAGING_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, '')),
    )
    targets = targets.filter(e => !existing.has(e.slug))
  }
  if (Number.isFinite(LIMIT)) targets = targets.slice(0, LIMIT)

  console.log(`processing ${targets.length} books`)
  if (DRY_LLM) console.log('--dry-llm: skipping OpenAI calls')

  let openai: OpenAI | null = null
  if (!DRY_LLM) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing in env')
    openai = new OpenAI({ apiKey: key })
  }

  const system = buildSystemPrompt()
  const summary: Array<{
    book_id: number
    title: string
    slug: string
    new_bans: number
    updates: number
    book_rewrite: boolean
    error: string | null
  }> = []

  let i = 0
  for (const book of targets) {
    i++
    process.stdout.write(`[${i}/${targets.length}] ${book.title.slice(0, 55).padEnd(55)} ... `)
    try {
      const article = await fetchWikipediaPlainText(book.wiki.url!)
      const db = await loadDbContext(book.id)

      let resultBody: Awaited<ReturnType<typeof callGpt>>
      if (DRY_LLM) {
        resultBody = {
          new_bans: [],
          updates_to_existing: [],
          book_description_ban_rewrite: null,
          book_censorship_context_rewrite: null,
          notes: 'dry-llm placeholder',
        }
      } else {
        const user = buildUserPrompt(book, article, db)
        resultBody = await callGpt(openai!, system, user)
      }

      const result: StagingResult = {
        book_id: book.id,
        slug: book.slug,
        title: book.title,
        author: book.author,
        wikipedia_url: book.wiki.url!,
        generated_at: new Date().toISOString(),
        ...resultBody,
      }
      writeFileSync(join(STAGING_DIR, `${book.slug}.json`), JSON.stringify(result, null, 2))

      summary.push({
        book_id: book.id,
        title: book.title,
        slug: book.slug,
        new_bans: resultBody.new_bans.length,
        updates: resultBody.updates_to_existing.length,
        book_rewrite:
          resultBody.book_description_ban_rewrite !== null ||
          resultBody.book_censorship_context_rewrite !== null,
        error: null,
      })
      console.log(
        `${resultBody.new_bans.length} new, ${resultBody.updates_to_existing.length} updates`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`ERROR: ${msg}`)
      summary.push({
        book_id: book.id,
        title: book.title,
        slug: book.slug,
        new_bans: 0,
        updates: 0,
        book_rewrite: false,
        error: msg,
      })
    }
    // Small breathing room between API calls.
    await new Promise(r => setTimeout(r, 150))
  }

  // Write summary markdown.
  const md: string[] = []
  md.push(`# Wikipedia enrichment staging summary`)
  md.push('')
  md.push(`Generated ${new Date().toISOString()}`)
  md.push(`Books processed: **${summary.length}**`)
  md.push('')
  const totalNew = summary.reduce((s, r) => s + r.new_bans, 0)
  const totalUpd = summary.reduce((s, r) => s + r.updates, 0)
  const totalRewrites = summary.filter(r => r.book_rewrite).length
  const errors = summary.filter(r => r.error)
  md.push(`- Total new bans proposed: **${totalNew}**`)
  md.push(`- Total updates proposed: **${totalUpd}**`)
  md.push(`- Book-level rewrites proposed: **${totalRewrites}**`)
  md.push(`- Errors: **${errors.length}**`)
  md.push('')

  if (errors.length > 0) {
    md.push(`## Errors`)
    for (const e of errors) md.push(`- [${e.book_id}] ${e.title}: ${e.error}`)
    md.push('')
  }

  md.push(`## Per-book breakdown`)
  md.push('')
  md.push('| Book | New bans | Updates | Rewrites | Staging file |')
  md.push('|---|---|---|---|---|')
  for (const r of summary.sort((a, b) => b.new_bans - a.new_bans)) {
    md.push(
      `| ${r.title} | ${r.new_bans} | ${r.updates} | ${r.book_rewrite ? '✓' : ''} | [${r.slug}.json](./${r.slug}.json) |`,
    )
  }

  writeFileSync(SUMMARY_PATH, md.join('\n'))
  console.log(`\nwrote: ${SUMMARY_PATH}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
