// VALIDATION (read-only) — measures the cross-model consensus pipeline that
// enrich-descriptions-consensus.ts applies. Use this to vet a scope (recall +
// false-positive rate) BEFORE running the writer with --apply. No DB writes.
//
// Concept: a description is only safe to present (labelled "AI-generated") when
// GPT-4o-mini and Gemini-2.5-flash INDEPENDENTLY produce descriptions that a
// third judge confirms agree on CONCRETE, specific facts (not generic themes,
// not title-guessable). Confabulation is high-variance → divergence catches it;
// real training-data knowledge is low-variance → agreement.
//
// This script ONLY measures (no DB writes). It builds a validation set of three
// buckets and reports recall (should-accept) and false-positive rate
// (should-reject):
//   known     — books with a grounded (sourced) description → models likely know → expect ACCEPT
//   anonymous — books we wiped (obscure/anonymous, no source) → confabulation traps → expect REJECT
//   target    — ISBN-bearing no-source ungrounded → the band we'd actually want to recover
//
// Scoping for later selective application: --import / --lang / --limit / --ids.
//
// Run: pnpm tsx --env-file=.env.local scripts/_proto_consensus_descriptions.ts --validate --per-bucket=20

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { adminClient } from '../src/lib/supabase'

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]
const PER_BUCKET = parseInt(arg('per-bucket') ?? '20', 10)
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

function bookContext(b: any): string {
  const author = (b.book_authors ?? []).map((x: any) => x.authors?.display_name).filter(Boolean).join(', ') || 'unknown'
  const ctx = (b.censorship_context ?? '').slice(0, 600)
  const country = (b.bans ?? []).map((x: any) => x.countries?.name_en).filter(Boolean)[0] ?? ''
  return [
    `Title: ${b.title}`,
    `Author: ${author}`,
    b.first_published_year ? `First published: ${b.first_published_year}` : '',
    b.original_language ? `Original language: ${b.original_language}` : '',
    country ? `Banned/challenged in: ${country}` : '',
    ctx ? `Censorship context (about the ban, not the plot — use only to confirm which book this is): ${ctx}` : '',
  ].filter(Boolean).join('\n')
}

async function genOpenAI(ctx: string): Promise<string> {
  const r = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: GEN_SYSTEM }, { role: 'user', content: ctx }],
    temperature: 0.3,
  })
  return (r.choices[0]?.message?.content ?? '').trim()
}

async function genGemini(ctx: string): Promise<string> {
  const r = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: ctx,
    config: { systemInstruction: GEN_SYSTEM, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
  })
  return (r.text ?? '').trim()
}

const isUnknown = (s: string) => /^unknown\b/i.test(s.trim()) || s.trim().length < 25

async function judge(title: string, a: string, b: string): Promise<any> {
  const r = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: `Book title: ${title}\n\nDescription 1:\n${a}\n\nDescription 2:\n${b}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  })
  try { return JSON.parse(r.choices[0]?.message?.content ?? '{}') } catch { return { verdict: 'disagree', confidence: 0, reason: 'parse-fail' } }
}

type Outcome = { id: number; slug: string; bucket: string; decision: string; lang?: string; conf?: number; facts?: string[]; a?: string; b?: string; reason?: string }

async function runBook(b: any, bucket: string): Promise<Outcome> {
  const ctx = bookContext(b)
  const lang = b.original_language ?? null
  const [a, g] = await Promise.all([genOpenAI(ctx), genGemini(ctx)])
  if (isUnknown(a) || isUnknown(g)) {
    return { id: b.id, slug: b.slug, bucket, lang, decision: 'UNKNOWN', a: isUnknown(a) ? 'UNKNOWN' : a.slice(0, 80), b: isUnknown(g) ? 'UNKNOWN' : g.slice(0, 80) }
  }
  const v = await judge(b.title, a, g)
  const accepted = v.verdict === 'agree' && (v.confidence ?? 0) >= ACCEPT_CONF
  return { id: b.id, slug: b.slug, bucket, lang, decision: accepted ? 'ACCEPT' : `REJECT(${v.verdict})`, conf: v.confidence, facts: v.specific_agreed_facts, a, b: g, reason: v.reason }
}

// Full A1c population: rows still SHOWING ungrounded AI text with no source,
// ALL languages, with or without ISBN (the real keep-vs-wipe scope).
async function pickA1c(): Promise<any[]> {
  const rows: any[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb.from('books')
      .select('id, slug, title, first_published_year, original_language, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))')
      .eq('ai_drafted', true).is('description_source_type', null).not('description_book', 'is', null).eq('is_blanket_works', false)
      .order('id').range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`A1c population (ungrounded AI text, no source, all langs): ${rows.length}`)
  return shuffle(rows).slice(0, PER_BUCKET)
}

async function pickKnown(): Promise<any[]> {
  const { data } = await sb.from('books')
    .select('id, slug, title, first_published_year, original_language, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))')
    .not('description_source_type', 'is', null).not('description_book', 'is', null).limit(PER_BUCKET * 4)
  return shuffle(data ?? []).slice(0, PER_BUCKET)
}
async function pickTarget(): Promise<any[]> {
  // 2026-07-04: the historical band (ungrounded ai_drafted text, no source)
  // was emptied by the June reground work. Today's recovery band is the
  // ISBN-bearing rows where NO external source produced a blurb at all
  // (see data/desc-websearch-isbn-full.md — 686 no_source of 1.095).
  const { data } = await sb.from('books')
    .select('id, slug, title, first_published_year, original_language, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))')
    .is('description_book', null).not('isbn13', 'is', null).eq('is_blanket_works', false)
    .limit(PER_BUCKET * 4)
  return shuffle(data ?? []).slice(0, PER_BUCKET)
}

// Scoped candidate set for the user's proposed cut: English + published OR
// banned in the last ~25 years, ungrounded (the fill candidates).
async function pickScoped(): Promise<any[]> {
  const rows: any[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb.from('books')
      .select('id, slug, title, first_published_year, original_language, description_book, description_source_type, censorship_context, book_authors(authors(display_name)), bans(year_started, countries(name_en))')
      .eq('original_language', 'en').is('description_source_type', null)
      .order('id').range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const b of data as any[]) {
      const pubRecent = (b.first_published_year ?? 0) >= 2001
      const banRecent = (b.bans ?? []).some((x: any) => (x.year_started ?? 0) >= 2001)
      if (pubRecent || banRecent) rows.push(b)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`scoped population (en + pub|ban>=2001, ungrounded): ${rows.length}`)
  return shuffle(rows).slice(0, PER_BUCKET)
}
async function pickAnonymous(): Promise<any[]> {
  // wiped books from the Phase-1 backup (obscure/anonymous, confabulation traps)
  const p = resolve(__dirname, '../data/wiped-ungrounded-descriptions-backup.csv')
  if (existsSync(p)) {
    const slugs = readFileSync(p, 'utf8').split('\n').slice(1).map(l => l.split(',')[1]).filter(Boolean)
    const pick = shuffle(slugs).slice(0, PER_BUCKET)
    const { data } = await sb.from('books')
      .select('id, slug, title, first_published_year, original_language, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))')
      .in('slug', pick)
    return data ?? []
  }
  // Fallback (the CSV was a data/-cleanup casualty, 2026-07-04): Estado Novo
  // pamphlets without ISBN or description — obscure enough that any confident
  // model answer is near-certain confabulation. Same trap function, live data.
  const { data } = await sb.from('books')
    .select('id, slug, title, first_published_year, original_language, censorship_context, book_authors(authors(display_name)), bans(countries(name_en))')
    .is('description_book', null).is('isbn13', null).eq('is_blanket_works', false)
    .eq('original_language', 'pt')
    .limit(PER_BUCKET * 4)
  return shuffle(data ?? []).slice(0, PER_BUCKET)
}
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]) } }))
  return out
}

async function main() {
  const SCOPED = process.argv.includes('--scoped')
  const A1C = process.argv.includes('--a1c')
  const buckets: [string, any[]][] = A1C
    ? [['a1c', await pickA1c()], ['anonymous', await pickAnonymous()]]
    : SCOPED
    ? [['scoped-en-recent', await pickScoped()]]
    : [
        ['known', await pickKnown()],
        ['anonymous', await pickAnonymous()],
        ['target', await pickTarget()],
      ]
  const all: Outcome[] = []
  for (const [name, books] of buckets) {
    process.stdout.write(`\n[${name}] ${books.length} books...\n`)
    const res = await pool(books, 4, (b) => runBook(b, name).then(o => { process.stdout.write(`  ${o.decision.padEnd(16)} ${o.slug}\n`); return o }))
    all.push(...res)
  }
  writeFileSync(resolve(__dirname, '../data/consensus-desc-validation.jsonl'), all.map(o => JSON.stringify(o)).join('\n') + '\n')

  console.log('\n================ SUMMARY ================')
  for (const [name] of buckets) {
    const rows = all.filter(o => o.bucket === name)
    const acc = rows.filter(o => o.decision === 'ACCEPT').length
    const unk = rows.filter(o => o.decision === 'UNKNOWN').length
    const rej = rows.length - acc - unk
    const pct = (x: number) => rows.length ? Math.round(x / rows.length * 100) : 0
    console.log(`${name.padEnd(10)} n=${rows.length}  ACCEPT ${acc} (${pct(acc)}%)  REJECT ${rej} (${pct(rej)}%)  UNKNOWN ${unk} (${pct(unk)}%)`)
  }
  const an = all.filter(o => o.bucket === 'anonymous')
  const anAcc = an.filter(o => o.decision === 'ACCEPT').length
  console.log(`\nFALSE-POSITIVE rate (anonymous accepted): ${an.length ? Math.round(anAcc / an.length * 100) : 0}%  ← want near 0`)

  // A1c yield split by language (EN vs non-EN) — the decisive number: how many
  // of the keep-vs-wipe cohort the consensus pipeline would actually rescue.
  const a1c = all.filter(o => o.bucket === 'a1c')
  if (a1c.length) {
    const split = (rows: Outcome[], label: string) => {
      const acc = rows.filter(o => o.decision === 'ACCEPT').length
      const pct = rows.length ? Math.round(acc / rows.length * 100) : 0
      console.log(`  ${label.padEnd(10)} n=${rows.length}  ACCEPT ${acc} (${pct}%)`)
    }
    console.log(`\nA1c ACCEPT (rescue) rate by language:`)
    split(a1c.filter(o => o.lang === 'en'), 'en')
    split(a1c.filter(o => o.lang !== 'en'), 'non-en')
  }
  console.log(`Full per-book report: data/consensus-desc-validation.jsonl`)
}
main().catch(e => { console.error(e); process.exit(1) })
