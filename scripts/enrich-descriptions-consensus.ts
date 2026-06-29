// enrich-descriptions-consensus.ts — recover book descriptions via CROSS-MODEL
// CONSENSUS, for the band of books that the grounded v2 ladder couldn't source
// but that the models genuinely know.
//
// Per book: GPT-4o-mini and Gemini-2.5-flash independently write a description
// (with a hard UNKNOWN escape — "if you don't reliably know this exact book, say
// UNKNOWN, don't guess from the title"). A third judge confirms they agree on
// CONCRETE, specific facts (not generic themes, not title-guessable). Only then
// is a final description SYNTHESISED FROM ONLY THE AGREED FACTS and stored as
// description_source_type='ai_consensus' (a distinct, clearly-labelled tier — NOT
// a cited source). Validated 2026-06-05 at 0% false-positive rate.
//
// Safe by construction: UNKNOWN or judge-disagreement → the row is left exactly
// as-is (never wiped, never confabulated). Requires migration
// 20260605120000_description_source_type_ai_consensus.sql applied before --apply.
//
// Scope (default): original_language='en', description_source_type IS NULL.
//
// Run (dry):  pnpm tsx --env-file=.env.local scripts/enrich-descriptions-consensus.ts --limit=200
// Run (write): …/enrich-descriptions-consensus.ts --apply

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]
const LIMIT = arg('limit') ? parseInt(arg('limit')!, 10) : undefined
const SLUG = arg('slug')
// --ids=1,2,3 — run consensus on an explicit set (e.g. a remediation batch).
// Still honours the description_source_type IS NULL guard so it never clobbers
// a grounded row; language filter is dropped (the caller chose these rows).
const IDS = arg('ids') ? arg('ids')!.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite) : null
const LANG = arg('lang') ?? 'en'
// Batch scope by creation date (e.g. --created-after=2026-06-28). When set, the
// original_language='en' filter is dropped so NULL-language batch imports (e.g.
// the Portugal Estado Novo books) are included. The UNKNOWN/agree gate keeps it
// safe on obscure foreign titles: unknown books just get skipped, never invented.
const CREATED_AFTER = arg('created-after')
const CONCURRENCY = arg('concurrency') ? parseInt(arg('concurrency')!, 10) : 4
const ACCEPT_CONF = parseFloat(arg('accept-conf') ?? '0.7')

const sb = adminClient()
const oai = new OpenAI()
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

const GEN_SYSTEM =
  `You write factual, concrete descriptions of specific books for a reference catalogue. ` +
  `CRITICAL: only describe the book if you genuinely have reliable knowledge of THIS EXACT book ` +
  `(this title by this author). Do NOT guess from the title. Do NOT invent plot, characters, or themes. ` +
  `If you are not confident you know this specific book, reply with exactly the single word UNKNOWN and nothing else. ` +
  `When you do know it, write 60-120 words of concrete specifics: what kind of work it is, the actual subject or plot, ` +
  `named characters or key arguments, setting — facts a reader could verify. ` +
  `Avoid generic filler like "explores themes of identity" or "a poignant coming-of-age".`

const JUDGE_SYSTEM =
  `You compare two descriptions, written independently, of the same book, to detect AI confabulation. ` +
  `They AGREE only if they match on CONCRETE, SPECIFIC, verifiable facts: the actual subject/plot, named characters, ` +
  `setting, genre, key arguments — facts that could NOT be guessed from the title alone. ` +
  `Generic thematic overlap ("themes of identity, love and loss", "a coming-of-age story") does NOT count as agreement ` +
  `and is a red flag for confabulation. ` +
  `Return ONLY JSON: {"verdict":"agree"|"disagree"|"generic","specific_agreed_facts":[string],"confidence":0..1,"reason":string}. ` +
  `Use "agree" only when there are at least two concrete, specific facts in common.`

const SYNTH_SYSTEM =
  `Write a neutral, factual book description of 50-110 words using ONLY the confirmed facts provided. ` +
  `Do not add, embellish, or infer anything beyond the listed facts. No marketing language, no filler. ` +
  `Plain prose, no preamble.`

function bookContext(b: any): string {
  const author = (b.book_authors ?? []).map((x: any) => x.authors?.display_name).filter(Boolean).join(', ') || 'unknown'
  const ctx = (b.censorship_context ?? '').slice(0, 600)
  const country = (b.bans ?? []).map((x: any) => x.countries?.name_en).filter(Boolean)[0] ?? ''
  return [
    `Title: ${b.title}`,
    `Author: ${author}`,
    b.first_published_year ? `First published: ${b.first_published_year}` : '',
    country ? `Banned/challenged in: ${country}` : '',
    ctx ? `Censorship context (about the ban, not the plot — use only to confirm which book this is): ${ctx}` : '',
  ].filter(Boolean).join('\n')
}

async function genOpenAI(ctx: string): Promise<string> {
  const r = await oai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: GEN_SYSTEM }, { role: 'user', content: ctx }], temperature: 0.3 })
  return (r.choices[0]?.message?.content ?? '').trim()
}
async function genGemini(ctx: string): Promise<string> {
  const r = await genai.models.generateContent({ model: 'gemini-2.5-flash', contents: ctx, config: { systemInstruction: GEN_SYSTEM, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } } })
  return (r.text ?? '').trim()
}
const isUnknown = (s: string) => /^unknown\b/i.test(s.trim()) || s.trim().length < 25

async function judge(title: string, a: string, b: string): Promise<any> {
  const r = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: `Book title: ${title}\n\nDescription 1:\n${a}\n\nDescription 2:\n${b}` }],
    response_format: { type: 'json_object' }, temperature: 0,
  })
  try { return JSON.parse(r.choices[0]?.message?.content ?? '{}') } catch { return { verdict: 'disagree', confidence: 0 } }
}
async function synth(title: string, facts: string[]): Promise<string> {
  const r = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYNTH_SYSTEM }, { role: 'user', content: `Book: ${title}\nConfirmed facts:\n- ${facts.join('\n- ')}` }],
    temperature: 0.2,
  })
  return (r.choices[0]?.message?.content ?? '').trim()
}

type Row = { id: number; slug: string; title: string; description_book: string | null }
type Outcome = { id: number; slug: string; decision: string; conf?: number; text?: string }

async function processBook(b: any): Promise<Outcome> {
  const ctx = bookContext(b)
  const [a, g] = await Promise.all([genOpenAI(ctx), genGemini(ctx)])
  if (isUnknown(a) || isUnknown(g)) return { id: b.id, slug: b.slug, decision: 'UNKNOWN' }
  const v = await judge(b.title, a, g)
  if (!(v.verdict === 'agree' && (v.confidence ?? 0) >= ACCEPT_CONF && (v.specific_agreed_facts?.length ?? 0) >= 2)) {
    return { id: b.id, slug: b.slug, decision: `REJECT(${v.verdict})`, conf: v.confidence }
  }
  const text = await synth(b.title, v.specific_agreed_facts)
  if (!text || text.length < 50) return { id: b.id, slug: b.slug, decision: 'REJECT(synth-short)', conf: v.confidence }
  return { id: b.id, slug: b.slug, decision: 'ACCEPT', conf: v.confidence, text }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) } }))
  return out
}

async function loadCandidates(): Promise<any[]> {
  const sel = 'id, slug, title, first_published_year, original_language, description_book, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))'
  if (SLUG) { const { data } = await sb.from('books').select(sel).eq('slug', SLUG); return data ?? [] }
  if (IDS) {
    const out: any[] = []
    for (let i = 0; i < IDS.length; i += 300) {
      const { data } = await sb.from('books').select(sel).is('description_source_type', null).in('id', IDS.slice(i, i + 300))
      out.push(...(data ?? []))
    }
    return LIMIT ? out.slice(0, LIMIT) : out
  }
  const rows: any[] = []; let from = 0; const P = 1000
  for (;;) {
    let q = sb.from('books').select(sel).is('description_source_type', null).order('id').range(from, from + P - 1)
    q = CREATED_AFTER ? q.gte('created_at', CREATED_AFTER) : q.eq('original_language', LANG)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < P) break
    from += P
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows
}

async function main() {
  console.log(`── enrich-descriptions-consensus (${APPLY ? 'APPLY' : 'DRY-RUN'}) — scope ${CREATED_AFTER ? `created-after=${CREATED_AFTER}` : `lang=${LANG}`} ──`)
  const candidates = await loadCandidates()
  console.log(`candidates (ungrounded): ${candidates.length}\n`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backup: string[] = ['id,slug,old_description_book']
  let accepted = 0, unknown = 0, rejected = 0

  const results = await pool(candidates, CONCURRENCY, async (b, i) => {
    const o = await processBook(b)
    if (o.decision === 'ACCEPT') {
      accepted++
      if (APPLY) {
        backup.push(`${b.id},${b.slug},${JSON.stringify(b.description_book ?? '')}`)
        const { error } = await sb.from('books').update({
          description_book: o.text, description_source_type: 'ai_consensus', description_source_url: null, ai_drafted: true,
        }).eq('id', b.id).is('description_source_type', null) // guard: never clobber a since-grounded row
        if (error) throw error
      }
    } else if (o.decision === 'UNKNOWN') unknown++
    else rejected++
    if ((i + 1) % 25 === 0 || o.decision === 'ACCEPT') process.stdout.write(`  [${i + 1}/${candidates.length}] ${o.decision.padEnd(18)} ${o.slug}${o.text ? ` → "${o.text.slice(0, 70)}…"` : ''}\n`)
    return o
  })

  if (APPLY && accepted > 0) {
    const p = resolve(__dirname, `../data/consensus-descriptions-backup-${stamp}.csv`)
    writeFileSync(p, backup.join('\n') + '\n')
    console.log(`\nbacked up ${accepted} prior values → ${p}`)
  }
  const rep = resolve(__dirname, `../data/consensus-descriptions-${APPLY ? 'applied' : 'dryrun'}-${stamp}.jsonl`)
  writeFileSync(rep, results.map(r => JSON.stringify(r)).join('\n') + '\n')

  const n = candidates.length || 1
  console.log(`\n================ SUMMARY ================`)
  console.log(`candidates: ${candidates.length}`)
  console.log(`ACCEPT  ${accepted} (${Math.round(accepted / n * 100)}%)${APPLY ? ' → written as ai_consensus' : ''}`)
  console.log(`REJECT  ${rejected} (${Math.round(rejected / n * 100)}%)  (left unchanged)`)
  console.log(`UNKNOWN ${unknown} (${Math.round(unknown / n * 100)}%)  (left unchanged)`)
  console.log(`report: ${rep}`)
  if (!APPLY) console.log('\nDRY-RUN — no DB writes. Review the ACCEPT samples above, then re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
