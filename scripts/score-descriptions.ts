/**
 * Audit script — scores description_ban and censorship_context per book on
 * concreteness (0–3) so we can prioritise rewrites.
 *
 * Stage 1 of the description-quality refresh. Cheap, no web search.
 *
 * Rubric (per field):
 *   3 = specific named entity (school district, court case, MP, named ban order, named org) with year+place
 *   2 = jaar + land + reden, geen named case
 *   1 = generic ("frequently banned", "reflects ongoing tensions", filler)
 *   0 = empty / unusable
 *
 * Output:
 *   data/description-audit-<timestamp>.csv
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/score-descriptions.ts                # dry-run, 10 books
 *   npx tsx --env-file=.env.local scripts/score-descriptions.ts --apply        # all books, write CSV
 *   npx tsx --env-file=.env.local scripts/score-descriptions.ts --apply --limit=200
 */

import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY      = process.argv.includes('--apply')
const limitArg   = process.argv.find(a => a.startsWith('--limit='))
const concurArg  = process.argv.find(a => a.startsWith('--concurrency='))
const LIMIT      = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 99999 : 10)
const CONCURRENCY = concurArg ? parseInt(concurArg.split('=')[1]) : 5

// Heuristic filler phrases — auto-flag score-1 if any match.
const FILLER_PATTERNS = [
  /reflects (?:the )?(?:recurring|ongoing) tension/i,
  /broad and inconsistent application/i,
  /this pattern reflects/i,
  /frequently banned/i,
  /^the (?:book|novel) has been (?:challenged|banned)/i,
  /highlights ongoing tensions/i,
  /according to records/i,
  /based on available data/i,
  /no documented lawsuits/i,
  /no (?:formal )?(?:lawsuits or )?formal proceedings have been documented/i,
  /no notable legal challenges/i,
  /(?:specific school district|specific district) (?:involved )?(?:has |have )?not been publicly disclosed/i,
  /no public statements? (?:from )?the author or publisher (?:have|has)? been (?:documented|recorded)/i,
  /the official reason given (?:by the banning authority )?was/i,
]

type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  censorship_context: string | null
}

type Score = {
  ban_score: 0 | 1 | 2 | 3
  ban_reason: string
  ctx_score: 0 | 1 | 2 | 3
  ctx_reason: string
}

function detectFiller(text: string | null): string[] {
  if (!text) return []
  return FILLER_PATTERNS
    .filter(re => re.test(text))
    .map(re => re.source.slice(0, 40))
}

function buildPrompt(b: Book): string {
  return `You are auditing two short descriptions for concreteness on a banned-books reference site.

Book: "${b.title}"

FIELD A — description_ban (Why it was banned):
${b.description_ban ?? '(empty)'}

FIELD B — censorship_context (Censorship history):
${b.censorship_context ?? '(empty)'}

Score each field 0–3:
  3 = at least one named, verifiable entity (specific school district, court case, named MP/official, named library board, named ban order) with a year AND a place
  2 = year + country + reason, no named case or institution
  1 = generic / formulaic / filler (e.g. "frequently banned", "reflects recurring tensions", "broad and inconsistent application")
  0 = empty or unusable

Return ONLY valid JSON, no other text:
{"ban_score":N,"ban_reason":"<5–12 words>","ctx_score":N,"ctx_reason":"<5–12 words>"}`
}

async function score(client: OpenAI, b: Book): Promise<Score | null> {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(b) }],
    })
    const raw = res.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.ban_score !== 'number' || typeof parsed.ctx_score !== 'number' ||
      parsed.ban_score < 0 || parsed.ban_score > 3 || parsed.ctx_score < 0 || parsed.ctx_score > 3
    ) return null
    return {
      ban_score: parsed.ban_score as 0|1|2|3,
      ban_reason: String(parsed.ban_reason ?? '').slice(0, 120),
      ctx_score: parsed.ctx_score as 0|1|2|3,
      ctx_reason: String(parsed.ctx_reason ?? '').slice(0, 120),
    }
  } catch (e) {
    console.error(`  scoring error for ${b.slug}: ${(e as Error).message}`)
    return null
  }
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function fetchAllBooks(): Promise<Book[]> {
  const supabase = adminClient()
  const PAGE = 1000
  const all: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, description_ban, censorship_context')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    const rows = (data ?? []) as Book[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const all = await fetchAllBooks()
  const batch = all.slice(0, LIMIT)
  console.log(`\n── score-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  Total: ${all.length}  Processing: ${batch.length}\n`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = path.resolve('data', `description-audit-${stamp}.csv`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const header = ['slug','title','ban_score','ban_reason','ctx_score','ctx_reason','ban_filler_hits','ctx_filler_hits','ban_len','ctx_len']
  if (APPLY) fs.writeFileSync(outPath, header.join(',') + '\n')

  let i = 0, scored = 0, failed = 0
  const distBan = [0,0,0,0]
  const distCtx = [0,0,0,0]

  async function processOne(b: Book) {
    const banFiller = detectFiller(b.description_ban)
    const ctxFiller = detectFiller(b.censorship_context)
    const s = await score(client, b)

    i++
    if (!s) { failed++; return }
    scored++

    if (banFiller.length && s.ban_score > 1) s.ban_score = 1
    if (ctxFiller.length && s.ctx_score > 1) s.ctx_score = 1

    distBan[s.ban_score]++
    distCtx[s.ctx_score]++

    const row = [
      b.slug, b.title,
      s.ban_score, s.ban_reason,
      s.ctx_score, s.ctx_reason,
      banFiller.join('|'), ctxFiller.join('|'),
      b.description_ban?.length ?? 0,
      b.censorship_context?.length ?? 0,
    ].map(csvEscape).join(',')

    if (APPLY) fs.appendFileSync(outPath, row + '\n')

    if (!APPLY || i % 100 === 0) {
      console.log(`[${i}/${batch.length}] ${b.slug.padEnd(40)} ban=${s.ban_score} ctx=${s.ctx_score}`)
    }
  }

  for (let from = 0; from < batch.length; from += CONCURRENCY) {
    const slice = batch.slice(from, from + CONCURRENCY)
    await Promise.all(slice.map(processOne))
  }

  console.log(`\nScored: ${scored}  Failed: ${failed}`)
  console.log(`description_ban   distribution: 0=${distBan[0]}  1=${distBan[1]}  2=${distBan[2]}  3=${distBan[3]}`)
  console.log(`censorship_context distribution: 0=${distCtx[0]}  1=${distCtx[1]}  2=${distCtx[2]}  3=${distCtx[3]}`)
  if (APPLY) {
    console.log(`\nWrote ${outPath}`)
    const weak = distBan[0] + distBan[1] + distCtx[0] + distCtx[1]
    console.log(`Weak fields total: ${weak}  (estimate distinct books to rewrite: ~${Math.round(weak * 0.7)})`)
  } else {
    console.log('\nDRY-RUN — add --apply to write the CSV.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
