/**
 * Stage 2 of description-quality refresh.
 * Reads the audit CSV from score-descriptions.ts, picks weak books, and rewrites
 * description_ban and/or censorship_context using OpenAI's web-search-grounded
 * Responses API.
 *
 * Threshold (default): rewrite a field if its score is 0 or 1. Score 2 is left alone
 * unless --include-2 is passed.
 *
 * Backups: before any DB write, the original (slug, description_ban, censorship_context)
 * is appended to data/description-backup-<timestamp>.csv. Reversible via re-import.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv>            # dry-run, 5 books
 *   npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply
 *   npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply --limit=50
 *   npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply --slug=the-bluest-eye
 *   npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply --include-2
 */

import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY      = process.argv.includes('--apply')
const INCLUDE_2  = process.argv.includes('--include-2')
const auditArg   = process.argv.find(a => a.startsWith('--audit='))
const limitArg   = process.argv.find(a => a.startsWith('--limit='))
const slugArg    = process.argv.find(a => a.startsWith('--slug='))
const concurArg  = process.argv.find(a => a.startsWith('--concurrency='))
const modelArg   = process.argv.find(a => a.startsWith('--model='))
const skipLogArg = process.argv.find(a => a.startsWith('--skip-log='))
const AUDIT_CSV  = auditArg?.split('=')[1] ?? null
const LIMIT      = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 99999 : 5)
const SLUG       = slugArg?.split('=')[1] ?? null
const CONCURRENCY = concurArg ? parseInt(concurArg.split('=')[1]) : 3
const MODEL      = modelArg?.split('=')[1] ?? 'gpt-4.1-mini'
const SKIP_LOG   = skipLogArg?.split('=')[1] ?? null

if (!AUDIT_CSV) {
  console.error('Missing --audit=<path-to-audit-csv>')
  process.exit(1)
}

type AuditRow = {
  slug: string
  ban_score: number
  ctx_score: number
}

type BanRow = {
  year_started: number | null
  year_ended: number | null
  status: string
  action_type: string
  country_code: string
  region: string | null
  institution: string | null
  actor: string | null
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
}

type Book = {
  id: number
  title: string
  slug: string
  first_published_year: number | null
  description_book: string | null
  description_ban: string | null
  censorship_context: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: BanRow[]
}

function parseAudit(filePath: string): AuditRow[] {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split('\n').filter(l => l.length > 0)
  const header = lines.shift()!.split(',')
  const idx = (n: string) => header.indexOf(n)
  const iSlug = idx('slug'), iBan = idx('ban_score'), iCtx = idx('ctx_score')
  const rows: AuditRow[] = []
  for (const line of lines) {
    // very simple CSV parse — fields with quotes/commas are handled minimally
    const fields = parseCsvLine(line)
    if (fields.length < header.length) continue
    rows.push({
      slug: fields[iSlug],
      ban_score: parseInt(fields[iBan]),
      ctx_score: parseInt(fields[iCtx]),
    })
  }
  return rows
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildBanLines(book: Book): string {
  const sorted = [...book.bans].sort((a, b) => (a.year_started ?? 9999) - (b.year_started ?? 9999))
  return sorted.map(ban => {
    const country  = ban.countries?.name_en ?? ban.country_code
    const scope    = ban.scopes?.label_en ?? 'unknown scope'
    const reasons  = ban.ban_reason_links.map(l => l.reasons?.label_en).filter(Boolean).join(', ') || 'unspecified'
    const year     = ban.year_started ? ` ${ban.year_started}` : ''
    const ended    = ban.year_ended ? ` (lifted ${ban.year_ended})` : ban.status === 'historical' ? ' (historical)' : ''
    const action   = ban.action_type ?? 'banned'
    const inst     = ban.institution ? ` | institution: ${ban.institution}` : ''
    const actor    = ban.actor ? ` | challenger/actor: ${ban.actor}` : ''
    const region   = ban.region ? ` (${ban.region})` : ''
    const note     = ban.description ? ` | note: ${ban.description}` : ''
    return `- ${country}${region}${year}${ended}: ${action} at ${scope} level, reason: ${reasons}${inst}${actor}${note}`
  }).join('\n')
}

function buildPrompt(book: Book, needBan: boolean, needCtx: boolean): string {
  const author    = book.book_authors[0]?.authors?.display_name ?? null
  const authorStr = author ? ` by ${author}` : ''
  const yearStr   = book.first_published_year ? ` (${book.first_published_year})` : ''
  const synopsis  = book.description_book ? `\nBook synopsis: ${book.description_book.slice(0, 500)}` : ''
  const banLines  = buildBanLines(book)

  const fields: string[] = []
  if (needBan) fields.push('description_ban')
  if (needCtx) fields.push('censorship_context')

  return `You are writing factual ban-history copy for a banned-books reference website. Use the web_search tool to find specific named cases, court rulings, and named institutions before writing. Prefer Wikipedia, ALA challenged-books pages, NCAC, PEN America, Marshall Libraries banned books database, and primary news reporting.

Book: "${book.title}"${authorStr}${yearStr}${synopsis}

Documented bans in our database:
${banLines || '(none recorded)'}

You will produce ${fields.length === 2 ? 'two short fields' : 'one short field'}: ${fields.join(' and ')}.

${needBan ? `## description_ban — "Why it was banned"
2–3 sentences. Concrete reasons grounded in plot/content (e.g. "graphic depiction of childhood sexual abuse by Cholly toward Pecola" rather than "sexual content"). Name the specific scenes, themes, or passages censors objected to. If the author or publisher made a notable statement, include it.

` : ''}${needCtx ? `## censorship_context — "Censorship history"
2–4 sentences. Concrete events: name the specific school district, court case, library board, country, year, and outcome (upheld / overturned / reinstated / still contested). Lead with the most notable named case if one exists. If web search yields no specific named events, accurately describe what the documented data shows — country, year, scope, reason — in neutral factual language.

` : ''}HARD RULES:
- Use only verifiable facts. If web_search returns no specific named case for a particular ban, do NOT invent one — describe the documented data neutrally.
- NEVER use these filler phrases: "frequently banned", "reflects ongoing tensions", "broad and inconsistent application", "this pattern reflects", "highlights ongoing tensions", "according to records", "based on available data".
- Do not start sentences with "This book", "The book", or "It".
- Do not hedge with "reportedly" or "allegedly" unless genuinely uncertain about a documented fact.
- No headers, labels, preamble, or citations in the prose itself.

Return ONLY valid JSON. The schema:
{
${needBan ? `  "description_ban": "<2-3 sentences>",\n` : ''}${needCtx ? `  "censorship_context": "<2-4 sentences>",\n` : ''}  "source_urls": ["url1", "url2", "..."]
}`
}

type Generation = {
  description_ban?: string
  censorship_context?: string
  source_urls: string[]
}

function stripInlineCitations(s: string): string {
  let out = s
  out = out.replace(/\s*\(\[[^\]]+\]\(https?:[^)]+\)\)/g, '')
  out = out.replace(/\s*\((?:https?:\/\/[^\s)]+|[\w-]+\.[a-z]{2,}[^\s)]*)\)/g, '')
  out = out.replace(/\s+\./g, '.').replace(/\s{2,}/g, ' ').trim()
  return out
}

async function generate(client: OpenAI, book: Book, needBan: boolean, needCtx: boolean): Promise<Generation | null> {
  try {
    // Use the Responses API with the built-in web_search tool. Returns text.
    const resp = await (client as any).responses.create({
      model: MODEL,
      input: buildPrompt(book, needBan, needCtx),
      tools: [{ type: 'web_search' }],
      max_output_tokens: 2000,
    })
    const text: string = resp.output_text ?? ''
    if (!text) {
      console.error(`  ${book.slug}: empty output_text  status=${resp.status ?? '?'}`)
      return null
    }
    // Extract JSON object from output (model may include surrounding markdown).
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error(`  ${book.slug}: no JSON in output  text="${text.slice(0, 200)}"`)
      return null
    }
    let parsed: any
    try {
      parsed = JSON.parse(match[0])
    } catch (jsonErr) {
      console.error(`  ${book.slug}: JSON parse failed  excerpt="${match[0].slice(0, 200)}"`)
      return null
    }
    const out: Generation = { source_urls: Array.isArray(parsed.source_urls) ? parsed.source_urls.slice(0, 8) : [] }
    if (needBan && typeof parsed.description_ban === 'string' && parsed.description_ban.length >= 60) {
      out.description_ban = stripInlineCitations(parsed.description_ban)
    }
    if (needCtx && typeof parsed.censorship_context === 'string' && parsed.censorship_context.length >= 80) {
      out.censorship_context = stripInlineCitations(parsed.censorship_context)
    }
    return out
  } catch (e) {
    console.error(`  GPT error for ${book.slug}: ${(e as Error).message}`)
    return null
  }
}

async function fetchBookBatch(slugs: string[]): Promise<Book[]> {
  if (!slugs.length) return []
  const supabase = adminClient()
  const all: Book[] = []
  const CHUNK = 50
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const chunk = slugs.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, slug, first_published_year, description_book,
        description_ban, censorship_context,
        book_authors(authors(display_name)),
        bans(
          year_started, year_ended, status, action_type, country_code, region,
          institution, actor, description,
          countries(name_en),
          scopes(label_en),
          ban_reason_links(reasons(slug, label_en))
        )
      `)
      .in('slug', chunk)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    all.push(...((data ?? []) as unknown as Book[]))
  }
  return all
}

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }
  if (!fs.existsSync(AUDIT_CSV!)) { console.error(`audit CSV not found: ${AUDIT_CSV}`); process.exit(1) }

  const audit = parseAudit(AUDIT_CSV!)
  const threshold = INCLUDE_2 ? 2 : 1

  type Target = AuditRow & { needBan: boolean; needCtx: boolean }
  let targets: Target[] = audit
    .map(a => ({ ...a, needBan: a.ban_score <= threshold, needCtx: a.ctx_score <= threshold }))
    .filter(a => a.needBan || a.needCtx)

  if (SLUG) targets = targets.filter(t => t.slug === SLUG)

  if (SKIP_LOG && fs.existsSync(SKIP_LOG)) {
    const skipText = fs.readFileSync(SKIP_LOG, 'utf8')
    const skipLines = skipText.split('\n').filter(Boolean)
    skipLines.shift()
    const doneSlugs = new Set(skipLines.map(l => parseCsvLine(l)[0]).filter(Boolean))
    const before = targets.length
    targets = targets.filter(t => !doneSlugs.has(t.slug))
    console.log(`  Skip-log: ${doneSlugs.size} slugs already done — ${before - targets.length} skipped, ${targets.length} remain`)
  }

  const batch = targets.slice(0, LIMIT)

  console.log(`\n── rewrite-descriptions-grounded (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  Audit: ${AUDIT_CSV}`)
  console.log(`  Threshold: scores ≤${threshold} get rewritten`)
  console.log(`  Eligible (any field weak): ${targets.length}  Processing: ${batch.length}`)
  console.log(`  Model: ${MODEL}  Concurrency: ${CONCURRENCY}\n`)

  const slugs = batch.map(b => b.slug)
  const books = await fetchBookBatch(slugs)
  const bookBySlug = new Map(books.map(b => [b.slug, b]))

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.resolve('data', `description-backup-${stamp}.csv`)
  const outputLog  = path.resolve('data', `description-rewrite-${stamp}.csv`)
  if (APPLY) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true })
    fs.writeFileSync(backupPath, ['slug','description_ban_old','censorship_context_old'].join(',') + '\n')
    fs.writeFileSync(outputLog, ['slug','wrote_ban','wrote_ctx','source_urls','ban_new','ctx_new'].join(',') + '\n')
  }

  const supabase = adminClient()
  let i = 0, written = 0, skipped = 0, errors = 0

  async function processOne(t: Target) {
    const book = bookBySlug.get(t.slug)
    i++
    if (!book) { skipped++; console.log(`[${i}/${batch.length}] ${t.slug}  → SKIP (not found)`); return }

    const gen = await generate(client, book, t.needBan, t.needCtx)
    if (!gen) { errors++; console.log(`[${i}/${batch.length}] ${t.slug}  → ERROR (no usable response)`); return }

    const wroteBan = !!(t.needBan && gen.description_ban)
    const wroteCtx = !!(t.needCtx && gen.censorship_context)
    if (!wroteBan && !wroteCtx) { skipped++; console.log(`[${i}/${batch.length}] ${t.slug}  → SKIP (output too short)`); return }

    const banPreview = gen.description_ban ? gen.description_ban.slice(0, 140) : '(unchanged)'
    const ctxPreview = gen.censorship_context ? gen.censorship_context.slice(0, 140) : '(unchanged)'
    console.log(`[${i}/${batch.length}] ${t.slug}`)
    console.log(`  ban→ ${wroteBan ? banPreview + (gen.description_ban!.length > 140 ? '…' : '') : '(unchanged)'}`)
    console.log(`  ctx→ ${wroteCtx ? ctxPreview + (gen.censorship_context!.length > 140 ? '…' : '') : '(unchanged)'}`)
    console.log(`  src: ${gen.source_urls.slice(0, 3).join(' | ')}`)

    if (APPLY) {
      // Backup first.
      fs.appendFileSync(backupPath, [book.slug, book.description_ban ?? '', book.censorship_context ?? ''].map(csvEscape).join(',') + '\n')

      const update: Record<string, string> = {}
      if (wroteBan) update.description_ban = gen.description_ban!
      if (wroteCtx) update.censorship_context = gen.censorship_context!
      const { error } = await supabase.from('books').update(update).eq('id', book.id)
      if (error) { errors++; console.log(`  ✗ DB error: ${error.message}`); return }
      written++

      fs.appendFileSync(outputLog, [
        book.slug, wroteBan ? '1' : '0', wroteCtx ? '1' : '0',
        gen.source_urls.join(' | '),
        gen.description_ban ?? '', gen.censorship_context ?? '',
      ].map(csvEscape).join(',') + '\n')
    }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  for (let from = 0; from < batch.length; from += CONCURRENCY) {
    const slice = batch.slice(from, from + CONCURRENCY)
    await Promise.all(slice.map(processOne))
  }

  console.log(`\nDone.  Written: ${written}  Skipped: ${skipped}  Errors: ${errors}`)
  if (APPLY) {
    console.log(`Backup: ${backupPath}`)
    console.log(`Log:    ${outputLog}`)
  } else {
    console.log('\nDRY-RUN — add --apply to write.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
