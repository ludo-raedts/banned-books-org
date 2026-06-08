#!/usr/bin/env tsx
/**
 * LLM cascade to verify (and backfill) books.first_published_year for the rows
 * OpenLibrary couldn't confirm (see scripts/audit-publication-years.ts).
 *
 * Cascade:
 *   1. gpt-4o-mini ("junior") proposes the FIRST-publication year.
 *   2. Escalate to gpt-4o ("senior" adjudicator) when:
 *        - book HAS a DB year and the junior disagrees (|Δ|≥2) or junior is null/low, OR
 *        - book has NO DB year (backfill) and the junior is ≥medium-confidence.
 *   3. The senior decides from its OWN knowledge; it must return "unsure"/null
 *      when it doesn't genuinely know the specific work (no rubber-stamping).
 *
 * Safety property: we only WRITE a change when the senior is HIGH-confidence
 * with a concrete year AND (for rows with a DB year) verdict ∈ {model_correct,
 * other_year}. A hallucinated "db_correct"/medium therefore yields *no change*
 * — hallucination degrades to a missed fix, never a corrupted value.
 *
 * Skips rows OpenLibrary already validated (audit status 'ok') or that were
 * already corrected from OL (publication-year-fixes-highconf.json).
 *
 * Writes (apply mode): high-confidence changes straight to the DB.
 * Always writes a full audit trail to:
 *   data/year-llm-verification.json
 *   data/year-llm-verification.md
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-years-llm.ts --dry-run --limit=40
 *   npx tsx --env-file=.env.local scripts/verify-years-llm.ts --apply
 *   (default without --apply is dry-run; --limit=N caps the batch)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const CKPT = 'data/year-llm-verification.jsonl'

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : Infinity })()
const CONCURRENCY = 6
const MINI = 'gpt-4o-mini'
const SENIOR = 'gpt-4o'
const YEAR_MIN = -3000, YEAR_MAX = 2026

const openai = new OpenAI()

type Mini = { first_published_year: number | null; confidence: 'high' | 'medium' | 'low'; basis: string }
type Senior = { first_published_year: number | null; confidence: 'high' | 'medium' | 'low'; verdict: 'db_correct' | 'model_correct' | 'other_year' | 'unsure'; reasoning: string }

const MINI_SYS = `You identify the year a literary WORK was FIRST published — the original first edition in its original language, NOT a reprint, re-issue, translation, anniversary edition, or the date of any later edition. Reply with ONLY a JSON object:
{"first_published_year": <integer or null>, "confidence": "high"|"medium"|"low", "basis": "<=8 words, e.g. 'Holt 1966, Bernard Malamud'"}
Rules: If the title is generic/ambiguous and you cannot be confident WHICH work+author this is, return null with "low". Never guess. BCE years are negative integers.`

const SENIOR_SYS = `You are a bibliographic adjudicator. Determine the year a literary WORK was FIRST published (original first edition, original language; NOT reprints/translations/later editions).

CRITICAL: Decide the year from your OWN specific knowledge of this exact work+author FIRST. Do NOT assume a candidate year is correct just because it is provided — that is forbidden. If you do not genuinely, specifically know this work (or cannot tell which work it is among same-titled books), you MUST return null and verdict "unsure". Deferring to a candidate without real knowledge is a failure.

Reply with ONLY JSON:
{"first_published_year": <integer or null>, "confidence":"high"|"medium"|"low", "verdict":"db_correct"|"model_correct"|"other_year"|"unsure", "reasoning":"<one sentence naming the publisher/edition you know it by, or why unsure>"}
BCE years are negative.`

async function chat<T>(model: string, sys: string, user: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await openai.chat.completions.create({
        model, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      })
      return JSON.parse(r.choices[0].message.content ?? '{}') as T
    } catch (e) {
      if (attempt === 1) { console.error(`  ${model} error:`, e instanceof Error ? e.message : e); return null }
      await new Promise(res => setTimeout(res, 1500))
    }
  }
  return null
}

type Book = { id: number; slug: string; title: string; db_year: number | null; lang: string | null; author: string | null }

function userBlock(b: Book): string {
  return [`Title: ${b.title}`, b.author ? `Author: ${b.author}` : '', b.lang ? `Original language: ${b.lang}` : ''].filter(Boolean).join('\n')
}

type Result = Book & {
  mini: Mini | null
  senior: Senior | null
  action: 'changed' | 'backfilled' | 'confirmed' | 'proposed' | 'unresolved' | 'error'
  new_year: number | null
  note: string
}

function plausible(y: number | null): y is number {
  return typeof y === 'number' && Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX
}

async function processBook(sb: ReturnType<typeof adminClient>, b: Book): Promise<Result> {
  const mini = await chat<Mini>(MINI, MINI_SYS, userBlock(b))
  if (!mini) return { ...b, mini: null, senior: null, action: 'error', new_year: null, note: 'mini failed' }

  const hasDb = b.db_year != null
  let escalate = false
  if (hasDb) {
    escalate = (mini.first_published_year != null && Math.abs(mini.first_published_year - b.db_year!) >= 2)
      || mini.first_published_year == null || mini.confidence === 'low'
  } else {
    // backfill: only spend a senior call when junior is at least medium-confident
    escalate = mini.first_published_year != null && mini.confidence !== 'low'
  }

  // No escalation, has DB, junior agrees → confirmed.
  if (!escalate && hasDb) {
    return { ...b, mini, senior: null, action: 'confirmed', new_year: null, note: `junior agrees (${mini.first_published_year})` }
  }
  // No escalation, no DB (junior null/low) → leave NULL.
  if (!escalate && !hasDb) {
    return { ...b, mini, senior: null, action: 'unresolved', new_year: null, note: 'junior could not identify' }
  }

  const senior = await chat<Senior>(SENIOR, SENIOR_SYS,
    `${userBlock(b)}\nCandidate A (database): ${b.db_year ?? 'none'}\nCandidate B (junior model): ${mini.first_published_year ?? 'null'}`)
  if (!senior) return { ...b, mini, senior: null, action: 'error', new_year: null, note: 'senior failed' }

  const sy = senior.first_published_year
  const seniorConfident = senior.confidence === 'high' && plausible(sy)

  if (hasDb) {
    const wantsChange = (senior.verdict === 'model_correct' || senior.verdict === 'other_year') && sy !== b.db_year
    if (seniorConfident && wantsChange) {
      if (APPLY) {
        // guard: only overwrite if DB still holds the audited value
        const { data: cur } = await sb.from('books').select('first_published_year').eq('id', b.id).maybeSingle()
        if (!cur || cur.first_published_year !== b.db_year) return { ...b, mini, senior, action: 'proposed', new_year: sy, note: 'db changed since read; not applied' }
        const { error } = await sb.from('books').update({ first_published_year: sy }).eq('id', b.id)
        if (error) return { ...b, mini, senior, action: 'error', new_year: sy, note: error.message }
      }
      return { ...b, mini, senior, action: 'changed', new_year: sy!, note: `${b.db_year} → ${sy} (${senior.verdict})` }
    }
    // senior confident DB is right, or not confident enough → no change
    return { ...b, mini, senior, action: senior.verdict === 'db_correct' && seniorConfident ? 'confirmed' : 'proposed', new_year: null,
      note: `senior ${senior.verdict}/${senior.confidence} y=${sy ?? 'null'}` }
  } else {
    // backfill
    if (seniorConfident && sy != null) {
      if (APPLY) {
        const { data: cur } = await sb.from('books').select('first_published_year').eq('id', b.id).maybeSingle()
        if (!cur || cur.first_published_year !== null) return { ...b, mini, senior, action: 'proposed', new_year: sy, note: 'no longer null; not applied' }
        const { error } = await sb.from('books').update({ first_published_year: sy }).eq('id', b.id)
        if (error) return { ...b, mini, senior, action: 'error', new_year: sy, note: error.message }
      }
      return { ...b, mini, senior, action: 'backfilled', new_year: sy, note: `null → ${sy}` }
    }
    return { ...b, mini, senior, action: 'unresolved', new_year: null, note: `senior ${senior.verdict}/${senior.confidence}` }
  }
}

async function loadSkipSet(): Promise<Set<number>> {
  const skip = new Set<number>()
  if (existsSync('data/publication-year-audit.json')) {
    for (const r of JSON.parse(readFileSync('data/publication-year-audit.json', 'utf8')) as any[]) {
      if (r.status === 'ok') skip.add(r.id)
    }
  }
  if (existsSync('data/publication-year-fixes-highconf.json')) {
    for (const r of JSON.parse(readFileSync('data/publication-year-fixes-highconf.json', 'utf8')) as any[]) skip.add(r.id)
  }
  return skip
}

// Resume support: ids already written to the JSONL checkpoint are skipped.
function loadProcessed(): { ids: Set<number>; rows: Result[] } {
  const ids = new Set<number>()
  const rows: Result[] = []
  if (!existsSync(CKPT)) return { ids, rows }
  for (const line of readFileSync(CKPT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line) as Result; ids.add(r.id); rows.push(r) } catch { /* skip partial line */ }
  }
  return { ids, rows }
}

async function fetchTargets(skip: Set<number>): Promise<Book[]> {
  const sb = adminClient()
  const PAGE = 1000
  const out: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('books')
      .select('id, slug, title, first_published_year, original_language, book_authors(authors(display_name))')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const b of data as any[]) {
      if (skip.has(b.id)) continue
      out.push({
        id: b.id, slug: b.slug, title: b.title,
        db_year: b.first_published_year,
        lang: b.original_language,
        author: b.book_authors?.[0]?.authors?.display_name ?? null,
      })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  const sb = adminClient()
  const skip = await loadSkipSet()
  // Resume only applies to real (apply) runs; dry-runs neither read nor write the checkpoint.
  const { ids: processedIds, rows: priorRows } = APPLY ? loadProcessed() : { ids: new Set<number>(), rows: [] as Result[] }
  for (const id of processedIds) skip.add(id)
  console.log(`Skip set: ${skip.size}  (OL-confirmed/fixed + ${processedIds.size} already-checkpointed)`)
  let targets = await fetchTargets(skip)
  console.log(`Remaining targets: ${targets.length}  (with year: ${targets.filter(t => t.db_year != null).length}, NULL backfill: ${targets.filter(t => t.db_year == null).length})`)
  if (LIMIT !== Infinity) { targets = targets.slice(0, LIMIT); console.log(`--limit ${LIMIT} → processing ${targets.length}`) }
  console.log(`Mode: ${APPLY ? 'APPLY (writes high-confidence changes)' : 'DRY-RUN (no writes)'}\n`)

  const fresh: Result[] = []
  let done = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(b => processBook(sb, b)))
    fresh.push(...res)
    // checkpoint immediately (crash-safe) — apply runs only
    if (APPLY) appendFileSync(CKPT, res.map(r => JSON.stringify(r)).join('\n') + '\n')
    done += batch.length
    for (const r of res) if (r.action === 'changed' || r.action === 'backfilled') console.log(`  ${APPLY ? '✓' : '•'} #${r.id} ${r.note} | ${r.title} — ${r.author ?? '?'}`)
    if (done % 120 === 0 || done === targets.length) process.stdout.write(`\r  processed ${done}/${targets.length}\n`)
  }

  const results = [...priorRows, ...fresh]
  const by = (a: Result['action']) => results.filter(r => r.action === a)
  writeFileSync('data/year-llm-verification.json', JSON.stringify(results, null, 2))

  const md: string[] = []
  md.push(`# LLM year verification (gpt-4o-mini → gpt-4o cascade)`)
  md.push(``)
  md.push(`- Processed: ${results.length}`)
  md.push(`- **Changed (existing year corrected): ${by('changed').length}**`)
  md.push(`- **Backfilled (NULL → year): ${by('backfilled').length}**`)
  md.push(`- Confirmed (DB year stands): ${by('confirmed').length}`)
  md.push(`- Proposed (review — not high-confidence enough to auto-apply): ${by('proposed').length}`)
  md.push(`- Unresolved (LLM couldn't identify): ${by('unresolved').length}`)
  md.push(`- Errors: ${by('error').length}`)
  md.push(``)
  for (const [label, key] of [['Changed', 'changed'], ['Backfilled', 'backfilled'], ['Proposed (needs review)', 'proposed']] as const) {
    const rows = by(key as Result['action'])
    if (!rows.length) continue
    md.push(`## ${label} (${rows.length})`)
    md.push(``)
    md.push(`| id | slug | DB | new | senior conf/verdict | title | author | senior reasoning |`)
    md.push(`|----|------|---:|----:|--------------------|-------|--------|------------------|`)
    for (const r of rows) md.push(`| ${r.id} | ${r.slug} | ${r.db_year ?? ''} | ${r.new_year ?? ''} | ${r.senior ? `${r.senior.confidence}/${r.senior.verdict}` : ''} | ${r.title.replace(/\|/g, '\\|')} | ${(r.author ?? '').replace(/\|/g, '\\|')} | ${(r.senior?.reasoning ?? '').replace(/\|/g, '\\|')} |`)
    md.push(``)
  }
  writeFileSync('data/year-llm-verification.md', md.join('\n'))

  console.log(`\nSummary: changed=${by('changed').length} backfilled=${by('backfilled').length} confirmed=${by('confirmed').length} proposed=${by('proposed').length} unresolved=${by('unresolved').length} error=${by('error').length}`)
  console.log(`Wrote data/year-llm-verification.json and .md`)
}

main().catch(e => { console.error(e); process.exit(1) })
