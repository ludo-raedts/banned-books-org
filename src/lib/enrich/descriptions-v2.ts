/**
 * Second-generation book-description enrichment pipeline. Designed
 * 2026-05-28 in response to the LLM-hallucination incident that the
 * judge run cleaned up.
 *
 * Hard guarantees:
 *   1. Every accepted source extract passes BOTH an author-surname
 *      match AND a title-fuzz match against its own text. The "Principia"
 *      → Russell mismatch and the "Tropic of Cancer" → Cancer-the-zodiac
 *      mismatch both die at this gate.
 *   2. LLM is NEVER asked to write a description from its training
 *      knowledge alone. It is only used to SYNTHESISE from cited source
 *      text we supplied, and only when ≥2 sources are available
 *      (=  cross-confirmation). Single-source rows get the literal
 *      extract (truncated if needed) — no paraphrasing.
 *   3. Every accepted description is paired with description_source_url
 *      and description_source_type so the UI can show provenance and a
 *      future audit can re-validate.
 *   4. ai_drafted is set only for llm_grounded_* outputs.
 *   5. data_quality_status:
 *        - confident: literal extract from Wikipedia/OL/GB, OR
 *                     llm_grounded_multi (2+ sources cross-confirmed)
 *        - default:   llm_grounded_single (1 source, LLM paraphrased)
 *        - flagged:   no source resolved at all (description_book stays NULL)
 *
 * Source ladder, in priority order:
 *   1. English Wikipedia full article (first 5000 chars)
 *   2. OpenLibrary — by ISBN first (exact edition → work, the strongest
 *      binding), then by openlibrary_work_id, then title/author search
 *   3. Google Books volume description
 *   4. Non-English Wikipedia → translated to English via LLM grounding
 *
 * Reground mode (regroundUngrounded): targets ISBN-bearing rows whose
 * synopsis was filled before provenance tracking existed
 * (description_source_type IS NULL) and re-sources them, overwriting only
 * when a verified source resolves and backing up the originals first.
 *
 * For LLM synthesis we use gpt-4o-mini (cheap, ~$0.001 per book) with
 * temperature=0 and a strict "only facts from the provided sources"
 * system prompt.
 */
import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../supabase'

type SourceType =
  | 'wikipedia'
  | 'wikipedia_translated'
  | 'openlibrary'
  | 'google_books'
  | 'llm_grounded_multi'
  | 'llm_grounded_single'

export type EnrichDescriptionsV2Opts = {
  apply: boolean
  limit?: number
  slug?: string
  /**
   * Also process rows whose description_book is already set. By default
   * we only enrich NULLs (plus rows the judge has flagged).
   */
  overwrite?: boolean
  /**
   * Allow LLM synthesis from grounded sources. Off by default — leaves
   * single-source rows with the literal extract and skips obscure rows
   * that need cross-source synthesis.
   */
  allowLlm?: boolean
  /**
   * Process flagged rows too. The judge wipes description_book and sets
   * 'flagged' on confirmed hallucinations; this pipeline is the
   * intended way to refill them.
   */
  processFlagged?: boolean
  /**
   * Re-ground mode: target ISBN-bearing rows whose description_book is set but
   * has NO tracked source (description_source_type IS NULL) — i.e. the
   * pre-v2 ungrounded synopses. Implies overwrite, but SAFELY: a row is only
   * touched when a verified source resolves. Rows where no source resolves keep
   * their existing text untouched (no flagging, no nulling).
   */
  regroundUngrounded?: boolean
  /**
   * Number of books processed concurrently. Defaults to 1 (sequential).
   * Each worker does its own Wikipedia/OL/GB lookups, so concurrency=5
   * is a safe upper bound that respects Wikipedia's etiquette (≤10 req/s
   * across all workers combined, well under the 200/s limit).
   */
  concurrency?: number
  onProgress?: (msg: string) => void
}

export type EnrichDescriptionsV2Result = {
  candidates: number
  processed: number
  filled: { literal: number; llm_multi: number; llm_single: number }
  skipped: { no_source: number; already_filled: number }
  errors: number
  totalCostUsd: number
}

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const WIKI_DELAY_MS = 300
const OL_DELAY_MS = 600
const MIN_DESC_CHARS = 80
const MAX_DESC_CHARS = 2500
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const LANG_FALLBACKS = ['fr', 'de', 'it', 'es', 'nl', 'la', 'pt', 'ru'] as const

// ──────────────────────────────────────────────────────────────────────
// Title + author normalisation and matching
// ──────────────────────────────────────────────────────────────────────

function stripAuthorPrefix(t: string): string {
  const i = t.indexOf(' — ')
  return i > 0 ? t.slice(i + 3).trim() : t
}
function stripTrailingParen(t: string): string { return t.replace(/\s*\([^)]*\)\s*$/g, '').trim() }
function stripSubtitle(t: string): string { return t.split(/[,;:]/)[0].trim() }

function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[''’`]/g, '')                            // smart quotes
    .replace(/[^a-z0-9\s]/g, ' ')                      // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
}

function lastNameOf(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : ''
}

/**
 * Combined title+author guard. Both must show up in the candidate text.
 *  - author surname (≥3 chars, accent-stripped)
 *  - at least one variant of the title head (full / no-subtitle / first ≥4-char word)
 *
 * IMPORTANT: pass ONLY the candidate source text as `text`. Never concatenate
 * our own `title`/`author` into it — that poisons the haystack with the very
 * needle we're searching for, so the guard can never reject anything. That bug
 * (present since the v2 pipeline shipped) is what pasted Huckleberry Finn's
 * OpenLibrary blurb onto "Bondage Classics" and others. See _audit_ol_contamination.ts.
 */
export function sourceMatches(text: string, title: string, author: string): boolean {
  const norm = normaliseForMatch(text)
  const surname = normaliseForMatch(lastNameOf(author))
  if (surname.length < 3) return false   // can't reliably guard without surname
  if (!norm.includes(surname)) return false

  const cleanedTitle = normaliseForMatch(stripTrailingParen(stripAuthorPrefix(title)))
  if (cleanedTitle.length === 0) return false
  if (norm.includes(cleanedTitle)) return true

  // Try title head (everything before first comma/colon/semicolon)
  const head = normaliseForMatch(stripSubtitle(stripTrailingParen(stripAuthorPrefix(title))))
  if (head.length >= 4 && norm.includes(head)) return true

  // Last-resort: first significant word of the title (≥5 chars, not a stopword)
  const firstSig = cleanedTitle.split(/\s+/).find(w => w.length >= 5 && !['about','their','these','those','where','which'].includes(w))
  if (firstSig && norm.includes(firstSig)) return true

  return false
}

// ──────────────────────────────────────────────────────────────────────
// Wikipedia fetchers (full article via prop=extracts)
// ──────────────────────────────────────────────────────────────────────

type WikiSummary = { title: string; description?: string; extract?: string; type?: string; content_urls?: { desktop?: { page?: string } } }

async function wikiSummary(pageTitle: string, lang: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`, { headers: UA, redirect: 'follow' })
    if (!res.ok) return null
    return await res.json() as WikiSummary
  } catch { return null }
}

async function wikiFullExtract(pageTitle: string, lang: string): Promise<string | null> {
  // Wikipedia caps exchars at 1200 for the action=query / prop=extracts API
  // (passing more silently truncates with a warning). For our verification
  // task that's enough — it covers the lead paragraph which has the
  // canonical book summary.
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=true&exchars=1200&redirects=1&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) return null
    const json = await res.json() as { query?: { pages?: Record<string, { extract?: string; missing?: '' }> } }
    const pages = json.query?.pages
    if (!pages) return null
    for (const k of Object.keys(pages)) {
      if (pages[k].missing !== undefined) return null
      const ex = pages[k].extract
      if (ex && ex.length >= MIN_DESC_CHARS) return ex
    }
    return null
  } catch { return null }
}

async function wikiOpensearch(query: string, lang: string): Promise<string[]> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`, { headers: UA })
    if (!res.ok) return []
    const json = await res.json() as [string, string[], string[], string[]]
    return json[1] ?? []
  } catch { return [] }
}

type SourceExtract = {
  type: SourceType
  url: string
  text: string
  pageLang: string  // 'en', 'fr', etc. — informational only
}

async function resolveWikipedia(title: string, author: string, lang: string): Promise<SourceExtract | null> {
  const titleFull = stripTrailingParen(stripAuthorPrefix(title))
  const titleHead = stripSubtitle(titleFull)
  const surname = lastNameOf(author)

  async function tryPage(pageTitle: string): Promise<SourceExtract | null> {
    const s = await wikiSummary(pageTitle, lang)
    await sleep(WIKI_DELAY_MS)
    if (!s || s.type === 'disambiguation') return null
    const full = await wikiFullExtract(pageTitle, lang)
    await sleep(WIKI_DELAY_MS)
    if (!full || full.length < MIN_DESC_CHARS) return null
    if (!sourceMatches(full, title, author)) return null
    return {
      type: lang === 'en' ? 'wikipedia' : 'wikipedia_translated',
      url: s.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
      text: full,
      pageLang: lang,
    }
  }

  // Direct title lookups
  for (const v of [titleFull, titleHead]) {
    const r = await tryPage(v)
    if (r) return r
  }
  // Opensearch with variants
  const queries = surname ? [
    `${titleFull} ${author}`,
    `${titleHead} ${surname}`,
    `${surname} ${titleHead}`,
  ] : [titleFull, titleHead]
  const seen = new Set<string>()
  for (const q of queries) {
    if (seen.has(q)) continue
    seen.add(q)
    const hits = await wikiOpensearch(q, lang)
    await sleep(WIKI_DELAY_MS)
    for (const h of hits.slice(0, 3)) {
      if (seen.has(`p:${h}`)) continue
      seen.add(`p:${h}`)
      const r = await tryPage(h)
      if (r) return r
    }
  }
  return null
}

// ──────────────────────────────────────────────────────────────────────
// OpenLibrary
// ──────────────────────────────────────────────────────────────────────

function extractOlDesc(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

/**
 * `lenient` says whether `workId` is a binding we trust. When it is — a stored
 * books.openlibrary_work_id, or a work reached from an exact ISBN — that
 * binding IS the verification, so we accept the synopsis even when it doesn't
 * echo our title/author (real blurbs frequently don't; requiring it rejected
 * ~84% of correct rows). When the work id came from a free-text search
 * (olSearch) it's just OpenLibrary's top guess, so we require the text to
 * actually mention our title/author — otherwise the most-popular namesake's
 * synopsis sails straight through (the Huckleberry-Finn-on-everything bug).
 * Wrong-binding cases that slip past trust are caught by
 * scripts/_audit_shared_enrichment.ts.
 */
async function olWorks(workId: string, title: string, author: string, lenient: boolean): Promise<SourceExtract | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, { headers: UA })
    if (!res.ok) return null
    const text = extractOlDesc(await res.json() as Record<string, unknown>)
    if (!text || text.length < MIN_DESC_CHARS) return null
    if (!lenient && !sourceMatches(text, title, author)) return null
    return { type: 'openlibrary', url: `https://openlibrary.org/works/${workId}`, text, pageLang: 'en' }
  } catch { return null }
}

async function olSearch(title: string, author: string): Promise<SourceExtract | null> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key&limit=1`, { headers: UA })
    if (!res.ok) return null
    const json = await res.json() as { docs: Array<{ key?: string }> }
    const workId = json.docs?.[0]?.key?.replace('/works/', '')
    if (!workId) return null
    await sleep(OL_DELAY_MS)
    // Search-derived work id is unproven — require a strict text match.
    return await olWorks(workId, title, author, false)
  } catch { return null }
}

/**
 * Resolve a description from an exact ISBN: /isbn/<isbn>.json → works[0] →
 * /works/<id>.json. The ISBN binds the *edition*, but edition-level blurbs are
 * often localized translations, so we PREFER the work-level description (the
 * canonical, usually-English synopsis) and only fall back to the edition blurb.
 *
 * Trust model (revised 2026-06-04): the ISBN→edition→work resolution IS the
 * verification, so we accept the synopsis on that binding alone. We do NOT
 * require the text to echo the title/author — real synopses frequently omit the
 * author name, and enforcing it rejected ~84% of correct rows (the old "must
 * mention the surname" gate was a no-op anyway: it was fed a haystack poisoned
 * with our own title+author, so it never rejected anything). The residual risk —
 * a wrong isbn13 or junk OL edition→work mapping ("De la France" → Don Quijote) —
 * is caught downstream by scripts/_audit_shared_enrichment.ts rather than by
 * discarding thousands of correct descriptions here.
 */
async function olByIsbn(isbn: string): Promise<SourceExtract | null> {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: UA, redirect: 'follow' })
    if (!res.ok) return null
    const edition = await res.json() as Record<string, unknown>

    // Work-level description first (canonical), then edition-level fallback.
    let text: string | null = null
    let url = `https://openlibrary.org/isbn/${isbn}`
    const works = edition.works as Array<{ key?: string }> | undefined
    const workKey = works?.[0]?.key   // "/works/OL...W"
    if (workKey) {
      await sleep(OL_DELAY_MS)
      const wr = await fetch(`https://openlibrary.org${workKey}.json`, { headers: UA })
      if (wr.ok) {
        const work = await wr.json() as Record<string, unknown>
        const wDesc = extractOlDesc(work)
        if (wDesc && wDesc.length >= MIN_DESC_CHARS) { text = wDesc; url = `https://openlibrary.org${workKey}` }
      }
    }
    if (!text) {
      const eDesc = extractOlDesc(edition)
      if (eDesc && eDesc.length >= MIN_DESC_CHARS) text = eDesc
    }
    if (!text) return null

    // No text gate — the ISBN binding is the verification (see doc comment).
    return { type: 'openlibrary', url, text, pageLang: 'en' }
  } catch { return null }
}

// ──────────────────────────────────────────────────────────────────────
// Google Books
// ──────────────────────────────────────────────────────────────────────

async function googleBooks(title: string, author: string): Promise<SourceExtract | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`)
    if (!res.ok) return null
    const json = await res.json() as { items?: Array<{ id: string; volumeInfo: { description?: string; infoLink?: string; title?: string; authors?: string[] } }> }
    for (const item of json.items ?? []) {
      const desc = item.volumeInfo.description
      if (!desc || desc.length < MIN_DESC_CHARS) continue
      // Validate: GB's own metadata must mention our author surname.
      const itemAuthors = (item.volumeInfo.authors ?? []).join(' ')
      if (!sourceMatches(`${desc} ${item.volumeInfo.title ?? ''} ${itemAuthors}`, title, author)) continue
      return {
        type: 'google_books',
        url: item.volumeInfo.infoLink ?? `https://books.google.com/books?id=${item.id}`,
        text: desc,
        pageLang: 'en',
      }
    }
    return null
  } catch { return null }
}

// ──────────────────────────────────────────────────────────────────────
// LLM grounded synthesis
// ──────────────────────────────────────────────────────────────────────

const LLM_SYSTEM = `You are a careful book-description writer. You are given the title of a book, its author, and one or more SOURCE TEXTS extracted from authoritative references (Wikipedia, OpenLibrary, Google Books). Your task is to write a single 2-3 sentence description (60-400 characters) of the book in English.

Hard rules:
- Use ONLY facts that appear in the supplied SOURCE TEXTS. Do not add details from your own knowledge.
- Prefer claims that appear in two or more sources. If a claim appears in only one source, you may include it, but lean on the cross-confirmed ones.
- Write in English regardless of the source language.
- If the sources contradict each other on a fact, omit that fact entirely.
- If the sources are too thin or contradictory to write a useful description, output exactly: NO_RELIABLE_DESCRIPTION
- Do not invent character names, dates, ISBNs, or publishers. Do not editorialise.
- Output is plain text — no markdown, no leading "Description:", no citations in the prose.

Output ONLY the description text (or NO_RELIABLE_DESCRIPTION).`

const COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
}

async function synthesise(
  openai: OpenAI,
  model: string,
  title: string,
  author: string,
  sources: SourceExtract[],
): Promise<{ text: string | null; cost: number }> {
  const sourceBlock = sources.map((s, i) =>
    `[Source ${i + 1} — ${s.type}${s.pageLang !== 'en' ? ` (${s.pageLang})` : ''}: ${s.url}]\n${s.text.slice(0, 4000)}`,
  ).join('\n\n---\n\n')

  const userMsg = `BOOK TITLE: ${title}
AUTHOR: ${author || '(unknown)'}

${sources.length} SOURCE TEXT${sources.length === 1 ? '' : 'S'}:

${sourceBlock}`

  try {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: 250,
      temperature: 0,
      messages: [
        { role: 'system', content: LLM_SYSTEM },
        { role: 'user', content: userMsg },
      ],
    })
    const out = res.choices[0]?.message?.content?.trim() ?? null
    const c = COSTS[model] ?? COSTS['gpt-4o-mini']
    const cost = (res.usage?.prompt_tokens ?? 0) * c.input + (res.usage?.completion_tokens ?? 0) * c.output
    if (!out) return { text: null, cost }
    if (out === 'NO_RELIABLE_DESCRIPTION') return { text: null, cost }
    if (out.length < MIN_DESC_CHARS) return { text: null, cost }
    return { text: out.slice(0, MAX_DESC_CHARS), cost }
  } catch (e) {
    void e
    return { text: null, cost: 0 }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Per-book pipeline
// ──────────────────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  description_book: string | null
  description_source_type: string | null
  openlibrary_work_id: string | null
  data_quality_status: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
}

type EnrichResult = {
  description_book: string | null
  description_source_url: string | null
  description_source_type: SourceType | null
  data_quality_status: 'confident' | 'default' | 'flagged'
  ai_drafted: boolean
  llmCost: number
  reason: string
}

async function enrichOne(
  openai: OpenAI | null,
  row: BookRow,
  opts: EnrichDescriptionsV2Opts,
): Promise<EnrichResult> {
  const author = row.book_authors?.[0]?.authors?.display_name ?? ''
  const titleClean = stripTrailingParen(stripAuthorPrefix(row.title))

  // Gather sources, in parallel where independent, with author+title gating.
  const collected: SourceExtract[] = []

  // 1. English Wikipedia
  const wikiEn = await resolveWikipedia(row.title, author, 'en')
  if (wikiEn) collected.push(wikiEn)

  // 2. OpenLibrary. ISBN is the strongest binding (exact edition → work), so
  //    try it first; fall back to work-id, then title/author search.
  let ol: SourceExtract | null = null
  if (row.isbn13) {
    ol = await olByIsbn(row.isbn13)
    await sleep(OL_DELAY_MS)
  }
  if (!ol && row.openlibrary_work_id) {
    // Trusted binding from a prior ISBN/work-id resolution → lenient short-text OK.
    ol = await olWorks(row.openlibrary_work_id, row.title, author, true)
    await sleep(OL_DELAY_MS)
  }
  if (!ol) {
    ol = await olSearch(titleClean, author)
    await sleep(OL_DELAY_MS)
  }
  if (ol) collected.push(ol)

  // 3. Google Books — useful to verify, especially when Wikipedia is empty
  const gb = await googleBooks(titleClean, author)
  if (gb) collected.push(gb)

  // 4. Non-English Wikipedia, only when we still don't have ≥2 sources
  if (collected.length < 2) {
    for (const lang of LANG_FALLBACKS) {
      const r = await resolveWikipedia(row.title, author, lang)
      if (r) {
        collected.push(r)
        if (collected.length >= 2) break
      }
    }
  }

  if (collected.length === 0) {
    return {
      description_book: null,
      description_source_url: null,
      description_source_type: null,
      data_quality_status: 'flagged',
      ai_drafted: false,
      llmCost: 0,
      reason: 'no source resolved',
    }
  }

  // ── Multi-source: cross-confirmed → confident ────────────────────────
  if (collected.length >= 2) {
    if (opts.allowLlm && openai) {
      const { text, cost } = await synthesise(openai, 'gpt-4o-mini', row.title, author, collected)
      if (text) {
        // LLM produced a clean synthesis from ≥2 sources.
        return {
          description_book: text,
          description_source_url: collected[0].url,
          description_source_type: 'llm_grounded_multi',
          data_quality_status: 'confident',
          ai_drafted: true,
          llmCost: cost,
          reason: `llm synthesis from ${collected.length} sources`,
        }
      }
      // LLM returned NO_RELIABLE_DESCRIPTION → fall through to literal.
    }
    // Literal fallback: pick the highest-priority source (Wikipedia EN > OL > GB > non-EN wiki)
    const best = collected.sort(sourcePriority)[0]
    const literal = best.text.length > MAX_DESC_CHARS ? best.text.slice(0, MAX_DESC_CHARS) : best.text
    return {
      description_book: literal,
      description_source_url: best.url,
      description_source_type: best.type,
      data_quality_status: 'confident',
      ai_drafted: false,
      llmCost: 0,
      reason: `literal from ${best.type} (multi-source available, llm off)`,
    }
  }

  // ── Single-source ─────────────────────────────────────────────────────
  const only = collected[0]
  // If it's English Wikipedia / OL / GB and within length bounds, take literal.
  if (only.text.length <= MAX_DESC_CHARS && only.pageLang === 'en') {
    return {
      description_book: only.text,
      description_source_url: only.url,
      description_source_type: only.type,
      data_quality_status: 'default',   // 1 source only → lower trust
      ai_drafted: false,
      llmCost: 0,
      reason: `literal from single ${only.type}`,
    }
  }
  // Non-English single source OR too-long English: LLM paraphrase if allowed
  if (opts.allowLlm && openai) {
    const { text, cost } = await synthesise(openai, 'gpt-4o-mini', row.title, author, [only])
    if (text) {
      return {
        description_book: text,
        description_source_url: only.url,
        description_source_type: 'llm_grounded_single',
        data_quality_status: 'default',
        ai_drafted: true,
        llmCost: cost,
        reason: `llm paraphrase of single ${only.type} (${only.pageLang})`,
      }
    }
  }
  // No LLM and source is non-EN or too long → flagged
  return {
    description_book: null,
    description_source_url: only.url,
    description_source_type: null,
    data_quality_status: 'flagged',
    ai_drafted: false,
    llmCost: 0,
    reason: `single ${only.type} in ${only.pageLang}, llm off → flagged`,
  }
}

const PRIORITY: Record<SourceType, number> = {
  wikipedia: 1,
  openlibrary: 2,
  google_books: 3,
  wikipedia_translated: 4,
  llm_grounded_multi: 5,
  llm_grounded_single: 6,
}
function sourcePriority(a: SourceExtract, b: SourceExtract): number {
  return PRIORITY[a.type] - PRIORITY[b.type]
}

// ──────────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────────

export async function enrichDescriptionsV2(opts: EnrichDescriptionsV2Opts): Promise<EnrichDescriptionsV2Result> {
  const log = opts.onProgress ?? (() => {})
  const sb = adminClient()
  const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
  if (opts.allowLlm && !openai) {
    throw new Error('--allow-llm passed but OPENAI_API_KEY is not set')
  }

  // Build candidate query.
  let candidates: BookRow[] = []
  {
    let from = 0
    for (;;) {
      let q = sb.from('books')
        .select('id, slug, title, isbn13, description_book, description_source_type, openlibrary_work_id, data_quality_status, book_authors(authors(display_name))')
        // Blanket-works pseudo-books ("Toutes ses œuvres …") are not real
        // titles — no source will ever resolve, so never enrich them.
        .eq('is_blanket_works', false)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (opts.slug) q = q.eq('slug', opts.slug) as typeof q
      else if (opts.regroundUngrounded) {
        // Pre-v2 ungrounded synopses on ISBN-bearing rows.
        q = q.not('isbn13', 'is', null).is('description_source_type', null) as typeof q
      }
      else if (!opts.overwrite) q = q.is('description_book', null) as typeof q
      const { data, error } = await q
      if (error) throw new Error(`DB read: ${error.message}`)
      if (!data || data.length === 0) break
      candidates = candidates.concat(data as unknown as BookRow[])
      if (data.length < 1000) break
      from += 1000
    }
  }

  // Filter by status (unless --slug / --overwrite / --reground bypass).
  if (!opts.slug && !opts.overwrite && !opts.regroundUngrounded) {
    if (!opts.processFlagged) {
      candidates = candidates.filter(b => b.data_quality_status !== 'flagged')
    }
  }

  if (opts.limit) candidates = candidates.slice(0, opts.limit)

  const concurrency = Math.max(1, opts.concurrency ?? 1)
  log(`Candidates: ${candidates.length}`)
  log(`LLM synthesis: ${opts.allowLlm ? 'enabled (gpt-4o-mini)' : 'disabled (literal-source only)'}`)
  log(`Concurrency: ${concurrency}`)

  const result: EnrichDescriptionsV2Result = {
    candidates: candidates.length,
    processed: 0,
    filled: { literal: 0, llm_multi: 0, llm_single: 0 },
    skipped: { no_source: 0, already_filled: 0 },
    errors: 0,
    totalCostUsd: 0,
  }

  // Reground overwrites existing text → back up originals first (reversible
  // via re-import). One CSV per run, appended as rows are overwritten.
  let backupPath: string | null = null
  const csvEscape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  if (opts.apply && opts.regroundUngrounded) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    backupPath = path.resolve('data', `description-book-reground-backup-${stamp}.csv`)
    fs.mkdirSync(path.dirname(backupPath), { recursive: true })
    fs.writeFileSync(backupPath, ['slug', 'description_book_old', 'description_source_type_old'].join(',') + '\n')
    log(`Backup: ${backupPath}`)
  }

  async function processOne(row: BookRow): Promise<void> {
    try {
      const r = await enrichOne(openai, row, opts)
      result.processed++
      result.totalCostUsd += r.llmCost

      if (r.description_source_type === 'llm_grounded_multi') result.filled.llm_multi++
      else if (r.description_source_type === 'llm_grounded_single') result.filled.llm_single++
      else if (r.description_book) result.filled.literal++
      else result.skipped.no_source++

      const verdict = r.description_book ? `${r.description_source_type} (${r.description_book.length}c)` : 'NO SOURCE'
      log(`  [${result.processed}/${candidates.length}] ${row.title.slice(0, 50)} → ${verdict}`)

      if (opts.apply && r.description_book) {
        if (backupPath) {
          fs.appendFileSync(backupPath, [row.slug, row.description_book ?? '', row.description_source_type ?? ''].map(csvEscape).join(',') + '\n')
        }
        const upd: Record<string, unknown> = {
          description_book: r.description_book,
          description_source_url: r.description_source_url,
          description_source_type: r.description_source_type,
          data_quality_status: r.data_quality_status,
          data_quality_evaluated_at: new Date().toISOString(),
          ai_drafted: r.ai_drafted,
        }
        const { error: ue } = await sb.from('books').update(upd).eq('id', row.id)
        if (ue) { log(`    ✗ DB write: ${ue.message}`); result.errors++ }
      } else if (opts.apply && r.data_quality_status === 'flagged' && !r.description_book && !opts.regroundUngrounded) {
        // Make sure the status reflects "still no source" even on retry.
        // SKIP in reground mode: these rows already carry usable (if untracked)
        // text — a failed re-ground must leave them exactly as they were, never
        // demote a populated synopsis to 'flagged'.
        await sb.from('books').update({
          data_quality_status: 'flagged',
          data_quality_evaluated_at: new Date().toISOString(),
        }).eq('id', row.id)
      }
    } catch (e) {
      result.errors++
      log(`  ! ${row.id} ${row.title}: ${(e as Error).message}`)
    }
  }

  // Worker pool — each worker pulls from a shared queue.
  const queue: BookRow[] = candidates.slice()
  const workers: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break
        await processOne(item)
      }
    })())
  }
  await Promise.all(workers)

  return result
}
