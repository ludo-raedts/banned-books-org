#!/usr/bin/env tsx
/**
 * Resolve the "proposed" rows from scripts/verify-years-llm.ts — books where
 * the LLM cascade ended "unsure" (heavy adjudicator could not determine the
 * year). These all LACK an openlibrary_work_id, which is why the original
 * OL work-key audit skipped them. This pass closes that gap with a fuller use
 * of the OpenLibrary API as a third signal:
 *
 *   1. OL year via title+author search (author-gated) → first_publish_year,
 *      else via /isbn/{isbn} → work → first_publish_date. Captures the work key.
 *   2. Decision:
 *        - OL year == the junior model's earlier proposal → two independent
 *          sources agree → APPLY (high confidence).
 *        - OL year present but differs (or junior was null) → re-ask the heavy
 *          adjudicator WITH the OL year as new evidence; apply only on a
 *          high-confidence model_correct/other_year verdict.
 *        - no OL year → leave as-is (no new evidence).
 *   3. When a year is applied and an OL work key was found, also backfill
 *      openlibrary_work_id (fixes the root cause that excluded these rows).
 *
 * OL first_publish_year is a signal, not ground truth (corrupted by mis-dated
 * editions), hence the agreement / heavy-adjudication gates. Read-only unless
 * --apply. Resumable via JSONL checkpoint.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/resolve-proposed-years.ts --dry-run --limit=30
 *   npx tsx --env-file=.env.local scripts/resolve-proposed-years.ts --apply
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { authorsAgree } from '../src/lib/enrich/title-match'

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : Infinity })()
const CONCURRENCY = 5
const HEAVY = 'gpt-4o'
const CKPT = 'data/resolve-proposed-years.jsonl'
const YEAR_MIN = -3000, YEAR_MAX = 2026

const openai = new OpenAI()

type Prop = { id: number; slug: string; title: string; author: string | null; db_year: number; mini_year: number | null }
type Hydrated = Prop & { isbn13: string | null; cur_year: number | null; cur_work: string | null }
type Result = Prop & { ol_year: number | null; ol_work: string | null; final_year: number | null; action: 'applied_consensus' | 'applied_heavy' | 'leave' | 'error'; note: string }

const HEAVY_SYS = `You are a bibliographic adjudicator. Determine the year a literary WORK was FIRST published (original first edition, original language; NOT reprints/translations/later editions).

You are given a database year, a junior model's guess, and an OpenLibrary year. None is authoritative — OpenLibrary in particular is sometimes corrupted by a single mis-dated edition. Decide from your OWN specific knowledge of this exact work+author, using the candidates only as hints. If you do not genuinely know this work, or cannot tell which same-titled work it is, return null and verdict "unsure" — do NOT rubber-stamp any candidate.

Reply with ONLY JSON:
{"first_published_year": <integer or null>, "confidence":"high"|"medium"|"low", "verdict":"db_correct"|"model_correct"|"other_year"|"unsure", "reasoning":"<one sentence naming the edition you know it by, or why unsure>"}
BCE years negative.`

function plausible(y: number | null): y is number { return typeof y === 'number' && Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX }

async function olByTitleAuthor(title: string, author: string | null): Promise<{ year: number | null; work: string | null }> {
  const p = new URLSearchParams({ title, fields: 'key,first_publish_year,author_name', limit: '5' })
  if (author) p.set('author', author)
  try {
    const r = await fetch(`https://openlibrary.org/search.json?${p}`, { headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' } }); if (!r.ok) return { year: null, work: null }
    const j: any = await r.json()
    const doc = (j.docs ?? []).find((d: any) => !author || authorsAgree(author, d.author_name ?? []))
    if (doc) return { year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null, work: (doc.key ?? '').replace('/works/', '') || null }
  } catch { /**/ }
  return { year: null, work: null }
}

async function olByIsbn(isbn: string | null): Promise<{ year: number | null; work: string | null }> {
  if (!isbn) return { year: null, work: null }
  try {
    const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' } }); if (!r.ok) return { year: null, work: null }
    const e: any = await r.json()
    const wk = (e.works ?? [])[0]?.key; if (!wk) return { year: null, work: null }
    const wr = await fetch(`https://openlibrary.org${wk}.json`, { headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' } }); if (!wr.ok) return { year: null, work: wk.replace('/works/', '') }
    const w: any = await wr.json()
    const d = w.first_publish_date as string | undefined
    if (d) { const m = d.match(/\b(1[0-9]{3}|20[0-9]{2})\b/); if (m) return { year: parseInt(m[1], 10), work: wk.replace('/works/', '') } }
    return { year: null, work: wk.replace('/works/', '') }
  } catch { return { year: null, work: null } }
}

async function heavy(b: Hydrated, olYear: number | null): Promise<any | null> {
  const u = `Title: ${b.title}\n${b.author ? `Author: ${b.author}\n` : ''}Database year: ${b.db_year}\nJunior-model year: ${b.mini_year ?? 'null'}\nOpenLibrary year: ${olYear ?? 'null'}`
  for (let a = 0; a < 2; a++) {
    try {
      const r = await openai.chat.completions.create({ model: HEAVY, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: HEAVY_SYS }, { role: 'user', content: u }] })
      return JSON.parse(r.choices[0].message.content ?? '{}')
    } catch { if (a === 1) return null; await new Promise(r => setTimeout(r, 1500)) }
  }
  return null
}

async function applyYear(sb: ReturnType<typeof adminClient>, b: Hydrated, year: number, work: string | null): Promise<string | null> {
  // guard: DB must still hold the proposed year, and (for work) still be null
  const { data: cur } = await sb.from('books').select('first_published_year, openlibrary_work_id').eq('id', b.id).maybeSingle()
  if (!cur) return 'not found'
  if (cur.first_published_year !== b.db_year) return 'db year changed since audit'
  const patch: any = { first_published_year: year }
  if (work && cur.openlibrary_work_id == null) patch.openlibrary_work_id = work
  const { error } = await sb.from('books').update(patch).eq('id', b.id)
  return error ? error.message : null
}

async function processBook(sb: ReturnType<typeof adminClient>, b: Hydrated): Promise<Result> {
  const base = { id: b.id, slug: b.slug, title: b.title, author: b.author, db_year: b.db_year, mini_year: b.mini_year }
  let ol = await olByTitleAuthor(b.title, b.author)
  if (ol.year == null) { const byIsbn = await olByIsbn(b.isbn13); if (byIsbn.year != null) ol = byIsbn; else if (!ol.work && byIsbn.work) ol.work = byIsbn.work }

  if (!plausible(ol.year)) return { ...base, ol_year: ol.year ?? null, ol_work: ol.work, final_year: null, action: 'leave', note: 'no OL year' }

  // consensus: OL agrees with the junior proposal
  if (b.mini_year != null && ol.year === b.mini_year) {
    if (ol.year === b.db_year) return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: null, action: 'leave', note: 'OL=junior=db (already correct)' }
    if (APPLY) { const err = await applyYear(sb, b, ol.year, ol.work); if (err) return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: ol.year, action: 'error', note: err } }
    return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: ol.year, action: 'applied_consensus', note: `OL=junior=${ol.year} (db was ${b.db_year})` }
  }

  // disagree / junior null → heavy adjudicates with OL as evidence
  const h = await heavy(b, ol.year)
  if (!h) return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: null, action: 'error', note: 'heavy failed' }
  const hy = h.first_published_year
  const wants = (h.verdict === 'model_correct' || h.verdict === 'other_year') && plausible(hy) && hy !== b.db_year
  // Corroboration gate: the heavy year must be backed by at least one other
  // signal (OL or the junior), so we never write a number only the heavy
  // asserted — its self-rated "high confidence" is not enough alone on the
  // obscure long tail (e.g. it confidently mis-dated "Man o' War").
  const corroborated = hy === ol.year || hy === b.mini_year
  if (h.confidence === 'high' && wants && corroborated) {
    if (APPLY) { const err = await applyYear(sb, b, hy, ol.work); if (err) return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: hy, action: 'error', note: err } }
    return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: hy, action: 'applied_heavy', note: `heavy ${h.verdict} ${hy} (OL=${ol.year}): ${h.reasoning}` }
  }
  return { ...base, ol_year: ol.year, ol_work: ol.work, final_year: null, action: 'leave', note: `heavy ${h.verdict}/${h.confidence} (OL=${ol.year})` }
}

function loadProcessed(): { ids: Set<number>; rows: Result[] } {
  const ids = new Set<number>(); const rows: Result[] = []
  if (!existsSync(CKPT)) return { ids, rows }
  for (const l of readFileSync(CKPT, 'utf8').split('\n')) { if (!l.trim()) continue; try { const r = JSON.parse(l) as Result; ids.add(r.id); rows.push(r) } catch { /**/ } }
  return { ids, rows }
}

async function main() {
  const sb = adminClient()
  const proposed: Prop[] = (JSON.parse(readFileSync('data/year-llm-verification.json', 'utf8')) as any[])
    .filter(r => r.action === 'proposed')
    .map(r => ({ id: r.id, slug: r.slug, title: r.title, author: r.author, db_year: r.db_year, mini_year: r.mini?.first_published_year ?? null }))
  const { ids: processedIds, rows: priorRows } = APPLY ? loadProcessed() : { ids: new Set<number>(), rows: [] as Result[] }
  let todo = proposed.filter(p => !processedIds.has(p.id))
  console.log(`Proposed: ${proposed.length}  already-checkpointed: ${processedIds.size}  remaining: ${todo.length}`)

  // hydrate isbn13 + current year/work
  const byId = new Map<number, Hydrated>()
  for (let i = 0; i < todo.length; i += 300) {
    const slice = todo.slice(i, i + 300)
    const { data } = await sb.from('books').select('id, isbn13, first_published_year, openlibrary_work_id').in('id', slice.map(p => p.id))
    const m = new Map((data ?? []).map((d: any) => [d.id, d]))
    for (const p of slice) { const d: any = m.get(p.id); byId.set(p.id, { ...p, isbn13: d?.isbn13 ?? null, cur_year: d?.first_published_year ?? null, cur_work: d?.openlibrary_work_id ?? null }) }
  }
  let targets = todo.map(p => byId.get(p.id)!).filter(Boolean)
  // skip rows whose DB year already changed since the audit (a later pass touched them)
  targets = targets.filter(t => t.cur_year === t.db_year)
  if (LIMIT !== Infinity) targets = targets.slice(0, LIMIT)
  console.log(`Processing ${targets.length}. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  const fresh: Result[] = []; let done = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const res = await Promise.all(targets.slice(i, i + CONCURRENCY).map(b => processBook(sb, b)))
    fresh.push(...res)
    if (APPLY) appendFileSync(CKPT, res.map(r => JSON.stringify(r)).join('\n') + '\n')
    done += res.length
    for (const r of res) if (r.action.startsWith('applied')) console.log(`  ${APPLY ? '✓' : '•'} #${r.id} ${r.db_year}→${r.final_year} [${r.action === 'applied_consensus' ? 'consensus' : 'heavy'}] | ${r.title}`)
    if (done % 60 === 0 || done === targets.length) process.stdout.write(`\r  processed ${done}/${targets.length}\n`)
  }

  const results = [...priorRows, ...fresh]
  const by = (a: string) => results.filter(r => r.action === a)
  writeFileSync('data/resolve-proposed-years.json', JSON.stringify(results, null, 2))
  const applied = [...by('applied_consensus'), ...by('applied_heavy')]
  const md = [`# Resolve proposed years (OL API + heavy adjudicator)`, ``,
    `- Processed: ${results.length}`, `- **Applied (consensus): ${by('applied_consensus').length}**`, `- **Applied (heavy+OL): ${by('applied_heavy').length}**`,
    `- Left unresolved: ${by('leave').length}`, `- Errors: ${by('error').length}`, ``,
    `## Applied (${applied.length})`, ``, `| id | slug | db | → | via | title | note |`, `|----|------|---:|--:|-----|-------|------|`,
    ...applied.map(r => `| ${r.id} | ${r.slug} | ${r.db_year} | ${r.final_year} | ${r.action === 'applied_consensus' ? 'consensus' : 'heavy'} | ${r.title.replace(/\|/g, '\\|')} | ${r.note.replace(/\|/g, '\\|')} |`)]
  writeFileSync('data/resolve-proposed-years.md', md.join('\n'))
  console.log(`\nSummary: consensus=${by('applied_consensus').length} heavy=${by('applied_heavy').length} leave=${by('leave').length} error=${by('error').length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
