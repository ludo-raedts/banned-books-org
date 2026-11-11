/**
 * Source verification for the AI-written censorship history
 * (books.censorship_context).
 *
 * Background: the texts were written by enrich-censorship-context-gpt.ts from
 * model memory, with no source. Since a98caaf the book page shows one only
 * when a person vetted it. This pass decides, per text, whether a sourced
 * replacement can be published.
 *
 * It is NOT "a second model rates the first". Per book:
 *
 *   1. claims    OPENAI_FAST   split the old text into atomic checkable claims
 *   2. search    web_search    find pages that document this book's censorship;
 *                              a URL counts only if the tool actually returned it
 *                              and it is not on the deny list (src/lib/censorship-context-verify.ts)
 *   3. fetch     plain HTTP    WE fetch each page and turn it into text
 *   4. quote     OPENAI_FAST   per page: verbatim passage per claim —
 *                              kept only if it occurs literally on the fetched page
 *   5. compose   OPENAI_STRONG write 1–4 sentences from the verified quotes only,
 *                              each sentence citing its quote ids
 *   6. check     code + STRONG every number in a sentence must be in its quotes,
 *                              every name on its pages (code); every detail entailed
 *                              by the quotes (model); no contradiction with the
 *                              book's own ban rows or description_ban (code + model)
 *
 * Outcomes (written to the JSONL checkpoint, one line per book):
 *   verified             publishable: sourced rewrite that passed every check
 *   verified_additions   as verified, but the text also names an event our ban
 *                        rows do not hold (kept apart so that policy is a choice)
 *   no_checkable_claims · no_sources · no_quotes · insufficient ·
 *   source_conflict · failed_grounding · record_conflict · error
 *
 * Without --apply the run only reads the database and writes
 * data/censorship-context-verify-<tag>.jsonl (+ .md report) for review.
 *
 * --apply writes the verdicts in that checkpoint (and each new one as it lands):
 *   verified / verified_additions → censorship_context = the sourced rewrite,
 *       censorship_context_sources = [{url, title, quote}], status 'source_verified',
 *       the replaced text moves to censorship_context_unsourced (nothing is lost)
 *   every other verdict           → text and status untouched; only
 *       censorship_context_checked_at + censorship_context_check_note are set
 * A book is skipped when its text changed since it was checked, or when a
 * person has vetted it in the meantime. Changed book pages are cache-busted.
 * Review first, then apply the reviewed checkpoint without verifying more,
 * holding back what the review rejected:
 *   … --out=<tag> --apply --limit=0 --hold=slug-a,slug-b
 * A sourced sentence is as good as its source: the 64-book run of 2026-11-11
 * approved one text resting on a single page that other sources contradict
 * (Looking for Alaska, Depew NY: "removed" vs "retained"). Read the report
 * before every --apply.
 *
 * Measured 2026-11-11 on 30 books (top 20 by visits + 10 random), two runs:
 * 10/30 published; all 18 approvals hand-checked sentence by sentence against
 * their quotes, none unsupported or false. ~$0.045 per book.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-censorship-context.ts --ids-file=data/censorship-context-worklist.json --limit=30 --out=sample
 *   Flags: --ids-file= / --ids= (order is kept) · --slugs=a,b · --limit=N · --concurrency=N (default 3)
 *          --out=<tag> · --no-resume · --report-only (rebuild the .md from the JSONL)
 *          --with-ban-text (also check the claims of the hidden generated ban text, and take books that
 *          have such a ban text but no history; the sourced result is stored as the history)
 *          --recheck (also take texts that already carry a verdict in censorship_context_checked_at;
 *          by default those are skipped, as are source_verified and narrative_curated texts)
 *          --firecrawl (re-fetch bot-walled pages via Firecrawl, 1 credit each) · --firecrawl-max=N (default 400)
 * PDFs are read when `pdftotext` (poppler) is on the PATH; otherwise they are skipped.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { extractJsonObject } from '../src/lib/enrich/gemini-cover-search'
import { firecrawlFetchPage, getFirecrawlCallCount } from '../src/lib/enrich/firecrawl-fetch'
import { OPENAI_COST_PER_TOKEN, OPENAI_FAST, OPENAI_STRONG, OPENAI_NO_REASONING } from '../src/lib/llm-models'
import {
  cleanUrl, focusText, hostOf, htmlTitle, htmlToText, isDeniedSource, normUrl, quoteOnPage,
  sentenceGroundingProblems, sourceTier, MIN_QUOTE_CHARS, type SourceTier,
} from '../src/lib/censorship-context-verify'
import { isApply, hasFlag, flagValue, intFlag, idsFlag, idChunks } from './lib/cli'
import { bustChangedPages } from './lib/revalidate'

const APPLY = isApply()
// Slugs a reviewer held back: their verdicts stay in the checkpoint, unwritten.
const HOLD = new Set(flagValue('hold')?.split(',').map(s => s.trim()).filter(Boolean) ?? [])
const IDS = idsFlag()
const SLUGS = flagValue('slugs')?.split(',').map(s => s.trim()).filter(Boolean)
const LIMIT = intFlag('limit', 30)
const CONCURRENCY = Math.max(1, Math.min(6, intFlag('concurrency', 3)))
const NO_RESUME = hasFlag('no-resume')
const REPORT_ONLY = hasFlag('report-only')
// A text that already carries a verdict is not checked again unless asked.
const RECHECK = hasFlag('recheck')
// Also take the claims of the generated ban text (books.description_ban) as
// hypotheses, and take books that have a hidden ban text but no history yet.
// The sourced result is still ONE text per book, stored as the history.
const WITH_BAN_TEXT = hasFlag('with-ban-text')
const OUT_TAG = flagValue('out') ?? new Date().toISOString().slice(0, 10)
// Bot-walled pages (403 on ncac.org, pen.org, …) are re-fetched through
// Firecrawl only when asked: every call costs a credit.
const FIRECRAWL = hasFlag('firecrawl')
const FIRECRAWL_MAX = intFlag('firecrawl-max', 400)

const MAX_CLAIMS = 8
const MAX_SOURCES = 6
const FETCH_TIMEOUT_MS = 25_000
const UA = { 'User-Agent': 'banned-books.org/1.0 (source verification; contact@banned-books.org)' }
// USD per web_search tool call, on top of tokens. Override when OpenAI's price
// list changes; only used for the cost line in the report.
const WEB_SEARCH_CALL_USD = Number(process.env.OPENAI_WEB_SEARCH_CALL_USD ?? '0.01')
const PAGE_CACHE_DIR = path.resolve('data', 'logs', 'ccv-pages')

// ── Types ───────────────────────────────────────────────────────────────

type BanRow = {
  id: number
  country_code: string
  scope_id: number
  action_type: string
  status: string
  region: string | null
  institution: string | null
  year_started: number | null
  year_ended: number | null
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
}

type Book = {
  id: number
  slug: string
  title: string
  first_published_year: number | null
  description_ban: string | null
  description_ban_status: string | null
  censorship_context: string | null
  censorship_context_status: string | null
  censorship_context_checked_at: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
  bans: BanRow[]
}

type Claim = { id: string; claim: string }
type Page = { url: string; title: string | null; text: string; tier: SourceTier }
type Quote = { id: string; url: string; pageTitle: string | null; tier: SourceTier; quote: string; claimIds: string[]; stance: 'supports' | 'partial' | 'contradicts' }
type SentenceEvent = { country: string | null; year: number | null; type: string }
type Sentence = { text: string; quoteIds: string[]; events: SentenceEvent[] }

type Outcome =
  | 'verified' | 'verified_additions'
  | 'no_checkable_claims' | 'no_sources' | 'no_quotes' | 'insufficient'
  | 'source_conflict' | 'failed_grounding' | 'record_conflict' | 'error'

type RunRow = {
  id: number
  slug: string
  title: string
  author: string
  prevStatus: string | null
  outcome: Outcome
  reason: string
  oldText: string
  /** The hidden ban text whose claims were checked along with the history (--with-ban-text). */
  banText?: string | null
  newText: string | null
  sentences: Sentence[]
  quotes: Quote[]
  claims: Array<Claim & { stance: string }>
  claimsSupported: number
  sourcesReturned: number
  sourcesDropped: string[]
  pagesFetched: number
  quotesRejected: number
  droppedSentences: Array<{ text: string; why: string }>
  recordConflicts: string[]
  notInRecords: string[]
  searchCalls: number
  costUsd: number
  ts: string
}

// ── Cost accounting ─────────────────────────────────────────────────────

class Cost {
  usd = 0
  searchCalls = 0
  chat(model: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined) {
    const p = OPENAI_COST_PER_TOKEN[model] ?? OPENAI_COST_PER_TOKEN['gpt-6-luna']
    this.usd += (usage?.prompt_tokens ?? 0) * p.input + (usage?.completion_tokens ?? 0) * p.output
  }
  responses(model: string, usage: { input_tokens?: number; output_tokens?: number } | undefined, calls: number) {
    const p = OPENAI_COST_PER_TOKEN[model] ?? OPENAI_COST_PER_TOKEN['gpt-6-luna']
    this.usd += (usage?.input_tokens ?? 0) * p.input + (usage?.output_tokens ?? 0) * p.output + calls * WEB_SEARCH_CALL_USD
    this.searchCalls += calls
  }
}

// ── OpenAI plumbing ─────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await fn() } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt >= 3 || !/\b(429|500|502|503|504)\b|timeout|ECONNRESET|fetch failed/i.test(msg)) {
        throw new Error(`${label}: ${msg}`)
      }
      await sleep(4000 * attempt)
    }
  }
}

async function chatJson(model: string, system: string, user: string, maxTokens: number, cost: Cost, label: string): Promise<Record<string, unknown>> {
  const res = await withRetry(() => openai.chat.completions.create({
    ...OPENAI_NO_REASONING,
    model,
    max_completion_tokens: maxTokens,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  }), label)
  cost.chat(model, res.usage ?? undefined)
  try { return JSON.parse(res.choices[0]?.message?.content ?? '{}') as Record<string, unknown> } catch { return {} }
}

// ── Book context ────────────────────────────────────────────────────────

function authorOf(b: Book): string {
  return b.book_authors.map(a => a.authors?.display_name).filter(Boolean).join(', ')
}

function surnameOf(author: string): string {
  const first = author.split(',')[0].trim().split(/\s+/).filter(Boolean)
  return first.length ? first[first.length - 1] : ''
}

/** The book's ban rows, grouped so a 150-district title fits in a prompt. */
function banSummary(b: Book): string {
  type G = { country: string; code: string; scope: string; scopeId: number; action: string; status: string; ys: number | null; ye: number | null; n: number; inst: string[] }
  const groups = new Map<string, G>()
  for (const r of b.bans) {
    const key = [r.country_code, r.scope_id, r.action_type, r.status, r.year_started, r.year_ended].join('|')
    let g = groups.get(key)
    if (!g) {
      g = {
        country: r.countries?.name_en ?? r.country_code, code: r.country_code.trim(),
        scope: r.scopes?.label_en ?? 'unknown scope', scopeId: r.scope_id,
        action: r.action_type, status: r.status, ys: r.year_started, ye: r.year_ended, n: 0, inst: [],
      }
      groups.set(key, g)
    }
    g.n++
    const where = [r.institution, r.region].filter(Boolean).join(', ')
    if (where && g.inst.length < 3 && !g.inst.includes(where)) g.inst.push(where)
  }
  const lines = [...groups.values()]
    .sort((a, b2) => (a.scopeId === 4 ? 0 : 1) - (b2.scopeId === 4 ? 0 : 1) || b2.n - a.n)
    .slice(0, 45)
    .map(g => `- ${g.country} [${g.code}] · ${g.scope} · ${g.action} · ${g.ys ?? 'year unknown'}${g.ye ? `–${g.ye}` : ''} · status ${g.status}${g.n > 1 ? ` · ${g.n} rows` : ''}${g.inst.length ? ` · e.g. ${g.inst.join('; ')}` : ''}`)
  return lines.join('\n')
}

function banNotes(b: Book): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of b.bans) {
    const d = r.description?.trim()
    if (!d || d.length < 40 || seen.has(d)) continue
    seen.add(d)
    out.push(`- (${r.countries?.name_en ?? r.country_code}${r.year_started ? ` ${r.year_started}` : ''}) ${d.slice(0, 320)}`)
    if (out.length >= 10) break
  }
  return out.join('\n')
}

// The generated ban texts that are off the page (1b3a641): shown only once
// 'human_curated'; 'auto_rejected_low_quality' never was.
function hiddenBanText(b: Book): string | null {
  const t = b.description_ban?.trim()
  if (!t) return null
  return b.description_ban_status == null || b.description_ban_status === 'auto_accepted' ? t : null
}

/** The paragraphs whose claims are put to the sources. */
function hypotheses(b: Book): string {
  const parts: string[] = []
  if (b.censorship_context?.trim()) parts.push(b.censorship_context.trim())
  const ban = WITH_BAN_TEXT ? hiddenBanText(b) : null
  if (ban) parts.push(ban)
  return parts.join('\n\n')
}

// ── Step 1: claims ──────────────────────────────────────────────────────

const CLAIMS_SYSTEM = `You split a paragraph about the censorship of one book into atomic factual claims that can be checked against a source.

A claim is one event or one fact: who banned / challenged / seized / prosecuted / un-banned the book, where, when, on what stated grounds, with what outcome. Keep the specifics exactly as the paragraph gives them (years, places, bodies, names). One claim per event; do not merge.
Leave out: interpretation and commentary ("this reflects…", "part of a broader trend"), plot summary, and statements too vague to check ("often challenged", "in various districts").
At most ${MAX_CLAIMS} claims. If nothing checkable remains, return an empty list.

Return ONLY JSON: {"claims":[{"id":"c1","claim":"…"}]}`

async function extractClaims(b: Book, cost: Cost): Promise<Claim[]> {
  const out = await chatJson(OPENAI_FAST, CLAIMS_SYSTEM,
    `BOOK: "${b.title}" by ${authorOf(b) || 'unknown author'}\n\nPARAGRAPH:\n${hypotheses(b)}`,
    700, cost, 'claims')
  const raw = Array.isArray(out.claims) ? out.claims as Array<{ id?: unknown; claim?: unknown }> : []
  return raw
    .filter(c => typeof c.claim === 'string' && (c.claim as string).trim().length >= 15)
    .slice(0, MAX_CLAIMS)
    .map((c, i) => ({ id: `c${i + 1}`, claim: (c.claim as string).trim() }))
}

// ── Step 2: search ──────────────────────────────────────────────────────

type OutputItem = {
  type: string
  action?: { url?: string; sources?: { url?: string }[] }
  content?: { type: string; text?: string; annotations?: { type: string; url?: string }[] }[]
}

function searchPrompt(b: Book, claims: Claim[]): string {
  return `Find web pages that document the censorship history of ONE book, so specific claims can be checked against them.

BOOK: "${b.title}" by ${authorOf(b) || 'unknown author'}${b.first_published_year ? ` (first published ${b.first_published_year})` : ''}

CLAIMS TO CHECK:
${claims.map(c => `${c.id}. ${c.claim}`).join('\n')}

Search the web (several queries where needed) and open the most promising pages. Return up to ${MAX_SOURCES} pages that explicitly discuss the banning, challenging, seizure, prosecution or un-banning of THIS book and state facts relevant to the claims — confirming OR contradicting them.

Source rules:
- Prefer: library associations (ALA), PEN America, NCAC, Index on Censorship, news organisations, court records and legal databases, government publications, university and library pages, encyclopedias (Britannica, Wikipedia), the publisher's or author's own pages.
- Never return: banned-books.org, social media, forums, Q&A sites, book retailers, Goodreads, study-guide or essay sites (SparkNotes, GradeSaver, SuperSummary, LitCharts, Course Hero, StudyMoose and the like), slide decks, personal blogs, or listicles that give no sources of their own.
- Only return URLs you actually retrieved in this session. Never guess or construct a URL.

Return ONLY JSON:
{"sources":[{"url":"https://…","claim_ids":["c1"],"note":"what the page says, one short sentence"}]}
If nothing reliable exists, return {"sources":[]}.`
}

async function searchSources(b: Book, claims: Claim[], cost: Cost): Promise<{ urls: string[]; returned: number; dropped: string[] }> {
  const response = await withRetry(() => openai.responses.create({
    model: OPENAI_FAST,
    input: searchPrompt(b, claims),
    tools: [{ type: 'web_search' }],
    include: ['web_search_call.action.sources'],
    reasoning: { effort: 'low' },
  }), 'search')
  const output = response.output as unknown as OutputItem[]
  const seen = new Set<string>()
  let calls = 0
  for (const item of output) {
    if (item.type === 'web_search_call') calls++
    if (item.action?.url) seen.add(normUrl(item.action.url))
    for (const s of item.action?.sources ?? []) if (s.url) seen.add(normUrl(s.url))
    for (const c of item.content ?? []) for (const a of c.annotations ?? []) if (a.url) seen.add(normUrl(a.url))
  }
  cost.responses(OPENAI_FAST, response.usage ?? undefined, calls)

  const parsed = extractJsonObject(response.output_text ?? '') as { sources?: Array<{ url?: unknown }> } | null
  const listed = (parsed?.sources ?? []).map(s => s.url).filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
  const urls: string[] = []
  const dropped: string[] = []
  const taken = new Set<string>()
  for (const u of listed) {
    const key = normUrl(u)
    if (taken.has(key)) continue
    if (!seen.has(key)) { dropped.push(`not returned by search: ${u}`); continue }
    if (isDeniedSource(u)) { dropped.push(`deny list: ${hostOf(u)}`); continue }
    taken.add(key)
    urls.push(cleanUrl(u))
    if (urls.length >= MAX_SOURCES) break
  }
  return { urls, returned: listed.length, dropped }
}

// ── Step 3: fetch ───────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ page: Page | null; why: string }> {
  const cacheFile = path.join(PAGE_CACHE_DIR, crypto.createHash('sha1').update(normUrl(url)).digest('hex') + '.json')
  if (fs.existsSync(cacheFile)) {
    try {
      const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { title: string | null; text: string }
      return { page: { url, title: c.title, text: c.text, tier: sourceTier(url) }, why: 'cache' }
    } catch { /* refetch */ }
  }
  const store = (title: string | null, text: string, why: string): { page: Page | null; why: string } => {
    if (text.length < 400) return { page: null, why: 'page has no readable text (script-rendered or blocked)' }
    fs.mkdirSync(PAGE_CACHE_DIR, { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify({ url, title, text }))
    return { page: { url, title, text, tier: sourceTier(url) }, why }
  }
  const viaFirecrawl = async (because: string): Promise<{ page: Page | null; why: string }> => {
    if (!FIRECRAWL || getFirecrawlCallCount() >= FIRECRAWL_MAX) return { page: null, why: because }
    const fc = await firecrawlFetchPage(url)
    if (!fc.ok) return { page: null, why: `${because}; ${fc.reason}` }
    return store(htmlTitle(fc.html), htmlToText(fc.html), 'firecrawl')
  }

  let res: Response
  try {
    res = await fetch(url, { headers: { ...UA, Accept: 'text/html,application/xhtml+xml,application/pdf' }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (e) {
    return viaFirecrawl(`fetch failed (${e instanceof Error ? e.message : 'unknown'})`)
  }
  if ([401, 403, 406, 429].includes(res.status)) return viaFirecrawl(`HTTP ${res.status}`)
  if (!res.ok) return { page: null, why: `HTTP ${res.status}` }
  const type = res.headers.get('content-type') ?? ''
  if (/application\/pdf/i.test(type)) {
    // A PDF on an asset CDN or an unknown host has no visible publisher: the
    // reader would be sent to "assets.example-cdn.io". Only read PDFs from
    // institutional or reference hosts (courts, .gov, .edu, ALA, …).
    if (sourceTier(url) === 'other') return { page: null, why: 'PDF on a host with no identifiable publisher' }
    const text = await pdfText(res)
    return text ? store(null, text, 'pdf') : { page: null, why: 'PDF could not be read (pdftotext missing, too large, or scanned)' }
  }
  if (!/html|text\/plain/i.test(type)) return { page: null, why: `not HTML (${type.split(';')[0]})` }
  const html = await res.text()
  const text = /text\/plain/i.test(type) ? html : htmlToText(html)
  if (text.length < 400) return viaFirecrawl('page has no readable text (script-rendered or blocked)')
  return store(htmlTitle(html), text, 'fetched')
}

const MAX_PDF_BYTES = 25 * 1024 * 1024

/** Text of a PDF via poppler's pdftotext; null when unavailable or unreadable. */
async function pdfText(res: Response): Promise<string | null> {
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > MAX_PDF_BYTES) return null
  const tmp = path.join(os.tmpdir(), `ccv-${crypto.randomBytes(6).toString('hex')}.pdf`)
  try {
    fs.writeFileSync(tmp, buf)
    const out = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', tmp, '-'], { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 }).toString('utf8')
    // Re-join words hyphenated across a line break, then collapse the layout.
    return out.replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2').replace(/\f/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* already gone */ }
  }
}

// ── Step 4: quotes ──────────────────────────────────────────────────────

const QUOTE_SYSTEM = `You extract verbatim evidence from ONE web page for a fact-checking pipeline.

You get a BOOK, a list of CLAIMS about the censorship of that book, and the TEXT of one page (possibly excerpts separated by "[…]").

For each claim choose a stance:
- "supports": the page explicitly states the claim's facts about THIS book — the same event, with every specific of the claim (year, place, body, outcome) on the page.
- "partial": the page states the same event but not all of the claim's specifics.
- "contradicts": the page describes the same event with a different year, place, body or outcome.
- "none": the page does not address the claim, or is about another book.

For every stance except "none", copy the passage that shows it: ONE contiguous passage, character for character as it appears in the text, between ${MIN_QUOTE_CHARS} and 400 characters, long enough to name the book or make clear which book is meant. No ellipses, no paraphrase, no corrections, no merging of separate passages.

Return ONLY JSON: {"evidence":[{"claim_id":"c1","stance":"supports|partial|contradicts|none","quote":"…"}]}`

async function quotesFromPage(b: Book, claims: Claim[], page: Page, cost: Cost): Promise<{ found: Array<{ claimId: string; stance: Quote['stance']; quote: string }>; rejected: number; relevant: boolean }> {
  const author = authorOf(b)
  const needles = [b.title.replace(/\s*[:(].*$/, ''), surnameOf(author)].filter(n => n && n.length >= 3)
  const focus = focusText(page.text, needles)
  if (!focus) return { found: [], rejected: 0, relevant: false }
  const out = await chatJson(OPENAI_FAST, QUOTE_SYSTEM,
    `BOOK: "${b.title}" by ${author || 'unknown author'}\n\nCLAIMS:\n${claims.map(c => `${c.id}. ${c.claim}`).join('\n')}\n\nPAGE TITLE: ${page.title ?? '(none)'}\nPAGE TEXT:\n${focus}`,
    1400, cost, 'quote')
  const ev = Array.isArray(out.evidence) ? out.evidence as Array<{ claim_id?: unknown; stance?: unknown; quote?: unknown }> : []
  const found: Array<{ claimId: string; stance: Quote['stance']; quote: string }> = []
  let rejected = 0
  const claimIds = new Set(claims.map(c => c.id))
  for (const e of ev) {
    if (e.stance !== 'supports' && e.stance !== 'partial' && e.stance !== 'contradicts') continue
    if (typeof e.claim_id !== 'string' || !claimIds.has(e.claim_id) || typeof e.quote !== 'string') continue
    const quote = e.quote.trim()
    // The one check that matters: is this passage literally on the page we fetched?
    if (!quoteOnPage(quote, page.text)) { rejected++; continue }
    found.push({ claimId: e.claim_id, stance: e.stance, quote })
  }
  return { found, rejected, relevant: true }
}

// ── Step 5: compose ─────────────────────────────────────────────────────

const COMPOSE_SYSTEM = `You write the "censorship history" paragraph for one book page on a factual archive of banned books. You may use ONLY the numbered QUOTES you are given; each was copied verbatim from a cited web page. You have no other knowledge of this book.

Rules:
- 1 to 5 sentences, plain and neutral, past tense, at most about 130 words in total. Cover each distinct censorship event the quotes establish, the most significant first; one sentence per event.
- Say who banned, challenged, seized or prosecuted the book, where, when, on what stated grounds, and what happened afterwards — only as far as the quotes say so.
- Every sentence rests on one or more quotes; list their ids. Every year, number, name, place, institution, reason and outcome in a sentence must be stated in the quotes cited for THAT sentence. Keep the quotes' own names for places and bodies.
- Never date anything relative to now ("last year", "recently", "currently", "remains banned"). If a quote dates an event only that way, you cannot date it: leave that event out.
- If a quote reports what someone said or claimed (an author about their own book, a campaigner, an official), say who said it, as far as the quote or its page title shows; never turn a claim into a plain fact. If you cannot tell who is speaking, leave it out.
- The date of a report, article or court filing is not the date of the event it describes; give a year only when the quote dates the event itself.
- Every sentence must be understandable on its own. Say what a person or institution is (a teacher, a school board, a court) as far as the quote says so; if a quote only gives a bare surname or a name the reader cannot place, leave that event out.
- Do not merge two events into one. Do not infer motives. Do not generalise ("widely", "often", "many") unless a quote says exactly that. Do not add context, significance or a conclusion.
- Quotes marked "contradicts" disagree with the claim they were found for; they are still evidence of what the page says.
- If the quotes give conflicting facts about the same event (for example two different years), do not choose between them: return status "conflict" and say what conflicts.
- If the quotes do not establish at least one concrete censorship event for this book (who or where, and when), return status "insufficient".
- Refer to the book by its title. Do not mention sources, quotes or pages in the text, and never say what they leave out ("the account gave no date"): if something is not stated, write nothing about it.

For each sentence also list the censorship events it asserts: country (the two-letter code from COUNTRIES IN OUR RECORDS when it is one of them, otherwise the English country name, or null), year (number or null), type ("ban", "challenge", "lift" or "other").

Return ONLY JSON:
{"status":"ok|insufficient|conflict","note":"…or null","sentences":[{"text":"…","quote_ids":["q1"],"events":[{"country":"US","year":1960,"type":"ban"}]}]}`

async function compose(b: Book, quotes: Quote[], cost: Cost, rejected: Array<{ text: string; why: string }> = []): Promise<{ status: string; note: string | null; sentences: Sentence[] }> {
  const countries = [...new Map(b.bans.map(r => [r.country_code.trim(), r.countries?.name_en ?? r.country_code])).entries()]
    .map(([code, name]) => `${code} = ${name}`).join(', ')
  const user = `BOOK: "${b.title}" by ${authorOf(b) || 'unknown author'}

COUNTRIES IN OUR RECORDS: ${countries || '(none)'}

QUOTES:
${quotes.map(q => `${q.id} [${hostOf(q.url)}${q.pageTitle ? ` — ${q.pageTitle.slice(0, 80)}` : ''}]${q.stance === 'contradicts' ? ' (contradicts the claim it was found for)' : ''}: "${q.quote}"`).join('\n')}${rejected.length ? `

A CHECKER REJECTED THESE SENTENCES FROM YOUR PREVIOUS DRAFT. Write the paragraph again without the rejected details; drop a sentence entirely if nothing checkable is left of it.
${rejected.map(r => `- "${r.text}" — ${r.why}`).join('\n')}` : ''}`
  const out = await chatJson(OPENAI_STRONG, COMPOSE_SYSTEM, user, 1100, cost, 'compose')
  const status = typeof out.status === 'string' ? out.status : 'insufficient'
  const note = typeof out.note === 'string' ? out.note : null
  const ids = new Set(quotes.map(q => q.id))
  const raw = Array.isArray(out.sentences) ? out.sentences as Array<{ text?: unknown; quote_ids?: unknown; events?: unknown }> : []
  const sentences: Sentence[] = raw
    .filter(s => typeof s.text === 'string' && (s.text as string).trim().length > 20)
    .map(s => ({
      text: (s.text as string).trim(),
      quoteIds: (Array.isArray(s.quote_ids) ? s.quote_ids : []).filter((x): x is string => typeof x === 'string' && ids.has(x)),
      events: (Array.isArray(s.events) ? s.events as Array<{ country?: unknown; year?: unknown; type?: unknown }> : []).map(e => ({
        country: typeof e.country === 'string' ? e.country.trim() : null,
        year: typeof e.year === 'number' && Number.isInteger(e.year) ? e.year : null,
        type: typeof e.type === 'string' ? e.type : 'other',
      })),
    }))
  return { status, note, sentences }
}

// ── Step 6: checks ──────────────────────────────────────────────────────

const CHECK_SYSTEM = `You are the final checker for a factual archive of banned books. Be strict: when in doubt, the answer is "not entailed".

PART A — entailment. For each numbered SENTENCE you get the QUOTES it cites (verbatim passages from web pages, with the page title). "entailed" is true only if every factual detail in the sentence — event, year, place, body, name, reason, outcome, and that it concerns this book — is explicitly stated in those quotes (the page title may establish which book is meant). Anything added, sharpened, generalised or inferred makes it false; name the detail in "unsupported". A sentence that gives the date of a report or article as the date of the event is not entailed. A sentence that names a person or body the reader cannot place from the sentence itself is not entailed.

PART B — our records. Compare the SENTENCES with OUR RECORDS (the book's ban rows, its ban text and row notes). List under "contradictions" every case where a sentence and our records describe the SAME event but disagree on a fact: year it began or ended, country, authority, whether it was lifted, the outcome. Do not list wording differences. An event the sentences mention that our records simply do not contain is NOT a contradiction: list it under "not_in_records".

Return ONLY JSON:
{"sentences":[{"i":1,"entailed":true,"unsupported":null}],"contradictions":[{"sentence":1,"text_says":"…","records_say":"…"}],"not_in_records":["…"]}`

async function modelCheck(b: Book, sentences: Sentence[], quotes: Quote[], cost: Cost) {
  const byId = new Map(quotes.map(q => [q.id, q]))
  const user = `BOOK: "${b.title}" by ${authorOf(b) || 'unknown author'}

SENTENCES AND THEIR QUOTES:
${sentences.map((s, i) => `${i + 1}. ${s.text}\n${s.quoteIds.map(id => { const q = byId.get(id)!; return `   - [${q.pageTitle?.slice(0, 80) ?? hostOf(q.url)}] "${q.quote}"` }).join('\n')}`).join('\n')}

OUR RECORDS
Ban rows:
${banSummary(b) || '(none)'}
Ban text: ${b.description_ban_status === 'human_curated' ? b.description_ban?.trim() || '(none)' : '(none)'}
Row notes:
${banNotes(b) || '(none)'}`
  const out = await chatJson(OPENAI_STRONG, CHECK_SYSTEM, user, 900, cost, 'check')
  const sent = Array.isArray(out.sentences) ? out.sentences as Array<{ i?: unknown; entailed?: unknown; unsupported?: unknown }> : []
  const entailed = new Map<number, { ok: boolean; why: string | null }>()
  for (const s of sent) {
    if (typeof s.i === 'number') entailed.set(s.i, { ok: s.entailed === true, why: typeof s.unsupported === 'string' ? s.unsupported : null })
  }
  const contradictions = (Array.isArray(out.contradictions) ? out.contradictions as Array<{ sentence?: unknown; text_says?: unknown; records_say?: unknown }> : [])
    .map(c => ({ sentence: typeof c.sentence === 'number' ? c.sentence : 0, note: `text: ${String(c.text_says ?? '')} ↔ records: ${String(c.records_say ?? '')}` }))
  const notInRecords = (Array.isArray(out.not_in_records) ? out.not_in_records : []).filter((x): x is string => typeof x === 'string')
  return { entailed, contradictions, notInRecords }
}

// National-level scopes: one ban per country, so a different year for the same
// country is a disagreement about the same event, not a second event.
const NATIONAL_SCOPES = new Set([4, 6])

/** Compare the events a sentence asserts with the book's ban rows, in code. */
function recordCheck(b: Book, events: SentenceEvent[]): { conflicts: string[]; additions: string[] } {
  const conflicts: string[] = []
  const additions: string[] = []
  // A country where the text already matches a row on the year: a further
  // dated event there (a re-classification, a second seizure) is an event we
  // do not hold, not a disagreement about the one we do.
  const anchored = new Set<string>()
  for (const e of events) {
    if (!e.country || e.country.length !== 2 || e.year == null || e.type === 'lift') continue
    const code = e.country.toUpperCase()
    if (b.bans.some(r => r.country_code.trim() === code && r.year_started != null && Math.abs(r.year_started - e.year!) <= 1)) anchored.add(code)
  }
  for (const e of events) {
    if (!e.country || (e.type !== 'ban' && e.type !== 'challenge' && e.type !== 'lift')) continue
    const code = e.country.length === 2 ? e.country.toUpperCase() : null
    const rows = code ? b.bans.filter(r => r.country_code.trim() === code) : []
    if (rows.length === 0) { additions.push(`${e.type} in ${e.country}${e.year ? ` ${e.year}` : ''}: no ban row for that country`); continue }
    if (e.year == null) continue
    const near = (y: number | null) => y != null && Math.abs(y - e.year!) <= 1
    const allNational = rows.every(r => NATIONAL_SCOPES.has(r.scope_id))
    if (e.type === 'lift') {
      if (rows.some(r => near(r.year_ended))) continue
      const ended = rows.filter(r => r.year_ended != null)
      if (ended.length > 0 && allNational) conflicts.push(`text: lifted in ${code} ${e.year} ↔ rows: ended ${[...new Set(ended.map(r => r.year_ended))].join('/')}`)
      else additions.push(`lift in ${code} ${e.year}: no row records an end year`)
      continue
    }
    if (rows.some(r => near(r.year_started))) continue
    const dated = rows.filter(r => r.year_started != null)
    if (dated.length === rows.length && allNational && !anchored.has(code!)) {
      conflicts.push(`text: ${e.type} in ${code} ${e.year} ↔ rows: ${[...new Set(dated.map(r => r.year_started))].join('/')}`)
    } else {
      additions.push(`${e.type} in ${code} ${e.year}: no row for that year`)
    }
  }
  return { conflicts, additions }
}

// ── Per-book pipeline ───────────────────────────────────────────────────

async function verifyBook(b: Book): Promise<RunRow> {
  const cost = new Cost()
  const author = authorOf(b)
  const row: RunRow = {
    id: b.id, slug: b.slug, title: b.title, author, prevStatus: b.censorship_context_status,
    outcome: 'error', reason: '', oldText: b.censorship_context ?? '',
    banText: WITH_BAN_TEXT ? hiddenBanText(b) : undefined, newText: null,
    sentences: [], quotes: [], claims: [], claimsSupported: 0,
    sourcesReturned: 0, sourcesDropped: [], pagesFetched: 0, quotesRejected: 0,
    droppedSentences: [], recordConflicts: [], notInRecords: [],
    searchCalls: 0, costUsd: 0, ts: new Date().toISOString(),
  }
  const finish = (outcome: Outcome, reason: string): RunRow => {
    row.outcome = outcome; row.reason = reason
    row.costUsd = Number(cost.usd.toFixed(5)); row.searchCalls = cost.searchCalls
    return row
  }
  try {
    const claims = await extractClaims(b, cost)
    row.claims = claims.map(c => ({ ...c, stance: 'none' }))
    if (claims.length === 0) return finish('no_checkable_claims', 'the old text states nothing specific enough to check')

    const search = await searchSources(b, claims, cost)
    row.sourcesReturned = search.returned
    row.sourcesDropped = search.dropped
    if (search.urls.length === 0) return finish('no_sources', search.returned ? 'every returned URL was unverifiable or on the deny list' : 'search found no usable page')

    const fetched = await Promise.all(search.urls.map(async u => ({ u, r: await fetchPage(u) })))
    const pages = fetched.filter(f => f.r.page).map(f => f.r.page!)
    for (const f of fetched) if (!f.r.page) row.sourcesDropped.push(`${hostOf(f.u)}: ${f.r.why}`)
    row.pagesFetched = pages.length
    if (pages.length === 0) return finish('no_sources', 'no returned page could be fetched as text')

    const perPage = await Promise.all(pages.map(p => quotesFromPage(b, claims, p, cost)))
    const quotes: Quote[] = []
    perPage.forEach((r, i) => {
      row.quotesRejected += r.rejected
      if (!r.relevant) row.sourcesDropped.push(`${hostOf(pages[i].url)}: page never mentions the title or author`)
      for (const f of r.found) {
        const same = quotes.find(q => q.url === pages[i].url && q.quote === f.quote)
        if (same) { if (!same.claimIds.includes(f.claimId)) same.claimIds.push(f.claimId); continue }
        quotes.push({ id: `q${quotes.length + 1}`, url: pages[i].url, pageTitle: pages[i].title, tier: pages[i].tier, quote: f.quote, claimIds: [f.claimId], stance: f.stance })
      }
    })
    row.quotes = quotes
    const rank = { supports: 3, partial: 2, contradicts: 1, none: 0 } as const
    for (const c of row.claims) {
      for (const q of quotes) if (q.claimIds.includes(c.id) && rank[q.stance] > rank[c.stance as keyof typeof rank]) c.stance = q.stance
    }
    row.claimsSupported = row.claims.filter(c => c.stance === 'supports').length
    if (quotes.length === 0) return finish('no_quotes', `${pages.length} page(s) read, none states a claim verbatim (${row.quotesRejected} quote(s) not found on the page)`)

    const byId = new Map(quotes.map(q => [q.id, q]))
    const pageByUrl = new Map(pages.map(p => [p.url, p]))
    // Compose, check, and — once — let the composer rewrite without the details
    // the checks rejected. The text that is published is always one that was
    // composed and checked as a whole; nothing is trimmed after the fact.
    let kept: Sentence[] = []
    let check: Awaited<ReturnType<typeof modelCheck>> | null = null
    let rejected: Array<{ text: string; why: string }> = []
    for (let round = 1; round <= 2; round++) {
      const draft = await compose(b, quotes, cost, rejected)
      if (draft.status === 'conflict') return finish('source_conflict', draft.note ?? 'sources disagree about the same event')
      if (draft.status !== 'ok' || draft.sentences.length === 0) {
        row.droppedSentences = rejected
        return finish('insufficient', draft.note ?? 'quotes do not establish a concrete censorship event')
      }
      check = await modelCheck(b, draft.sentences, quotes, cost)
      kept = []
      rejected = []
      draft.sentences.forEach((s, i) => {
        const sq = s.quoteIds.map(id => byId.get(id)!).filter(Boolean)
        if (sq.length === 0) { rejected.push({ text: s.text, why: 'cites no verified quote' }); return }
        const problems = sentenceGroundingProblems({
          sentence: s.text,
          quotes: sq.map(q => q.quote),
          pageTexts: [...new Set(sq.map(q => q.url))].map(u => pageByUrl.get(u)?.text ?? ''),
          allowWords: [b.title, author],
          title: b.title,
        })
        if (problems.length) { rejected.push({ text: s.text, why: `not in the cited source: ${problems.join(', ')}` }); return }
        const ent = check!.entailed.get(i + 1)
        if (!ent?.ok) { rejected.push({ text: s.text, why: `not entailed: ${ent?.why ?? 'checker gave no verdict'}` }); return }
        kept.push(s)
      })
      if (rejected.length === 0) break
    }
    row.droppedSentences = rejected
    if (rejected.length > 0 || kept.length === 0 || !check) {
      return finish('failed_grounding', rejected.map(d => d.why).join(' · ').slice(0, 300))
    }

    const conflicts = [...check.contradictions.map(c => c.note)]
    const additions = [...check.notInRecords]
    const rc = recordCheck(b, kept.flatMap(s => s.events))
    conflicts.push(...rc.conflicts)
    additions.push(...rc.additions)
    row.recordConflicts = [...new Set(conflicts)]
    row.notInRecords = [...new Set(additions)]
    row.sentences = kept
    row.newText = kept.map(s => s.text).join(' ')
    if (row.recordConflicts.length) return finish('record_conflict', row.recordConflicts.join(' · ').slice(0, 300))
    if (row.notInRecords.length) return finish('verified_additions', row.notInRecords.join(' · ').slice(0, 300))
    return finish('verified', `${kept.length} sentence(s) from ${new Set(kept.flatMap(s => s.quoteIds).map(id => byId.get(id)!.url)).size} source(s)`)
  } catch (e) {
    return finish('error', e instanceof Error ? e.message : String(e))
  }
}

// ── Load ────────────────────────────────────────────────────────────────

const SELECT = `id, slug, title, first_published_year, description_ban, description_ban_status, censorship_context, censorship_context_status, censorship_context_checked_at,
  book_authors(authors(display_name)),
  bans(id, country_code, scope_id, action_type, status, region, institution, year_started, year_ended, description,
    countries(name_en), scopes(label_en))`

// Already settled: a person vetted it, or an earlier run of this pass published it.
const DONE_STATUSES = new Set(['narrative_curated', 'source_verified'])

async function loadBooks(): Promise<Book[]> {
  const sb = adminClient()
  const out: Book[] = []
  if (SLUGS?.length) {
    const { data, error } = await sb.from('books').select(SELECT).in('slug', SLUGS)
    if (error) throw new Error(`DB read: ${error.message}`)
    out.push(...(data as unknown as Book[]))
  } else if (IDS) {
    for (const chunk of idChunks(IDS, 100)) {
      const { data, error } = await sb.from('books').select(SELECT).in('id', chunk!)
      if (error) throw new Error(`DB read: ${error.message}`)
      out.push(...(data as unknown as Book[]))
    }
    const pos = new Map(IDS.map((id, i) => [id, i]))
    out.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
  } else {
    for (let from = 0; ; from += 500) {
      const { data, error } = await sb.from('books').select(SELECT).not('censorship_context', 'is', null)
        .order('id', { ascending: true }).range(from, from + 499)
      if (error) throw new Error(`DB read: ${error.message}`)
      out.push(...(data as unknown as Book[]))
      if (!data || data.length < 500) break
    }
  }
  return out.filter(b => hypotheses(b).length > 0
    && !DONE_STATUSES.has(b.censorship_context_status ?? '')
    && (RECHECK || SLUGS?.length || !b.censorship_context_checked_at))
}

// ── Apply ───────────────────────────────────────────────────────────────

type ApplyResult = 'published' | 'noted' | 'skipped'

function sourcesOf(r: RunRow): Array<{ url: string; title: string | null; quote: string }> {
  const out: Array<{ url: string; title: string | null; quote: string }> = []
  const seen = new Set<string>()
  for (const s of r.sentences) {
    for (const id of s.quoteIds) {
      const q = r.quotes.find(x => x.id === id)
      if (!q || seen.has(q.id)) continue
      seen.add(q.id)
      out.push({ url: q.url, title: q.pageTitle?.slice(0, 200) ?? null, quote: q.quote })
    }
  }
  return out
}

/** Write one checkpoint verdict. Never touches a text that changed since it was checked. */
async function applyRow(r: RunRow): Promise<{ result: ApplyResult; why: string }> {
  if (r.outcome === 'error') return { result: 'skipped', why: 'verification errored' }
  if (HOLD.has(r.slug)) return { result: 'skipped', why: 'held back by review (--hold)' }
  const sb = adminClient()
  const { data: cur, error } = await sb.from('books')
    .select('id, censorship_context, censorship_context_status, censorship_context_checked_at')
    .eq('id', r.id).maybeSingle()
  if (error) throw new Error(`DB read ${r.slug}: ${error.message}`)
  if (!cur) return { result: 'skipped', why: 'book no longer exists' }
  if (DONE_STATUSES.has(cur.censorship_context_status ?? '')) return { result: 'skipped', why: `already ${cur.censorship_context_status}` }
  if ((cur.censorship_context ?? '') !== r.oldText) return { result: 'skipped', why: 'text changed since it was checked' }

  const publish = r.outcome === 'verified' || r.outcome === 'verified_additions'
  if (publish) {
    const sources = sourcesOf(r)
    if (!r.newText || sources.length === 0) return { result: 'skipped', why: 'approved row has no text or no sources' }
    const { error: ue } = await sb.from('books').update({
      censorship_context: r.newText,
      censorship_context_unsourced: r.oldText || null,
      censorship_context_sources: sources,
      censorship_context_status: 'source_verified',
      censorship_context_checked_at: r.ts,
      censorship_context_check_note: r.notInRecords.length ? `events not in our ban rows: ${r.notInRecords.join(' · ')}`.slice(0, 1000) : null,
    }).eq('id', r.id)
    if (ue) throw new Error(`DB write ${r.slug}: ${ue.message}`)
    return { result: 'published', why: `${sources.length} source passage(s)` }
  }
  if (cur.censorship_context_checked_at && new Date(cur.censorship_context_checked_at).getTime() === new Date(r.ts).getTime()) return { result: 'skipped', why: 'verdict already recorded' }
  const { error: ue } = await sb.from('books').update({
    censorship_context_checked_at: r.ts,
    censorship_context_check_note: `${r.outcome}: ${r.reason}`.slice(0, 1000),
  }).eq('id', r.id)
  if (ue) throw new Error(`DB write ${r.slug}: ${ue.message}`)
  return { result: 'noted', why: r.outcome }
}

// ── Report ──────────────────────────────────────────────────────────────

function writeReport(rows: RunRow[], reportPath: string) {
  const tally: Record<string, number> = {}
  for (const r of rows) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1
  const cost = rows.reduce((a, r) => a + r.costUsd, 0)
  const searches = rows.reduce((a, r) => a + r.searchCalls, 0)
  const L: string[] = []
  L.push(`# Censorship-context source verification — ${OUT_TAG}`, '')
  L.push(`${rows.length} books · ${APPLY ? '**APPLIED**' : 'dry-run (no database writes)'} · cost $${cost.toFixed(2)} ($${(cost / Math.max(1, rows.length)).toFixed(3)}/book, ${searches} web searches)`, '')
  L.push(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: **${v}**`).join(' · '), '')
  const section = (title: string, pick: (r: RunRow) => boolean) => {
    const rs = rows.filter(pick)
    if (!rs.length) return
    L.push(`## ${title} (${rs.length})`, '')
    for (const r of rs) {
      L.push(`### ${r.title} — ${r.author || 'unknown'} · \`${r.slug}\` · ${r.outcome}`, '')
      if (r.oldText) L.push(`**Old (unsourced):** ${r.oldText}`, '')
      if (r.banText) L.push(`**Hidden ban text (claims also checked):** ${r.banText}`, '')
      if (r.newText) L.push(`**New (sourced):** ${r.newText}`, '')
      L.push(`**Why:** ${r.reason}`, '')
      L.push(`Old claims: ${r.claims.length} · supported verbatim: ${r.claimsSupported} · partial: ${r.claims.filter(c => c.stance === 'partial').length} · contradicted: ${r.claims.filter(c => c.stance === 'contradicts').length} · pages read: ${r.pagesFetched} · quotes not on page: ${r.quotesRejected}`, '')
      for (const s of r.sentences) {
        L.push(`- ${s.text}`)
        for (const id of s.quoteIds) {
          const q = r.quotes.find(x => x.id === id)
          if (q) L.push(`  - [${hostOf(q.url)}](${q.url}) (${q.tier}): "${q.quote}"`)
        }
      }
      for (const d of r.droppedSentences) L.push(`- ~~${d.text}~~ — ${d.why}`)
      if (r.recordConflicts.length) L.push('', `**Conflicts with our records:** ${r.recordConflicts.join(' · ')}`)
      if (r.notInRecords.length) L.push('', `**Not in our ban rows:** ${r.notInRecords.join(' · ')}`)
      if (r.sourcesDropped.length) L.push('', `<sub>dropped sources: ${r.sourcesDropped.join(' · ').slice(0, 400)}</sub>`)
      L.push('')
    }
  }
  section('Verified', r => r.outcome === 'verified')
  section('Verified, with an event our ban rows lack', r => r.outcome === 'verified_additions')
  section('Conflicts (sources vs sources, or vs our records)', r => r.outcome === 'record_conflict' || r.outcome === 'source_conflict')
  section('Failed grounding', r => r.outcome === 'failed_grounding')
  section('Nothing to publish', r => ['no_checkable_claims', 'no_sources', 'no_quotes', 'insufficient'].includes(r.outcome))
  section('Errors', r => r.outcome === 'error')
  fs.writeFileSync(reportPath, L.join('\n') + '\n')
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const jsonlPath = path.resolve('data', `censorship-context-verify-${OUT_TAG}.jsonl`)
  const reportPath = path.resolve('data', `censorship-context-verify-${OUT_TAG}.md`)

  const prior: RunRow[] = []
  if (!NO_RESUME && fs.existsSync(jsonlPath)) {
    for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { prior.push(JSON.parse(line) as RunRow) } catch { /* skip a torn line */ }
    }
  }
  if (REPORT_ONLY) {
    writeReport(prior, reportPath)
    console.log(`Report rebuilt from ${prior.length} rows: ${reportPath}`)
    return
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')

  // Errors are retried on the next run; every other outcome is a verdict.
  const done = new Set(prior.filter(r => r.outcome !== 'error').map(r => r.id))
  if (done.size) console.log(`Resume: ${done.size} books already in ${path.basename(jsonlPath)}`)
  const pool = (await loadBooks()).filter(b => !done.has(b.id))
  const batch = pool.slice(0, LIMIT)
  console.log(`Pool ${pool.length} · this run ${batch.length} · concurrency ${CONCURRENCY} · ${APPLY ? 'APPLY' : 'dry-run'}`)

  const rows: RunRow[] = prior.filter(r => r.outcome !== 'error')
  const applied: Record<ApplyResult, number> = { published: 0, noted: 0, skipped: 0 }
  const publishedSlugs: string[] = []
  const write = async (r: RunRow) => {
    const a = await applyRow(r)
    applied[a.result]++
    if (a.result === 'published') publishedSlugs.push(r.slug)
    if (a.result === 'skipped' && !/already|recorded/.test(a.why)) console.log(`    ↷ ${r.slug}: not written — ${a.why}`)
  }
  // Verdicts from an earlier (reviewed) dry-run of this tag go in first.
  if (APPLY) for (const r of rows) await write(r)
  let next = 0
  let n = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= batch.length) return
      const r = await verifyBook(batch[i])
      rows.push(r)
      fs.appendFileSync(jsonlPath, JSON.stringify(r) + '\n')
      if (APPLY) await write(r)
      n++
      const mark = r.outcome.startsWith('verified') ? '✓' : r.outcome === 'error' ? '!' : '·'
      console.log(`  ${mark} [${n}/${batch.length}] ${r.title.slice(0, 48)} → ${r.outcome} ($${r.costUsd.toFixed(3)}) ${r.reason.slice(0, 90)}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  writeReport(rows, reportPath)
  const tally: Record<string, number> = {}
  for (const r of rows) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1
  console.log(`\nOutcomes: ${JSON.stringify(tally)}`)
  console.log(`Cost this file: $${rows.reduce((a, r) => a + r.costUsd, 0).toFixed(2)} · Firecrawl calls this run: ${getFirecrawlCallCount()}`)
  console.log(`Report: ${reportPath}`)
  if (APPLY) {
    console.log(`Applied: published ${applied.published} · verdict noted ${applied.noted} · skipped ${applied.skipped}`)
    if (publishedSlugs.length) await bustChangedPages({ bookSlugs: publishedSlugs, authorSlugs: [] })
  } else {
    console.log('Dry-run — review the report, then re-run with --apply (add --limit=0 to write only what is in the checkpoint).')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
